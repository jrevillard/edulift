import { test as setup, expect } from '@playwright/test';
import { TEST_USERS } from './test-data';
import path from 'path';

const authFile = path.join(__dirname, 'playwright-auth.json');

// Setup authentication state once for all tests
setup('authenticate', async ({ page, request }) => {
  // Option 1: Direct API authentication (preferred for E2E)
  try {
    // Request magic link via API
    const response = await request.post('/api/v1/auth/magic-link', {
      data: {
        email: TEST_USERS.ADMIN.email,
        name: TEST_USERS.ADMIN.name
      }
    });

    expect(response.ok()).toBeTruthy();
    
    // In a real scenario, we would:
    // 1. Extract the token from the email (mock email service)
    // 2. Verify the token
    // 3. Get the JWT tokens
    
    // For E2E tests, we'll simulate successful auth by setting localStorage
    await page.goto('/');
    await page.evaluate((userData) => {
      const _authData = {
        state: {
          user: {
            id: 'test-admin-id',
            email: userData.email,
            name: userData.name
          },
          isAuthenticated: true,
          accessToken: 'test-jwt-token',
          refreshToken: 'test-refresh-token'
        },
        version: 0
      };
      localStorage.setItem('auth-storage', JSON.stringify(_authData));
    }, TEST_USERS.ADMIN);

    // Save the authentication state
    await page.context().storageState({ path: authFile });
    
  } catch (error) {
    console.error('Authentication setup failed:', error);
    throw error;
  }
});