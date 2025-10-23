import { Request, Response } from 'express';
import { AuthController } from '../AuthController';
import { AuthService } from '../../services/AuthService';

// Mock the AuthService
jest.mock('../../services/AuthService');

describe('AuthController', () => {
  let authController: AuthController;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthService = {
      requestMagicLink: jest.fn(),
      verifyMagicLink: jest.fn(),
      refreshAccessToken: jest.fn(),
      updateProfile: jest.fn(),
    } as any;

    const mockUnifiedInvitationService = {
      validateFamilyInvitation: jest.fn(),
      validateGroupInvitation: jest.fn(),
      acceptFamilyInvitation: jest.fn(),
      acceptGroupInvitation: jest.fn(),
    } as any;

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    authController = new AuthController(mockAuthService, mockUnifiedInvitationService, mockLogger);

    mockRequest = {
      body: {},
      params: {},
      query: {},
      headers: {},
      ip: '127.0.0.1',
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('requestMagicLink', () => {
    it('should request magic link successfully', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      mockRequest.body = { email, name, code_challenge: codeChallenge };

      const mockResult = {
        success: true,
        userExists: false,
      };

      mockAuthService.requestMagicLink.mockResolvedValue(mockResult);

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, name, platform: 'web', code_challenge: codeChallenge });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Magic link sent to your email',
          userExists: false,
        },
      });
    });

    it('should handle invalid email format', async () => {
      mockRequest.body = { email: 'invalid-email', name: 'Test User' };

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid input data',
        }),
      );
    });

    it('should handle missing email', async () => {
      mockRequest.body = { name: 'Test User' };

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should handle service errors', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      mockRequest.body = { email, name, code_challenge: codeChallenge };

      const error = new Error('Service error');
      mockAuthService.requestMagicLink.mockRejectedValue(error);

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, name, platform: 'web', code_challenge: codeChallenge });
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Service error',
        }),
      );
    });

    it('should handle name required for new users error with 422 status', async () => {
      const email = 'newuser@example.com';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      mockRequest.body = { email, code_challenge: codeChallenge }; // No name provided

      const error = new Error('Name is required for new users');
      mockAuthService.requestMagicLink.mockRejectedValue(error);

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, platform: 'web', code_challenge: codeChallenge });
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Name is required for new users',
        }),
      );
    });
    // PKCE Security Tests - Code challenge validation
    it('should request magic link with valid PKCE code_challenge successfully', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      mockRequest.body = { email, name, code_challenge: codeChallenge };

      const mockResult = {
        success: true,
        userExists: false,
      };

      mockAuthService.requestMagicLink.mockResolvedValue(mockResult);

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ 
        email, 
        name, 
        platform: 'web',
        code_challenge: codeChallenge, 
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Magic link sent to your email',
          userExists: false,
        },
      });
    });

    it('should reject magic link request with invalid PKCE code_challenge format', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const invalidCodeChallenge = 'too-short';
      mockRequest.body = { email, name, code_challenge: invalidCodeChallenge };

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid input data',
        }),
      );
    });
  });

  describe('verifyMagicLink', () => {
    it('should verify magic link successfully', async () => {
      const token = 'valid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      mockRequest.body = { token, code_verifier: codeVerifier };

      const mockResult = {
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC', createdAt: new Date(), updatedAt: new Date() },
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        token: 'jwt-access-token', // Legacy field
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockAuthService.verifyMagicLink.mockResolvedValue(mockResult);

      await authController.verifyMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith(token, codeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...mockResult,
          invitationResult: null,
        },
      });
    });

    it('should handle invalid token', async () => {
      mockRequest.body = { token: '' };

      await authController.verifyMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyMagicLink).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('should handle verification failure', async () => {
      const token = 'invalid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      mockRequest.body = { token, code_verifier: codeVerifier };

      const error = new Error('Invalid or expired token');
      mockAuthService.verifyMagicLink.mockRejectedValue(error);

      await authController.verifyMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith(token, codeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // PKCE Security Tests - Cross-user attack prevention
    it('should verify magic link with PKCE code_verifier successfully', async () => {
      const token = 'valid-token';
      const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      mockRequest.body = { token, code_verifier: codeVerifier };

      const mockResult = {
        user: { id: 'user-1', email: 'test@example.com', name: 'Test User', timezone: 'UTC', createdAt: new Date(), updatedAt: new Date() },
        accessToken: 'jwt-access-token',
        refreshToken: 'jwt-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
        token: 'jwt-access-token', // Legacy field
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      };

      mockAuthService.verifyMagicLink.mockResolvedValue(mockResult);

      await authController.verifyMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith(token, codeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          ...mockResult,
          invitationResult: null,
        },
      });
    });

    it('should reject magic link verification with invalid PKCE code_verifier', async () => {
      const token = 'valid-token';
      const invalidCodeVerifier = 'wrongcode_verifier_that_is_long_enough_to_pass_validation_but_wont_match_stored_challenge_hash'; // 43+ chars but wrong value
      mockRequest.body = { token, code_verifier: invalidCodeVerifier };

      const error = new Error('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
      mockAuthService.verifyMagicLink.mockRejectedValue(error);

      await authController.verifyMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.verifyMagicLink).toHaveBeenCalledWith(token, invalidCodeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(401); // Security sanitization returns 401 for SECURITY errors
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining('SECURITY'),
        }),
      );
    });

    it('should reject magic link verification when code_verifier is missing (schema validation)', async () => {
      const token = 'valid-token';
      mockRequest.body = { token }; // Missing code_verifier - should fail schema validation

      await authController.verifyMagicLink(mockRequest as Request, mockResponse as Response);

      // Should not call service because schema validation fails first
      expect(mockAuthService.verifyMagicLink).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid input data',
        }),
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const refreshToken = 'valid-refresh-token';
      mockRequest.body = { refreshToken }; // ✅ NEW: Token in body, not header

      const mockResult = {
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 900,
        tokenType: 'Bearer',
      };

      mockAuthService.refreshAccessToken.mockResolvedValue(mockResult);

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should handle invalid refresh token', async () => {
      const refreshToken = 'invalid-refresh-token';
      mockRequest.body = { refreshToken }; // ✅ NEW: Token in body, not header

      const error = new Error('Invalid refresh token');
      mockAuthService.refreshAccessToken.mockRejectedValue(error);

      await authController.refreshToken(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(refreshToken);
      expect(mockResponse.status).toHaveBeenCalledWith(401); // ✅ NEW: 401 for refresh failures
    });
  });

  describe('updateTimezone', () => {
    it('should update timezone successfully and return complete user profile', async () => {
      const userId = 'user-123';
      const timezone = 'Europe/London';

      mockRequest.body = { timezone };
      (mockRequest as any).user = { id: userId };

      const mockUpdatedUser = {
        id: userId,
        email: 'test@example.com',
        name: 'Test',
        timezone,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      mockAuthService.updateProfile.mockResolvedValue(mockUpdatedUser);

      await authController.updateTimezone(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(userId, { timezone });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockUpdatedUser,
      });
    });

    it('should handle authentication required error', async () => {
      mockRequest.body = { timezone: 'America/New_York' };
      (mockRequest as any).user = undefined;

      await authController.updateTimezone(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'User authentication required',
      });
    });

    it('should handle invalid timezone format', async () => {
      const userId = 'user-123';
      mockRequest.body = { timezone: 'Invalid/Timezone' };
      (mockRequest as any).user = { id: userId };

      await authController.updateTimezone(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid input data',
        validationErrors: [
          {
            field: 'timezone',
            message: 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"',
          },
        ],
      });
    });

    it('should handle missing timezone in request body', async () => {
      const userId = 'user-123';
      mockRequest.body = {};
      (mockRequest as any).user = { id: userId };

      await authController.updateTimezone(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.updateProfile).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid input data',
        }),
      );
    });

    it('should handle service errors', async () => {
      const userId = 'user-123';
      const timezone = 'Asia/Tokyo';

      mockRequest.body = { timezone };
      (mockRequest as any).user = { id: userId };

      const error = new Error('Database connection failed');
      mockAuthService.updateProfile.mockRejectedValue(error);

      await authController.updateTimezone(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.updateProfile).toHaveBeenCalledWith(userId, { timezone });
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database connection failed',
      });
    });

    it('should validate various valid timezone formats', async () => {
      const userId = 'user-123';
      const validTimezones = [
        'America/New_York',
        'Europe/Paris',
        'Asia/Tokyo',
        'Australia/Sydney',
        'UTC',
      ];

      for (const timezone of validTimezones) {
        jest.clearAllMocks();

        mockRequest.body = { timezone };
        (mockRequest as any).user = { id: userId };

        const mockUpdatedUser = {
          id: userId,
          email: 'test@example.com',
          name: 'Test',
          timezone,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        mockAuthService.updateProfile.mockResolvedValue(mockUpdatedUser);

        await authController.updateTimezone(mockRequest as Request, mockResponse as Response);

        expect(mockAuthService.updateProfile).toHaveBeenCalledWith(userId, { timezone });
        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          data: mockUpdatedUser,
        });
      }
    });

    it('should return complete user profile structure matching updateProfile endpoint', async () => {
      const userId = 'user-123';
      const timezone = 'Pacific/Auckland';

      mockRequest.body = { timezone };
      (mockRequest as any).user = { id: userId };

      const mockUpdatedUser = {
        id: userId,
        email: 'user@example.com',
        name: 'John',
        timezone,
        createdAt: new Date('2024-01-01T00:00:00Z'),
        updatedAt: new Date('2024-01-02T00:00:00Z'),
      };

      mockAuthService.updateProfile.mockResolvedValue(mockUpdatedUser);

      await authController.updateTimezone(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: userId,
          email: 'user@example.com',
          name: 'John',
          timezone,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      });
    });
  });
});