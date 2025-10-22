import { Page, expect } from '@playwright/test';
import { TestUser, TEST_USERS } from './test-data';
import * as crypto from 'crypto';

export class AuthHelper {
  constructor(private page: Page) {}

  private createValidJWT(userId: string, email: string): string {
    const secret = 'e2e-test-access-secret-key-very-long';
    
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      userId: userId,
      email: email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour from now
    };
    
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64url');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  async login(userType: keyof typeof TEST_USERS): Promise<void> {
    const user = TEST_USERS[userType];
    
    await this.page.goto('/login');
    
    // Fill email
    await this.page.fill('[data-testid="email-input"]', user.email);
    
    // Let the real magic link API call flow through - no mocking in E2E tests
    
    // Submit magic link request
    await this.page.click('[data-testid="send-magic-link"]');
    
    // Wait for success message
    await expect(this.page.locator('[data-testid="magic-link-sent"]')).toBeVisible();
    
    // For E2E tests, we need to use real authentication flow
    // This requires actual magic link verification from backend
    console.warn('WARNING: This auth helper uses mocking patterns - should be replaced with UniversalAuthHelper');
    await this.mockMagicLinkVerification(user);
  }
  
  private async mockMagicLinkVerification(user: TestUser): Promise<void> {
    // DEPRECATED: This method uses localStorage mocking which violates E2E principles
    // TODO: Replace with real backend authentication flow
    console.warn('DEPRECATED: mockMagicLinkVerification uses localStorage mocking - violates E2E testing principles');
    
    // Create a valid JWT token
    const userId = `test-${user.email.split('@')[0].replace('.', '')}`;
    const jwtToken = this.createValidJWT(userId, user.email);
    
    // Set authentication state in localStorage using AuthService format
    await this.page.evaluate(({ token, userData }) => {
      const user = {
        id: `test-${userData.email.split('@')[0].replace('.', '')}`,
        email: userData.email,
        name: userData.name
      };
      
      localStorage.setItem('authToken', token);
      localStorage.setItem('userData', JSON.stringify(user));
      
      const _authData = {
        state: {
          user: user,
          isAuthenticated: true,
          isNewUser: userData.isNewUser || false,
          accessToken: token,
          refreshToken: 'test-refresh-token'
        },
        version: 0
      };
      localStorage.setItem('auth-storage', JSON.stringify(_authData));
    }, { token: jwtToken, userData: user });
    
    await this.page.goto('/dashboard');
    await this.page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 10000 });
  }
  
  async logout(): Promise<void> {
    // Click user menu
    await this.page.click('[data-testid="DesktopNav-Container-userMenuTrigger"]');
    
    // Click logout
    await this.page.click('[data-testid="DesktopNav-Button-logout"]');
    
    // Verify redirect to login
    await this.page.waitForURL('/login');
  }
  
  async expectToBeLoggedIn(): Promise<void> {
    // Check for user menu or dashboard elements
    await expect(this.page.locator('[data-testid="DesktopNav-Container-userMenuTrigger"]')).toBeVisible();
  }
  
  async expectToBeLoggedOut(): Promise<void> {
    // Should be on login page
    await expect(this.page.locator('[data-testid="email-input"]')).toBeVisible();
  }
}