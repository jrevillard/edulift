import { execSync } from 'child_process';

async function globalTeardown() {
  console.log('🧹 Cleaning up E2E environment...');
  
  try {
    // Stop E2E Docker containers
    execSync('docker compose -f docker-compose.yml stop', {
      stdio: 'inherit',
      timeout: 60000
    });
    
    console.log('✅ E2E environment stopped successfully');
  } catch (error) {
    console.error('❌ Failed to stop E2E environment:', error);
    // Don't throw here to avoid masking test failures
  }
}

export default globalTeardown;