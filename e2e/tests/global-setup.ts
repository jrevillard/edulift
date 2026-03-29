import { chromium as _chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as fs from 'fs';

async function globalSetup(_config: FullConfig) {
  console.log('🚀 Starting E2E environment setup...');

  // Check if running inside a container (no Docker available)
  const isRunningInContainer = process.env.E2E_RUNNER === 'container' ||
                                process.cwd() === '/e2e' ||
                                fs.existsSync('/.dockerenv');

  if (isRunningInContainer) {
    console.log('📦 Running inside container - assuming containers are already managed');
    console.log('✅ E2E environment ready!');
    return;
  }

  try {
    // Clean up any existing containers first
    console.log('🧹 Cleaning up existing containers...');
    try {
      execSync('docker compose -f docker-compose.yml down -v', {
        stdio: 'inherit',
        timeout: 60000,
      });
    } catch (_cleanupError) {
      console.log('No existing containers to clean up (this is normal)');
    }
    
    // Start E2E Docker containers
    console.log('📦 Starting Docker containers...');
    execSync('docker compose -f docker-compose.yml up -d --build', {
      stdio: 'inherit',
      timeout: 180000, // 3 minutes
    });
    
    // Wait for services to be ready
    console.log('⏳ Waiting for services to be ready...');
    await waitForDockerHealth('edulift-mailpit-e2e', 30000);
    await waitForDockerHealth('edulift-backend-e2e', 60000);
    await waitForDockerHealth('edulift-frontend-e2e', 60000);
    
    // Skip global test data setup - all data will be file-specific
    console.log('🗄️ Skipping global test data setup - using file-specific data only');
    
    console.log('✅ E2E environment ready!');
    
  } catch (error) {
    console.error('❌ Failed to setup E2E environment:', error);
    // Cleanup on failure
    try {
      execSync('docker compose -f docker-compose.yml down -v', { stdio: 'inherit' });
    } catch (cleanupError) {
      console.error('Failed to cleanup after setup error:', cleanupError);
    }
    throw error;
  }
}

async function waitForDockerHealth(containerName: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const result = execSync(`docker inspect ${containerName} --format='{{.State.Health.Status}}'`, { 
        encoding: 'utf8',
        timeout: 5000, 
      }).trim();
      
      if (result === 'healthy') {
        console.log(`✅ Container ${containerName} is healthy`);
        return;
      }
    } catch (_error) {
      // Container not ready yet
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`Container ${containerName} not healthy after ${timeout}ms`);
}


export default globalSetup;