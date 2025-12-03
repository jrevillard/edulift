import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { UnifiedInvitationService } from '../services/UnifiedInvitationService';
import { UserRepository } from '../repositories/UserRepository';
import { SecureTokenRepository } from '../repositories/SecureTokenRepository';
import { PrismaClient } from '@prisma/client';
import { createLogger, Logger } from '../utils/logger';
import {
  sendSuccessResponse,
  sendErrorResponse,
} from '../utils/responseValidation';
import {
  MagicLinkSuccessResponseSchema,
  AuthSuccessResponseSchema,
  RefreshTokenSuccessResponseSchema,
  ProfileSuccessResponseSchema,
  DeleteAccountSuccessResponseSchema,
  SimpleSuccessResponseSchema,
} from '../schemas/responses';

const authLogger = createLogger('AuthController');
import { AuthenticatedRequest } from '../middleware/auth';
import { sanitizeSecurityError, logSecurityEvent } from '../utils/security';
import { isValidTimezone } from '../utils/timezoneUtils';

export class AuthController {
  constructor(
    private authService: AuthService,
    private unifiedInvitationService: UnifiedInvitationService,
    private logger: Logger = authLogger,
  ) { }

  requestMagicLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, name, timezone, inviteCode, code_challenge } = req.body;

      this.logger.debug('AuthController received magic link request', {
        inviteCode,
        timezone,
        code_challenge: code_challenge ? `${code_challenge.substring(0, 10)}...` : undefined,
      });

      // SECURITY: PKCE - Generate magic link with code_challenge for cross-user protection - MANDATORY
      const options: {
        email: string;
        code_challenge?: string;
        name?: string;
        timezone?: string;
        inviteCode?: string;
      } = {
        email,
        code_challenge, // PKCE code challenge is required
      };
      if (name) options.name = name;
      if (timezone) options.timezone = timezone;
      if (inviteCode) options.inviteCode = inviteCode;

      // @ts-expect-error - MagicLinkRequestOptions type issue
      const result = await this.authService.requestMagicLink(options);

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, MagicLinkSuccessResponseSchema, {
        message: 'Magic link sent to your email',
        userExists: result.userExists,
      });
    } catch (error) {
      // SECURITY: Use sanitized error messages for production
      const securityError = sanitizeSecurityError(error as Error);

      // Log security-related failures for monitoring
      logSecurityEvent('AUTH_REQUEST_FAILED', {
        error: securityError.logMessage,
        email: req.body?.email ? '[REDACTED]' : undefined,
        userAgent: req.headers?.['user-agent'],
        ip: req.ip,
      }, 'warn');

      // Special handling for common validation errors that should pass through
      if (error instanceof Error && error.message === 'Name is required for new users') {
        sendErrorResponse(res, 422, error.message);
        return;
      }

      sendErrorResponse(res, securityError.statusCode, securityError.userMessage);
    }
  };

  verifyMagicLink = async (req: Request, res: Response): Promise<void> => {
    try {
      // SECURITY: PKCE - Get token, code_verifier from request body and inviteCode from query
      const { token, code_verifier } = req.body;
      const inviteCode = req.query.inviteCode as string | undefined;

      this.logger.debug('AuthController verifyMagicLink', {
        token: token ? `${token.substring(0, 10)}...` : undefined,
        inviteCode,
        code_verifier: code_verifier ? `${code_verifier.substring(0, 10)}...` : undefined,
      });

      // SECURITY: Verify magic link with PKCE validation to prevent cross-user attacks - MANDATORY
      const authResult = await this.authService.verifyMagicLink(token, code_verifier);

      if (!authResult) {
        sendErrorResponse(res, 401, 'Invalid or expired magic link');
        return;
      }

      // Process invitation if inviteCode is provided (per invitation-system-proposal.md)
      let invitationResult = null;
      if (inviteCode) {
        this.logger.debug('AuthController processing invitation', { inviteCode });
        try {
          // Validate and get invitation details
          const familyValidation = await this.unifiedInvitationService.validateFamilyInvitation(inviteCode);
          const groupValidation = await this.unifiedInvitationService.validateGroupInvitation(inviteCode);
          this.logger.debug('Invitation validation results', {
            family: familyValidation.valid,
            group: groupValidation.valid,
          });

          if (familyValidation.valid) {
            // Check if user can leave their current family (if they have one)
            if (familyValidation.userCurrentFamily && familyValidation.canLeaveCurrentFamily === false) {
              invitationResult = {
                processed: false,
                reason: familyValidation.cannotLeaveReason || 'Cannot leave current family',
              };
            } else {
              // For family invitations via magic link, if user already has a family,
              // we assume they want to leave it (since they clicked the "leave and join" button)
              const options = { leaveCurrentFamily: true };
              await this.unifiedInvitationService.acceptFamilyInvitation(inviteCode, authResult.user.id, options);
              invitationResult = {
                processed: true,
                invitationType: 'FAMILY',
                redirectUrl: '/dashboard',
              };
            }
          } else if (groupValidation.valid) {
            this.logger.debug('Processing group invitation', { userId: authResult.user.id });
            // Try to accept group invitation directly
            const result = await this.unifiedInvitationService.acceptGroupInvitation(inviteCode, authResult.user.id);
            this.logger.debug('Group invitation result', { result });

            if (result.success) {
              invitationResult = {
                processed: true,
                invitationType: 'GROUP',
                redirectUrl: '/dashboard',
              };
            } else if (result.requiresFamilyOnboarding) {
              invitationResult = {
                processed: true,
                requiresFamilyOnboarding: true,
                redirectUrl: `/families/onboarding?returnTo=/groups/join?code=${inviteCode}`,
              };
            } else {
              invitationResult = {
                processed: false,
                reason: result.message || 'Unable to process group invitation',
              };
            }
            this.logger.debug('Final invitation result', invitationResult);
          }
        } catch (error) {
          this.logger.warn('Failed to process invitation', { error: (error as Error).message });
          // Don't fail the auth flow if invitation processing fails
          invitationResult = {
            processed: false,
            reason: (error as Error).message || 'Failed to process invitation',
          };
        }
      }

      // Transform data to match schema expectations (convert Date objects to ISO strings)
      const transformedData = {
        user: {
          ...authResult.user,
          createdAt: authResult.user.createdAt?.toISOString(),
          updatedAt: authResult.user.updatedAt?.toISOString(),
        },
        accessToken: authResult.accessToken,  // ✅ Primary access token field
        refreshToken: authResult.refreshToken,  // ✅ Refresh token for token rotation
        expiresIn: authResult.expiresIn,  // ✅ Expiration in seconds (900)
        tokenType: authResult.tokenType,  // ✅ Token type (Bearer)
        // Legacy fields for backward compatibility
        token: authResult.accessToken,
        expiresAt: authResult.expiresAt?.toISOString(),
        invitationResult,
      };

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, AuthSuccessResponseSchema, transformedData);
    } catch (error) {
      // SECURITY: Use sanitized error messages for production
      const securityError = sanitizeSecurityError(error as Error);

      // Log full details for security monitoring
      logSecurityEvent('AUTH_VERIFY_FAILED', {
        error: securityError.logMessage,
        token: `${req.body?.token?.substring(0, 10)}...`,
        userAgent: req.headers?.['user-agent'],
        ip: req.ip,
      }, 'error');

      sendErrorResponse(res, securityError.statusCode, securityError.userMessage);
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      // ✅ NEW: Get refresh token from request body (not Authorization header)
      const { refreshToken } = req.body;

      if (!refreshToken) {
        sendErrorResponse(res, 400, 'Refresh token required');
        return;
      }

      // ✅ NEW: Use new refreshAccessToken method with rotation
      const authResult = await this.authService.refreshAccessToken(refreshToken);

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, RefreshTokenSuccessResponseSchema, {
        accessToken: authResult.accessToken,
        refreshToken: authResult.refreshToken,  // ✅ NEW rotated token
        expiresIn: authResult.expiresIn,
        tokenType: authResult.tokenType,
      });
    } catch (error) {
      this.logger.error('Refresh token error', { error: (error as Error).message });

      sendErrorResponse(res, 401, error instanceof Error ? error.message : 'Failed to refresh token');
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // ✅ NEW: Revoke all refresh tokens for the user
      const userId = (req as AuthenticatedRequest).userId;

      if (!userId) {
        sendErrorResponse(res, 401, 'Authentication required');
        return;
      }

      await this.authService.logout(userId);

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
        message: 'Logged out successfully',
      });
    } catch (error) {
      this.logger.error('Logout error', { error: (error as Error).message });

      sendErrorResponse(res, 500, 'Failed to logout');
    }
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get user ID from authenticated request
      const userId = (req as AuthenticatedRequest).user?.id;

      this.logger.debug('updateProfile: Received request', {
        userId,
        profileData: req.body,
        userEmail: (req as AuthenticatedRequest).user?.email,
      });

      if (!userId) {
        this.logger.error('updateProfile: User authentication required', { userId });
        sendErrorResponse(res, 401, 'User authentication required');
        return;
      }

      this.logger.debug('updateProfile: Authentication validated', { userId });

      // Validate the request body
      const profileData = req.body;

      this.logger.debug('updateProfile: Profile data validated', {
        userId,
        hasName: !!profileData.name,
        hasTimezone: !!profileData.timezone,
        timezone: profileData.timezone,
      });

      // Validate timezone if provided
      if (profileData.timezone && !isValidTimezone(profileData.timezone)) {
        this.logger.warn('updateProfile: Invalid timezone provided', {
          userId,
          timezone: profileData.timezone,
        });
        sendErrorResponse(res, 400, 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"');
        return;
      }

      this.logger.debug('updateProfile: Calling service to update profile', {
        userId,
        profileFields: Object.keys(profileData),
      });

      // Update the user profile
      const updatedUser = await this.authService.updateProfile(userId, profileData);

      this.logger.debug('updateProfile: Profile updated successfully', {
        userId,
        updatedName: updatedUser.name,
        updatedTimezone: updatedUser.timezone,
      });

      // Transform data to match schema expectations (convert Date objects to ISO strings)
      const transformedUser = {
        ...updatedUser,
        createdAt: updatedUser.createdAt?.toISOString(),
        updatedAt: updatedUser.updatedAt?.toISOString(),
      };

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, ProfileSuccessResponseSchema, transformedUser);

      this.logger.debug('updateProfile: Sending response', {
        userId,
        success: true,
      });
    } catch (error) {
      this.logger.error('updateProfile: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).user?.id,
        profileData: req.body,
      });

      sendErrorResponse(res, 500, error instanceof Error ? error.message : 'Failed to update profile');
    }
  };

  /**
   * Update user timezone
   * PATCH /api/users/me/timezone
   */
  updateTimezone = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        sendErrorResponse(res, 401, 'User authentication required');
        return;
      }

      const { timezone } = req.body;

      // Timezone validation is handled by middleware Zod schema
      // Update timezone via profile update
      const updatedUser = await this.authService.updateProfile(userId, { timezone });

      // Transform data to match schema expectations (convert Date objects to ISO strings)
      const transformedUser = {
        ...updatedUser,
        createdAt: updatedUser.createdAt?.toISOString(),
        updatedAt: updatedUser.updatedAt?.toISOString(),
      };

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, ProfileSuccessResponseSchema, transformedUser);
    } catch (error) {
      this.logger.error('Update timezone error', { error: (error as Error).message });

      sendErrorResponse(res, 500, error instanceof Error ? error.message : 'Failed to update timezone');
    }
  };


  /**
   * Request account deletion confirmation via email
   * Generates secure PKCE token and sends confirmation email
   */
  requestAccountDeletion = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    try {
      const authReq = req as AuthenticatedRequest;
      const { code_challenge } = req.body;

      if (!authReq.userId) {
        sendErrorResponse(res, 401, 'Authentication required');
        return;
      }

      this.logger.debug('requestAccountDeletion: Request received', {
        userId: authReq.userId,
        userEmail: authReq.user?.email,
        code_challenge: code_challenge ? `${code_challenge.substring(0, 10)}...` : undefined,
        timestamp: new Date().toISOString(),
      });

      // SECURITY: PKCE code_challenge is required for all deletion requests
      if (!code_challenge || code_challenge.length < 43 || code_challenge.length > 128) {
        this.logger.warn('requestAccountDeletion: Invalid PKCE challenge', {
          userId: authReq.userId,
          codeChallengeLength: code_challenge?.length || 0,
          timestamp: new Date().toISOString(),
        });
        sendErrorResponse(res, 400, 'code_challenge is required and must be 43-128 characters for PKCE validation');
        return;
      }

      // Request account deletion with PKCE challenge
      const result = await this.authService.requestAccountDeletion({
        userId: authReq.userId,
        code_challenge,
      });

      this.logger.info('requestAccountDeletion: Deletion email sent successfully', {
        userId: authReq.userId,
        userEmail: authReq.user?.email,
        message: result.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
        message: result.message,
      });

      this.logger.debug('requestAccountDeletion: Sending response', {
        userId: authReq.userId,
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error('requestAccountDeletion: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        userId: (req as AuthenticatedRequest).userId,
        providedCodeChallenge: req.body?.code_challenge ? `${req.body.code_challenge.substring(0, 10)}...` : undefined,
        duration: Date.now() - startTime,
      });

      // Use sanitized error messages for security
      const securityError = sanitizeSecurityError(error as Error);

      sendErrorResponse(res, securityError.statusCode, securityError.userMessage);
    }
  };

  /**
   * Confirm account deletion using PKCE-protected token from email
   * Validates token and executes account deletion
   */
  confirmAccountDeletion = async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();

    try {
      const { token, code_verifier } = req.body;

      this.logger.debug('confirmAccountDeletion: Request received', {
        token: token ? `${token.substring(0, 10)}...` : undefined,
        code_verifier: code_verifier ? `${code_verifier.substring(0, 10)}...` : undefined,
        timestamp: new Date().toISOString(),
      });

      // SECURITY: PKCE validation is mandatory
      if (!code_verifier) {
        this.logger.warn('confirmAccountDeletion: Missing PKCE verifier', {
          token: token ? `${token.substring(0, 10)}...` : undefined,
          timestamp: new Date().toISOString(),
        });
        sendErrorResponse(res, 400, 'code_verifier required for PKCE validation');
        return;
      }

      // Confirm and execute account deletion with PKCE validation
      const result = await this.authService.confirmAccountDeletion(token, code_verifier);

      this.logger.info('confirmAccountDeletion: Account deleted successfully via email confirmation', {
        deletedAt: result.deletedAt,
        message: result.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Send validated response ensuring OpenAPI compliance
      sendSuccessResponse(res, 200, DeleteAccountSuccessResponseSchema, {
        message: result.message,
        deletedAt: result.deletedAt,
      });

      this.logger.debug('confirmAccountDeletion: Sending response', {
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (error) {
      this.logger.error('confirmAccountDeletion: Error occurred', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        token: req.body?.token ? `${req.body.token.substring(0, 10)}...` : undefined,
        codeVerifier: req.body?.code_verifier ? `${req.body.code_verifier.substring(0, 10)}...` : undefined,
        duration: Date.now() - startTime,
      });

      // Log security-related failures for monitoring
      logSecurityEvent('ACCOUNT_DELETION_CONFIRM_FAILED', {
        error: error instanceof Error ? error.message : 'Unknown error',
        token: req.body?.token ? `${req.body.token.substring(0, 10)}...` : 'missing',
        userAgent: req.headers?.['user-agent'],
        ip: req.ip,
      }, 'warn');

      // Handle specific error cases with appropriate HTTP status codes
      let statusCode = 500;
      let errorMessage = 'Failed to confirm account deletion';

      if (error instanceof Error) {
        if (error.message.includes('Invalid or expired')) {
          statusCode = 401;
          errorMessage = error.message;
        } else if (error.message.includes('User not found')) {
          statusCode = 404;
          errorMessage = error.message;
        } else if (error.message.includes('code_verifier required')) {
          statusCode = 400;
          errorMessage = error.message;
        } else {
          errorMessage = error.message;
        }
      }

      sendErrorResponse(res, statusCode, errorMessage);
    }
  };
}

// Factory function to create controller with dependencies
export const createAuthController = (): AuthController => {
  const prisma = new PrismaClient();
  const userRepository = new UserRepository(prisma);
  const secureTokenRepository = new SecureTokenRepository(prisma);

  // Use centralized email service factory
  const emailService = EmailServiceFactory.getInstance();
  const authService = new AuthService(userRepository, secureTokenRepository, emailService, prisma);

  // Create logger for UnifiedInvitationService
  const unifiedInvitationLogger = createLogger('UnifiedInvitationService');

  const unifiedInvitationService = new UnifiedInvitationService(prisma, unifiedInvitationLogger, emailService);

  return new AuthController(authService, unifiedInvitationService, authLogger);
};