import { test, expect } from '@playwright/test';

test.describe('Simple API Connectivity Test', () => {
  test('should be able to call backend API from frontend', async ({ page }) => {
    // Navigate to frontend
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Test if we can fetch the backend health endpoint
    const healthCheck = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:8002/health');
        const data = await response.json();
        return { success: true, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    console.log('Health check result:', healthCheck);
    expect(healthCheck.success).toBe(true);
    expect(healthCheck.data.status).toBe('healthy');
  });

  test('should be able to call auth API endpoint', async ({ page }) => {
    // Navigate to frontend
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');

    // Test if we can fetch the auth endpoint
    const authTest = await page.evaluate(async () => {
      try {
        const response = await fetch('http://localhost:8002/auth/profile', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        const data = await response.json();
        return { success: true, status: response.status, data };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    });

    console.log('Auth endpoint result:', authTest);
    expect(authTest.success).toBe(true);
    // Should get 401 or similar error (not network error)
    expect(authTest.status).toBeGreaterThanOrEqual(400);
  });
});
