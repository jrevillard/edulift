import { execSync } from 'child_process';
import * as fs from 'fs';

async function globalTeardown() {
  console.log('🧹 Cleaning up E2E environment...');

  // Check if running inside a container (no Docker available)
  const isRunningInContainer = process.env.E2E_RUNNER === 'container' ||
                                process.cwd() === '/e2e' ||
                                fs.existsSync('/.dockerenv');

  if (isRunningInContainer) {
    console.log('📦 Running inside container - skipping container cleanup');
    console.log('✅ E2E environment stopped successfully');
    return;
  }

  try {
    // Stop E2E Docker containers
    execSync('docker compose -f docker-compose.yml stop', {
      stdio: 'inherit',
      timeout: 60000,
    });

    console.log('✅ E2E environment stopped successfully');
  } catch (error) {
    console.error('❌ Failed to stop E2E environment:', error);
    // Don't throw here to avoid masking test failures
  }
}

export default globalTeardown;