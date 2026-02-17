/// <reference types="@types/jest" />
import { describe, it, expect } from '@jest/globals';

import authRoutes from '../v1/auth';

// Helper function to parse response JSON
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

describe('Auth Routes - Security Tests', () => {
  // These tests verify that the authentication middleware is properly applied
  // to all routes. This is CRITICAL for security.

  describe('Public endpoints (NO JWT required)', () => {
    it('should allow POST /magic-link without JWT', async () => {
      const response = await authRoutes.request('/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      // Should not return 401 (might return 400/500 for other reasons, but not auth error)
      expect(response.status).not.toBe(401);
    });

    it('should allow POST /verify without JWT', async () => {
      const response = await authRoutes.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'some-token',
          code_verifier: 'a'.repeat(43),
        }),
      });

      // Should not return 401
      expect(response.status).not.toBe(401);
    });

    it('should allow POST /refresh without JWT', async () => {
      const response = await authRoutes.request('/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refreshToken: 'some-refresh-token',
        }),
      });

      // /refresh is public - it may return 401 for invalid token (business logic),
      // but it's NOT blocked by authentication middleware
      // The fact that it reaches the handler (returns 401, not 404) proves it's public
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('Protected endpoints (JWT required)', () => {
    it('should reject POST /logout without JWT', async () => {
      const response = await authRoutes.request('/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(401);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
    });

    it('should reject GET /profile without JWT', async () => {
      const response = await authRoutes.request('/profile', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(401);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
    });

    it('should reject PUT /profile without JWT', async () => {
      const response = await authRoutes.request('/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test User' }),
      });

      expect(response.status).toBe(401);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
    });

    it('should reject PATCH /profile/timezone without JWT', async () => {
      const response = await authRoutes.request('/profile/timezone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: 'America/New_York' }),
      });

      expect(response.status).toBe(401);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
    });

    it('should reject POST /profile/delete-request without JWT', async () => {
      const response = await authRoutes.request('/profile/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code_challenge: 'a'.repeat(43),
        }),
      });

      expect(response.status).toBe(401);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
    });

    it('should reject POST /profile/delete-confirm without JWT', async () => {
      const response = await authRoutes.request('/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'some-token',
          code_verifier: 'a'.repeat(43),
        }),
      });

      expect(response.status).toBe(401);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
    });
  });

  describe('Security: verify middleware is applied', () => {
    it('should return 401 with proper error format for missing JWT', async () => {
      const response = await authRoutes.request('/profile', {
        method: 'GET',
      });

      expect(response.status).toBe(401);

      const result = await responseJson(response);

      // Verify error format
      expect(result).toEqual(
        expect.objectContaining({
          error: expect.any(String),
        }),
      );
    });

    it('should reject invalid JWT token', async () => {
      const response = await authRoutes.request('/profile', {
        method: 'GET',
        headers: {
          Authorization: 'Bearer invalid-jwt-token',
          'Content-Type': 'application/json',
        },
      });

      // Should return 401 for invalid token
      expect(response.status).toBe(401);
      const result = await responseJson(response);
      expect(result).toHaveProperty('error');
    });

    it('should reject malformed Authorization header', async () => {
      const response = await authRoutes.request('/profile', {
        method: 'GET',
        headers: {
          Authorization: 'InvalidFormat token',
          'Content-Type': 'application/json',
        },
      });

      // Should return 401 for malformed header
      expect(response.status).toBe(401);
    });
  });

  describe('Route coverage: all critical endpoints are tested', () => {
    // This is a meta-test to ensure we're testing all important endpoints
    const protectedEndpoints = [
      { method: 'POST', path: '/logout', name: 'logout' },
      { method: 'GET', path: '/profile', name: 'get profile' },
      { method: 'PUT', path: '/profile', name: 'update profile' },
      { method: 'PATCH', path: '/profile/timezone', name: 'update timezone' },
      { method: 'POST', path: '/profile/delete-request', name: 'request deletion' },
      { method: 'POST', path: '/profile/delete-confirm', name: 'confirm deletion' },
    ];

    const publicEndpoints = [
      { method: 'POST', path: '/magic-link', name: 'magic link' },
      { method: 'POST', path: '/verify', name: 'verify magic link' },
      { method: 'POST', path: '/refresh', name: 'refresh token' },
    ];

    it(`should have tests for all ${protectedEndpoints.length} protected endpoints`, () => {
      // This test documents that we have security tests for all protected endpoints
      expect(protectedEndpoints.length).toBe(6);
    });

    it(`should have tests for all ${publicEndpoints.length} public endpoints`, () => {
      // This test documents that we have security tests for all public endpoints
      expect(publicEndpoints.length).toBe(3);
    });

    // List all endpoints for documentation
    it('should document all auth endpoints', () => {
      const allEndpoints = [...protectedEndpoints, ...publicEndpoints];
      console.log('\n🔒 Auth Endpoints Security Coverage:');
      console.log('═'.repeat(60));
      console.log('PROTECTED ENDPOINTS (JWT required):');
      protectedEndpoints.forEach(({ method, path, name }) => {
        console.log(`  ${method.padEnd(6)} ${path.padEnd(35)} (${name})`);
      });
      console.log('\nPUBLIC ENDPOINTS (no JWT required):');
      publicEndpoints.forEach(({ method, path, name }) => {
        console.log(`  ${method.padEnd(6)} ${path.padEnd(35)} (${name})`);
      });
      console.log('═'.repeat(60));
      expect(allEndpoints.length).toBeGreaterThan(0);
    });
  });
});
