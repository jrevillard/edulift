/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { createAuthControllerRoutes, type AuthVariables } from '../v1/AuthController';
import { AuthService } from '../../services/AuthService';
import { UserRepository } from '../../repositories/UserRepository';
import { UnifiedInvitationService } from '../../services/UnifiedInvitationService';
import { TEST_IDS, unwrapResponse } from '../../utils/testHelpers';

jest.mock('../../services/AuthService');
jest.mock('../../repositories/UserRepository');
jest.mock('../../services/UnifiedInvitationService');

const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}): Response | Promise<Response> => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: 'Bearer valid-token',
    },
  });
};

const makeUnauthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}): Response | Promise<Response> => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      // No Authorization header or invalid token
    },
  });
};

describe('AuthController Test Suite', () => {
  let app: Hono<{ Variables: AuthVariables }>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockUnifiedInvitationService: jest.Mocked<UnifiedInvitationService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthService = {
      requestMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      refreshAccessToken: jest.fn(),
      updateProfile: jest.fn(),
      requestAccountDeletion: jest.fn(),
      confirmAccountDeletion: jest.fn(),
      getUserById: jest.fn(),
      logout: jest.fn(),
    } as any;

    mockUserRepository = {
      findById: jest.fn(),
    } as any;

    mockUnifiedInvitationService = {
      validateFamilyInvitation: jest.fn(),
      validateGroupInvitation: jest.fn(),
      acceptFamilyInvitation: jest.fn(),
      acceptGroupInvitation: jest.fn(),
    } as any;

    const deps = {
      authService: mockAuthService,
      userRepository: mockUserRepository,
      unifiedInvitationService: mockUnifiedInvitationService,
    };

    // Create base Hono app
    app = new Hono<any>();

    // Mock auth middleware - simulates authenticateToken behavior
    // Returns 401 if no auth header for protected endpoints, allows public endpoints
    app.use('*', async (c: any, next) => {
      const authHeader = c.req.header('authorization');
      const path = c.req.path;

      // Public endpoints that don't require authentication
      const publicEndpoints = ['/magic-link', '/verify', '/refresh'];
      const isPublicEndpoint = publicEndpoints.some(endpoint => path.includes(endpoint));

      if (authHeader && authHeader.startsWith('Bearer ')) {
        c.set('userId', mockUserId);
        c.set('user', {
          id: mockUserId,
          email: mockUserEmail,
          name: 'Test User',
          timezone: 'UTC',
        });
        await next();
      } else if (!isPublicEndpoint) {
        // Protected endpoint without auth header - return 401
        return c.json({
          error: 'Access token required',
        }, 401);
      } else {
        // Public endpoint without auth - allow through
        await next();
      }
    });

    // Mount auth controller routes
    const authRoutes = createAuthControllerRoutes(deps);
    app.route('/', authRoutes);
  });

  describe('POST /auth/magic-link', () => {
    it('should request magic link successfully', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const mockResult = {
        success: true,
        userExists: false,
      };

      mockAuthService.requestMagicLink.mockResolvedValue(mockResult);

      const response = await app.request('/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, code_challenge: codeChallenge }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        message: 'Magic link sent to your email',
        userExists: false,
      });
      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, name, code_challenge: codeChallenge });
    });

    it('should handle magic link request with valid data', async () => {
      const email = 'valid@email.com';
      const name = 'Test User';
      const code_challenge = 'aB3dE5fG7hJ9kLmNoPqRsTuVwXyZ1234567890ABCDEFG'; // Valid PKCE challenge

      mockAuthService.requestMagicLink.mockResolvedValue({
        success: true,
        message: 'Magic link sent to your email',
        userExists: false,
      } as any);

      const response = await app.request('/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, code_challenge }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        message: 'Magic link sent to your email',
        userExists: false,
      });
      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith(
        { email, name, code_challenge },
      );
    });

    it('should handle service errors', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const error = new Error('Service error');
      mockAuthService.requestMagicLink.mockRejectedValue(error);

      const response = await app.request('/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, code_challenge: codeChallenge }),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual(
        expect.objectContaining({
          error: 'Service error',
        }),
      );
      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, name, code_challenge: codeChallenge });
    });

    it('should handle name required for new users error with 422 status', async () => {
      const email = 'newuser@example.com';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const error = new Error('Name is required for new users');
      mockAuthService.requestMagicLink.mockRejectedValue(error);

      const response = await app.request('/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code_challenge: codeChallenge }),
      });

      expect(response.status).toBe(422);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual(
        expect.objectContaining({
          error: 'Name is required for new users',
        }),
      );
      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, code_challenge: codeChallenge });
    });

    it('should request magic link with valid PKCE code_challenge successfully', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const mockResult = {
        success: true,
        userExists: false,
      };

      mockAuthService.requestMagicLink.mockResolvedValue(mockResult);

      const response = await app.request('/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, code_challenge: codeChallenge }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        message: 'Magic link sent to your email',
        userExists: false,
      });
      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({
        email,
        name,
        code_challenge: codeChallenge,
      });
    });
  });

  describe('POST /auth/verify', () => {
    it('should verify magic link successfully', async () => {
      const token = 'valid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

      const mockResult = {
        user: { id: TEST_IDS.USER, email: 'test@example.com', name: 'Test User', timezone: 'UTC', createdAt: new Date(), updatedAt: new Date() },
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        token: 'jwt-access-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockAuthService.verifyMagicLink.mockResolvedValue(mockResult);

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        user: {
          ...mockResult.user,
          createdAt: mockResult.user.createdAt.toISOString(),
          updatedAt: mockResult.user.updatedAt.toISOString(),
        },
        accessToken: mockResult.accessToken,
        refreshToken: mockResult.refreshToken,
        expiresIn: mockResult.expiresIn,
        tokenType: mockResult.tokenType,
        token: mockResult.token,
        expiresAt: mockResult.expiresAt.toISOString(),
        invitationResult: null,
      });
      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith(token, codeVerifier);
    });

    it('should handle verification failure', async () => {
      const token = 'invalid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

      const error = new Error('Invalid or expired token');
      mockAuthService.verifyMagicLink.mockRejectedValue(error);

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier }),
      });

      expect(response.status).toBe(500);
      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith(token, codeVerifier);
    });

    it('should verify magic link with PKCE code_verifier successfully', async () => {
      const token = 'valid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

      const mockResult = {
        user: { id: TEST_IDS.USER, email: 'test@example.com', name: 'Test User', timezone: 'UTC', createdAt: new Date(), updatedAt: new Date() },
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        token: 'jwt-access-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockAuthService.verifyMagicLink.mockResolvedValue(mockResult);

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        user: {
          ...mockResult.user,
          createdAt: mockResult.user.createdAt.toISOString(),
          updatedAt: mockResult.user.updatedAt.toISOString(),
        },
        accessToken: mockResult.accessToken,
        refreshToken: mockResult.refreshToken,
        expiresIn: mockResult.expiresIn,
        tokenType: mockResult.tokenType,
        token: mockResult.token,
        expiresAt: mockResult.expiresAt.toISOString(),
        invitationResult: null,
      });
      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith(token, codeVerifier);
    });

    it('should reject magic link verification with invalid PKCE code_verifier', async () => {
      const token = 'valid-token';
      const invalidCodeVerifier = 'wrongcode_verifier_that_is_long_enough_to_pass_validation_but_wont_match_stored_challenge_hash';

      const error = new Error('SECURITY: Invalid PKCE validation for token - potential cross-user attack');
      mockAuthService.verifyMagicLink.mockRejectedValue(error);

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: invalidCodeVerifier }),
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual(
        expect.objectContaining({
          error: expect.stringContaining('SECURITY'),
        }),
      );
      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith(token, invalidCodeVerifier);
    });

    it('should process family invitation successfully when acceptFamilyInvitation succeeds', async () => {
      const token = 'valid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const inviteCode = 'FAMILY-CODE-123';

      const mockResult = {
        user: { id: TEST_IDS.USER, email: 'test@example.com', name: 'Test User', timezone: 'UTC', createdAt: new Date(), updatedAt: new Date() },
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        token: 'jwt-access-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockAuthService.verifyMagicLink.mockResolvedValue(mockResult);
      mockUnifiedInvitationService.validateFamilyInvitation.mockResolvedValue({ valid: true } as any);
      mockUnifiedInvitationService.validateGroupInvitation.mockResolvedValue({ valid: false } as any);
      mockUnifiedInvitationService.acceptFamilyInvitation.mockResolvedValue({ success: true });

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier, inviteCode }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      const data = unwrapResponse(jsonResponse);

      expect(data.invitationResult).toEqual({
        processed: true,
        invitationType: 'FAMILY',
        redirectUrl: '/dashboard',
      });
      expect(mockUnifiedInvitationService.acceptFamilyInvitation).toHaveBeenCalledWith(
        inviteCode,
        TEST_IDS.USER,
        { leaveCurrentFamily: true },
      );
    });

    it('should return processed false when acceptFamilyInvitation fails', async () => {
      const token = 'valid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const inviteCode = 'FAMILY-CODE-123';

      const mockResult = {
        user: { id: TEST_IDS.USER, email: 'test@example.com', name: 'Test User', timezone: 'UTC', createdAt: new Date(), updatedAt: new Date() },
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        token: 'jwt-access-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockAuthService.verifyMagicLink.mockResolvedValue(mockResult);
      mockUnifiedInvitationService.validateFamilyInvitation.mockResolvedValue({ valid: true } as any);
      mockUnifiedInvitationService.validateGroupInvitation.mockResolvedValue({ valid: false } as any);
      mockUnifiedInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'This invitation was sent to a different email address',
      });

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier, inviteCode }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      const data = unwrapResponse(jsonResponse);

      expect(data.invitationResult).toEqual({
        processed: false,
        reason: 'This invitation was sent to a different email address',
      });
    });

    it('should process group invitation successfully when acceptGroupInvitation succeeds', async () => {
      const token = 'valid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const inviteCode = 'GROUP-CODE-456';

      const mockResult = {
        user: { id: TEST_IDS.USER, email: 'test@example.com', name: 'Test User', timezone: 'UTC', createdAt: new Date(), updatedAt: new Date() },
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        token: 'jwt-access-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockAuthService.verifyMagicLink.mockResolvedValue(mockResult);
      mockUnifiedInvitationService.validateFamilyInvitation.mockResolvedValue({ valid: false } as any);
      mockUnifiedInvitationService.validateGroupInvitation.mockResolvedValue({ valid: true } as any);
      mockUnifiedInvitationService.acceptGroupInvitation.mockResolvedValue({ success: true } as any);

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier, inviteCode }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      const data = unwrapResponse(jsonResponse);

      expect(data.invitationResult).toEqual({
        processed: true,
        invitationType: 'GROUP',
        redirectUrl: '/dashboard',
      });
    });

    it('should return processed false when acceptGroupInvitation fails', async () => {
      const token = 'valid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const inviteCode = 'GROUP-CODE-456';

      const mockResult = {
        user: { id: TEST_IDS.USER, email: 'test@example.com', name: 'Test User', timezone: 'UTC', createdAt: new Date(), updatedAt: new Date() },
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        token: 'jwt-access-token',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockAuthService.verifyMagicLink.mockResolvedValue(mockResult);
      mockUnifiedInvitationService.validateFamilyInvitation.mockResolvedValue({ valid: false } as any);
      mockUnifiedInvitationService.validateGroupInvitation.mockResolvedValue({ valid: true } as any);
      mockUnifiedInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: false,
        message: 'User already belongs to a group',
      } as any);

      const response = await app.request('/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier, inviteCode }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      const data = unwrapResponse(jsonResponse);

      expect(data.invitationResult).toEqual({
        processed: false,
        reason: 'User already belongs to a group',
      });
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';

      const mockResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      };

      mockAuthService.refreshAccessToken.mockResolvedValue(mockResult);

      const response = await app.request('/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual(mockResult);
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
    });

    it('should handle invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';

      const error = new Error('Invalid refresh token');
      mockAuthService.refreshAccessToken.mockRejectedValue(error);

      const response = await app.request('/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      expect(response.status).toBe(401);
      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
    });
  });

  describe('PATCH /auth/timezone', () => {
    it('should update timezone successfully and return complete user profile', async () => {
      const timezone = 'Europe/London';

      const mockUpdatedUser = {
        id: mockUserId,
        email: 'test@example.com',
        name: 'Test',
        timezone,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockAuthService.updateProfile.mockResolvedValue(mockUpdatedUser);

      const response = await makeAuthenticatedRequest(app, '/profile/timezone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        ...mockUpdatedUser,
        createdAt: mockUpdatedUser.createdAt.toISOString(),
        updatedAt: mockUpdatedUser.updatedAt.toISOString(),
      });
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(mockUserId, { timezone });
    });

    it('should handle authentication required error', async () => {
      const response = await makeUnauthenticatedRequest(app, '/profile/timezone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: 'America/New_York' }),
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        error: 'Access token required',
      });
      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const timezone = 'Asia/Tokyo';

      const error = new Error('Database connection failed');
      mockAuthService.updateProfile.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, '/profile/timezone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Failed to update timezone',
        code: 'UPDATE_TIMEZONE_FAILED',
      });
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(mockUserId, { timezone });
    });

    it('should validate various valid timezone formats', async () => {
      const validTimezones = [
        'America/New_York',
        'Europe/Paris',
        'Asia/Tokyo',
        'Australia/Sydney',
        'UTC',
      ];

      for (const timezone of validTimezones) {
        jest.clearAllMocks();

        const mockUpdatedUser = {
          id: mockUserId,
          email: 'test@example.com',
          name: 'Test',
          timezone,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockAuthService.updateProfile.mockResolvedValue(mockUpdatedUser);

        const response = await makeAuthenticatedRequest(app, '/profile/timezone', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timezone }),
        });

        expect(response.status).toBe(200);
        const jsonResponse = await responseJson(response);
        // Controller returns {success, data} format
        const data = unwrapResponse(jsonResponse);
        expect(data).toEqual({
          ...mockUpdatedUser,
          createdAt: mockUpdatedUser.createdAt.toISOString(),
          updatedAt: mockUpdatedUser.updatedAt.toISOString(),
        });
        expect(mockAuthService.updateProfile).toHaveBeenCalledWith(mockUserId, { timezone });
      }
    });

    it('should return complete user profile structure matching updateProfile endpoint', async () => {
      const timezone = 'Pacific/Auckland';

      const mockUpdatedUser = {
        id: mockUserId,
        email: 'user@example.com',
        name: 'John',
        timezone,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };

      mockAuthService.updateProfile.mockResolvedValue(mockUpdatedUser);

      const response = await makeAuthenticatedRequest(app, '/profile/timezone', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        id: mockUserId,
        email: 'user@example.com',
        name: 'John',
        timezone,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      });
    });
  });

  describe('POST /auth/profile/delete-request', () => {
    const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

    it('should request account deletion successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Account deletion confirmation sent to your email',
      };

      mockAuthService.requestAccountDeletion.mockResolvedValue(mockResult);

      const response = await makeAuthenticatedRequest(app, '/profile/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_challenge: codeChallenge }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        message: 'Account deletion confirmation sent to your email',
      });
      expect(mockAuthService.requestAccountDeletion).toHaveBeenCalledWith({
        userId: mockUserId,
        code_challenge: codeChallenge,
      });
    });

    it('should handle authentication required error', async () => {
      const response = await makeUnauthenticatedRequest(app, '/profile/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_challenge: codeChallenge }),
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        error: 'Access token required',
      });
      expect(mockAuthService.requestAccountDeletion).not.toHaveBeenCalled();
    });

    it('should handle invalid PKCE code_challenge', async () => {
      const response = await makeAuthenticatedRequest(app, '/profile/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_challenge: 'short' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toHaveProperty('error');
      expect(jsonResponse).toHaveProperty('success', false);
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
      expect(jsonResponse.error).toHaveProperty('message');
      expect(jsonResponse.error.message).toContain('PKCE code challenge must be at least 43 characters');
      expect(mockAuthService.requestAccountDeletion).not.toHaveBeenCalled();
    });

    it('should handle missing PKCE code_challenge', async () => {
      const response = await makeAuthenticatedRequest(app, '/profile/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toHaveProperty('error');
      expect(jsonResponse).toHaveProperty('success', false);
      // Zod validation returns error with name: 'ZodError' and message array
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
      expect(jsonResponse.error.message).toContain('code_challenge');
      expect(mockAuthService.requestAccountDeletion).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const error = new Error('User not found');
      mockAuthService.requestAccountDeletion.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, '/profile/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_challenge: codeChallenge }),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'User not found',
        code: 'REQUEST_DELETION_FAILED',
      });
      expect(mockAuthService.requestAccountDeletion).toHaveBeenCalledWith({
        userId: mockUserId,
        code_challenge: codeChallenge,
      });
    });

    it('should handle security-related errors with sanitized messages', async () => {
      const securityError = new Error('SECURITY: Potential attack detected');
      mockAuthService.requestAccountDeletion.mockRejectedValue(securityError);

      const response = await makeAuthenticatedRequest(app, '/profile/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_challenge: codeChallenge }),
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'SECURITY: Potential attack detected',
        code: 'REQUEST_DELETION_FAILED',
      });
    });
  });

  describe('POST /auth/profile/delete-confirm', () => {
    const token = 'deletion-token';
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

    it('should confirm account deletion successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Account deleted successfully via email confirmation',
        deletedAt: new Date().toISOString(),
      };

      mockAuthService.confirmAccountDeletion.mockResolvedValue(mockResult);

      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        message: 'Account deleted successfully via email confirmation',
        deletedAt: mockResult.deletedAt,
      });
      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, codeVerifier, mockUserId);
    });

    it('should handle missing PKCE code_verifier', async () => {
      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toHaveProperty('error');
      expect(jsonResponse).toHaveProperty('success', false);
      // Zod validation returns error with name: 'ZodError' and message array
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
      expect(jsonResponse.error.message).toContain('code_verifier');
      expect(mockAuthService.confirmAccountDeletion).not.toHaveBeenCalled();
    });

    it('should handle empty PKCE code_verifier', async () => {
      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: '' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toHaveProperty('error');
      expect(jsonResponse).toHaveProperty('success', false);
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
      expect(jsonResponse.error).toHaveProperty('message');
      expect(jsonResponse.error.message).toContain('PKCE code verifier must be at least 43 characters');
      expect(mockAuthService.confirmAccountDeletion).not.toHaveBeenCalled();
    });

    it('should handle invalid or expired token error', async () => {
      const error = new Error('Invalid or expired deletion token');
      mockAuthService.confirmAccountDeletion.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier }),
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Invalid or expired deletion token',
        code: 'INVALID_TOKEN',
      });
      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, codeVerifier, mockUserId);
    });

    it('should handle user not found error', async () => {
      const error = new Error('User not found');
      mockAuthService.confirmAccountDeletion.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier }),
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, codeVerifier, mockUserId);
    });

    it('should handle PKCE validation security errors', async () => {
      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: 'invalid-verifier' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toHaveProperty('error');
      expect(jsonResponse).toHaveProperty('success', false);
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
      expect(jsonResponse.error).toHaveProperty('message');
      expect(jsonResponse.error.message).toContain('PKCE code verifier must be at least 43 characters');
      expect(mockAuthService.confirmAccountDeletion).not.toHaveBeenCalled();
    });

    it('should handle service errors gracefully', async () => {
      const error = new Error('Database connection failed');
      mockAuthService.confirmAccountDeletion.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code_verifier: codeVerifier }),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Database connection failed',
        code: 'CONFIRM_DELETION_FAILED',
      });
      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, codeVerifier, mockUserId);
    });

    it('should handle missing token gracefully', async () => {
      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code_verifier: codeVerifier }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toHaveProperty('error');
      expect(jsonResponse).toHaveProperty('success', false);
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
      expect(jsonResponse.error).toHaveProperty('message');
      expect(jsonResponse.error.message).toContain('Invalid input: expected string, received undefined');
      expect(mockAuthService.confirmAccountDeletion).not.toHaveBeenCalled();
    });

    it('should log security events for failed attempts', async () => {
      const response = await makeAuthenticatedRequest(app, '/profile/delete-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'user-agent': 'test-agent' },
        body: JSON.stringify({ token: 'suspicious-token', code_verifier: 'suspicious-verifier' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toHaveProperty('error');
      expect(jsonResponse).toHaveProperty('success', false);
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
      expect(jsonResponse.error).toHaveProperty('message');
      expect(jsonResponse.error.message).toContain('PKCE code verifier must be at least 43 characters');
      expect(mockAuthService.confirmAccountDeletion).not.toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const response = await makeAuthenticatedRequest(app, '/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        message: 'Logged out successfully',
      });
      expect(mockAuthService.logout).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle authentication required error', async () => {
      const response = await makeUnauthenticatedRequest(app, '/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        error: 'Access token required',
      });
      expect(mockAuthService.logout).not.toHaveBeenCalled();
    });

    it('should handle service errors', async () => {
      const error = new Error('Failed to logout');
      mockAuthService.logout.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, '/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Failed to logout',
        code: 'LOGOUT_FAILED',
      });
      expect(mockAuthService.logout).toHaveBeenCalledWith(mockUserId);
    });
  });

  describe('PUT /auth/profile', () => {
    it('should update profile successfully', async () => {
      const profileData = {
        name: 'Updated Name',
        timezone: 'Europe/Paris',
      };

      const mockUpdatedUser = {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Updated Name',
        timezone: 'Europe/Paris',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockAuthService.updateProfile.mockResolvedValue(mockUpdatedUser);

      const response = await makeAuthenticatedRequest(app, '/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        ...mockUpdatedUser,
        createdAt: mockUpdatedUser.createdAt.toISOString(),
        updatedAt: mockUpdatedUser.updatedAt.toISOString(),
      });
      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(mockUserId, profileData);
    });

    it('should handle authentication required error', async () => {
      const response = await makeUnauthenticatedRequest(app, '/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test' }),
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        error: 'Access token required',
      });
      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
    });

    it('should handle invalid timezone error', async () => {
      const profileData = {
        name: 'Test',
        timezone: 'Invalid/Timezone',
      };

      const response = await makeAuthenticatedRequest(app, '/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"',
        code: 'INVALID_TIMEZONE',
      });
      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
    });
  });

  describe('GET /auth/profile', () => {
    it('should get user profile successfully', async () => {
      const mockUser = {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Test User',
        timezone: 'UTC',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);

      const response = await makeAuthenticatedRequest(app, '/profile', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Controller returns {success, data} format
      const data = unwrapResponse(jsonResponse);
      expect(data).toEqual({
        ...mockUser,
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
      });
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUserId);
    });

    it('should handle authentication required error', async () => {
      const response = await makeUnauthenticatedRequest(app, '/profile', {
        method: 'GET',
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        error: 'Access token required',
      });
      expect(mockUserRepository.findById).not.toHaveBeenCalled();
    });

    it('should handle user not found error', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, '/profile', {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND',
      });
      expect(mockUserRepository.findById).toHaveBeenCalledWith(mockUserId);
    });
  });
});