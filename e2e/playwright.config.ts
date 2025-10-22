import { defineConfig, devices } from '@playwright/test';

// Ensure E2E_BASE_URL is set for production, allow fallback for manual testing
if (!process.env.E2E_BASE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('E2E_BASE_URL environment variable is required in production. Please set it to your test environment URL (e.g., http://localhost:8001)');
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Enable parallel tests with improved timing */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { 
      outputFolder: 'playwright-report',
      host: '0.0.0.0',  // Listen on all interfaces for Docker access
      port: 9323        // Fixed port for consistency
    }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }]
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:8001',
    
    /* Run in headless mode for containerized/CI environments */
    headless: true,
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
    
    /* Reasonable timeouts with condition-based waits */
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers - optimized for speed */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Other browsers disabled for faster E2E testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* E2E containers are managed separately via docker-compose */
  // webServer: [
  //   {
  //     command: 'npm run e2e:start-backend',
  //     port: 8002,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120000,
  //   },
  //   {
  //     command: 'npm run e2e:start-frontend', 
  //     port: 8001,
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 120000,
  //   }
  // ],

  /* Global setup and teardown */
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',

  /* Test timeout */
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
});