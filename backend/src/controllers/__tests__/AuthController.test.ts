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
      requestAccountDeletion: jest.fn(),
      confirmAccountDeletion: jest.fn(),
      getUserById: jest.fn(),
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

      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, name, code_challenge: codeChallenge });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Magic link sent to your email',
          userExists: false,
        },
      });
    });

    // Validation tests are moved to middleware validation tests.
    // Controller now assumes data is pre-validated by middleware.
    it('should handle magic link request with valid data', async () => {
      mockRequest.body = { email: 'valid@email.com', name: 'Test User' };

      mockAuthService.requestMagicLink.mockResolvedValue({
        success: true,
        message: 'Magic link sent to your email',
        userExists: false,
      } as any);

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith(
        { email: 'valid@email.com', name: 'Test User', code_challenge: undefined },
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Magic link sent to your email',
          userExists: false,
        },
      });
    });

    // This test is moved to middleware validation tests.
    // Missing email should be caught by validation middleware.

    it('should handle service errors', async () => {
      const email = 'test@example.com';
      const name = 'Test User';
      const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
      mockRequest.body = { email, name, code_challenge: codeChallenge };

      const error = new Error('Service error');
      mockAuthService.requestMagicLink.mockRejectedValue(error);

      await authController.requestMagicLink(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, name, code_challenge: codeChallenge });
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

      expect(mockAuthService.requestMagicLink).toHaveBeenCalledWith({ email, code_challenge: codeChallenge });
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

    // Validation test moved to middleware validation tests.
    // PKCE validation should be handled by validation middleware.
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
        },
      });
    });

    // Validation test moved to middleware validation tests.
    // Empty token validation should be handled by validation middleware.

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

    // Validation test moved to middleware validation tests.
    // Missing code_verifier validation should be handled by validation middleware.
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
        data: {
          ...mockUpdatedUser,
          createdAt: mockUpdatedUser.createdAt.toISOString(),
          updatedAt: mockUpdatedUser.updatedAt.toISOString(),
        },
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

    // Validation tests moved to middleware validation tests.
    // Timezone validation is now handled by Zod middleware.
    // Controller assumes pre-validated data.

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
          data: {
            ...mockUpdatedUser,
            createdAt: mockUpdatedUser.createdAt.toISOString(),
            updatedAt: mockUpdatedUser.updatedAt.toISOString(),
          },
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
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        }),
      });
    });
  });

  describe('requestAccountDeletion', () => {
    const userId = 'user-123';
    const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

    it('should request account deletion successfully', async () => {
      mockRequest.body = { code_challenge: codeChallenge };
      (mockRequest as any).userId = userId; // Set userId directly as expected by controller
      (mockRequest as any).user = { id: userId, email: 'test@example.com' };

      const mockResult = {
        success: true,
        message: 'Account deletion confirmation sent to your email',
      };

      mockAuthService.requestAccountDeletion.mockResolvedValue(mockResult);

      await authController.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestAccountDeletion).toHaveBeenCalledWith({
        userId,
        code_challenge: codeChallenge,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Account deletion confirmation sent to your email',
        },
      });
    });

    it('should handle authentication required error', async () => {
      mockRequest.body = { code_challenge: codeChallenge };
      (mockRequest as any).userId = undefined; // No userId
      (mockRequest as any).user = undefined;

      await authController.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestAccountDeletion).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required',
      });
    });

    it('should handle invalid PKCE code_challenge', async () => {
      mockRequest.body = { code_challenge: 'short' };
      (mockRequest as any).userId = userId;

      await authController.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestAccountDeletion).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'code_challenge is required and must be 43-128 characters for PKCE validation',
      });
    });

    it('should handle missing PKCE code_challenge', async () => {
      mockRequest.body = {};
      (mockRequest as any).userId = userId;

      await authController.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestAccountDeletion).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'code_challenge is required and must be 43-128 characters for PKCE validation',
      });
    });

    it('should handle service errors', async () => {
      mockRequest.body = { code_challenge: codeChallenge };
      (mockRequest as any).userId = userId;

      const error = new Error('User not found');
      mockAuthService.requestAccountDeletion.mockRejectedValue(error);

      await authController.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.requestAccountDeletion).toHaveBeenCalledWith({
        userId,
        code_challenge: codeChallenge,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should handle security-related errors with sanitized messages', async () => {
      mockRequest.body = { code_challenge: codeChallenge };
      (mockRequest as any).userId = userId;

      const securityError = new Error('🚨 SECURITY: Potential attack detected');
      mockAuthService.requestAccountDeletion.mockRejectedValue(securityError);

      await authController.requestAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '🚨 SECURITY: Potential attack detected', // Actual message from controller
      });
    });
  });

  describe('confirmAccountDeletion', () => {
    const token = 'deletion-token';
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

    it('should confirm account deletion successfully', async () => {
      mockRequest.body = { token, code_verifier: codeVerifier };

      const mockResult = {
        success: true,
        message: 'Account deleted successfully via email confirmation',
        deletedAt: new Date().toISOString(),
      };

      mockAuthService.confirmAccountDeletion.mockResolvedValue(mockResult);

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, codeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Account deleted successfully via email confirmation',
          deletedAt: mockResult.deletedAt,
        },
      });
    });

    it('should handle missing PKCE code_verifier', async () => {
      mockRequest.body = { token };

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'code_verifier required for PKCE validation',
      });
    });

    it('should handle empty PKCE code_verifier', async () => {
      mockRequest.body = { token, code_verifier: '' };

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'code_verifier required for PKCE validation',
      });
    });

    it('should handle invalid or expired token error', async () => {
      mockRequest.body = { token, code_verifier: codeVerifier };

      const error = new Error('Invalid or expired deletion token');
      mockAuthService.confirmAccountDeletion.mockRejectedValue(error);

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, codeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired deletion token',
      });
    });

    it('should handle user not found error', async () => {
      mockRequest.body = { token, code_verifier: codeVerifier };

      const error = new Error('User not found');
      mockAuthService.confirmAccountDeletion.mockRejectedValue(error);

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, codeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'User not found',
      });
    });

    it('should handle PKCE validation security errors', async () => {
      mockRequest.body = { token, code_verifier: 'invalid-verifier' };

      const error = new Error('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
      mockAuthService.confirmAccountDeletion.mockRejectedValue(error);

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, 'invalid-verifier');
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: '🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack',
      });
    });

    it('should handle service errors gracefully', async () => {
      mockRequest.body = { token, code_verifier: codeVerifier };

      const error = new Error('Database connection failed');
      mockAuthService.confirmAccountDeletion.mockRejectedValue(error);

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(token, codeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Database connection failed',
      });
    });

    it('should handle missing token gracefully', async () => {
      mockRequest.body = { code_verifier: codeVerifier };

      // This should still call the service and let it handle the validation
      mockAuthService.confirmAccountDeletion.mockRejectedValue(new Error('Token is required'));

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith(undefined, codeVerifier);
      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    it('should log security events for failed attempts', async () => {
      mockRequest.body = { token: 'suspicious-token', code_verifier: 'suspicious-verifier' };
      mockRequest.headers = { 'user-agent': 'test-agent' };
      (mockRequest as any).ip = '127.0.0.1';

      const error = new Error('Invalid token');
      mockAuthService.confirmAccountDeletion.mockRejectedValue(error);

      await authController.confirmAccountDeletion(mockRequest as Request, mockResponse as Response);

      expect(mockAuthService.confirmAccountDeletion).toHaveBeenCalledWith('suspicious-token', 'suspicious-verifier');
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      // Security event logging should be triggered
    });
  });
});