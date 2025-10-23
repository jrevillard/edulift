import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { UnifiedInvitationService } from '../services/UnifiedInvitationService';
import { UserRepository } from '../repositories/UserRepository';
import { MagicLinkRepository } from '../repositories/MagicLinkRepository';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../types';
import { Logger, logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import {
  RequestMagicLinkSchema,
  UpdateProfileSchema,
  UpdateTimezoneSchema,
} from '../utils/validation';
import { sanitizeSecurityError, logSecurityEvent } from '../utils/security';
import { isValidTimezone } from '../utils/timezoneUtils';

const VerifyMagicLinkSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  code_verifier: z.string().min(43).max(128), // PKCE: Original random string used to generate code_challenge - REQUIRED
  // inviteCode is now extracted from query parameters, not request body
});

export class AuthController {
  constructor(
    private authService: AuthService,
    private unifiedInvitationService: UnifiedInvitationService,
    private logger: Logger,
  ) {}

  requestMagicLink = async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, name, timezone, inviteCode, platform, code_challenge } = RequestMagicLinkSchema.parse(req.body);

      this.logger.debug('AuthController received magic link request', {
        inviteCode,
        platform,
        timezone,
        code_challenge: code_challenge ? `${code_challenge.substring(0, 10)}...` : undefined,
      });

      // SECURITY: PKCE - Generate magic link with code_challenge for cross-user protection - MANDATORY
      const options: {
        email: string;
        platform?: string;
        code_challenge?: string;
        name?: string;
        timezone?: string;
        inviteCode?: string;
      } = {
        email,
        platform,
        code_challenge, // PKCE code challenge is required
      };
      if (name) options.name = name;
      if (timezone) options.timezone = timezone;
      if (inviteCode) options.inviteCode = inviteCode;
      
      // @ts-expect-error - MagicLinkRequestOptions type issue
      const result = await this.authService.requestMagicLink(options);

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Magic link sent to your email',
          userExists: result.userExists,
        },
      };

      res.status(200).json(response);
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
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }

      // Special handling for common validation errors that should pass through
      if (error instanceof Error && error.message === 'Name is required for new users') {
        const response: ApiResponse = {
          success: false,
          error: error.message,
        };
        res.status(422).json(response);
        return;
      }
      
      const response: ApiResponse = {
        success: false,
        error: securityError.userMessage,
      };
      res.status(securityError.statusCode).json(response);
    }
  };

  verifyMagicLink = async (req: Request, res: Response): Promise<void> => {
    try {
      // SECURITY: PKCE - Get token, code_verifier from request body and inviteCode from query
      const { token, code_verifier } = VerifyMagicLinkSchema.parse(req.body);
      const inviteCode = req.query.inviteCode as string | undefined;

      this.logger.debug('AuthController verifyMagicLink', {
        token: token ? `${token.substring(0, 10)}...` : undefined,
        inviteCode,
        code_verifier: code_verifier ? `${code_verifier.substring(0, 10)}...` : undefined,
      });

      // SECURITY: Verify magic link with PKCE validation to prevent cross-user attacks - MANDATORY
      const authResult = await this.authService.verifyMagicLink(token, code_verifier);

      if (!authResult) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid or expired magic link',
        };
        res.status(401).json(response);
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
            // @ts-expect-error - logger debug parameter type
            this.logger.debug('Group invitation result', result);
            
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

      const response: ApiResponse = {
        success: true,
        data: {
          user: authResult.user,
          accessToken: authResult.accessToken,  // ✅ Primary access token field
          refreshToken: authResult.refreshToken,  // ✅ Refresh token for token rotation
          expiresIn: authResult.expiresIn,  // ✅ Expiration in seconds (900)
          tokenType: authResult.tokenType,  // ✅ Token type (Bearer)
          // Legacy fields for backward compatibility
          token: authResult.accessToken,
          expiresAt: authResult.expiresAt,
          invitationResult,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      // SECURITY: Use sanitized error messages for production
      const securityError = sanitizeSecurityError(error as Error);
      
      // Log full details for security monitoring
      logSecurityEvent('AUTH_VERIFY_FAILED', {
        error: securityError.logMessage,
        token: `${req.body?.token?.substring(0, 10)  }...`,
        userAgent: req.headers?.['user-agent'],
        ip: req.ip,
      }, 'error');
      
      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: securityError.userMessage,
      };
      res.status(securityError.statusCode).json(response);
    }
  };

  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      // ✅ NEW: Get refresh token from request body (not Authorization header)
      const { refreshToken } = req.body;

      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          error: 'Refresh token required',
        };
        res.status(400).json(response);
        return;
      }

      // ✅ NEW: Use new refreshAccessToken method with rotation
      const authResult = await this.authService.refreshAccessToken(refreshToken);

      const response: ApiResponse = {
        success: true,
        data: {
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,  // ✅ NEW rotated token
          expiresIn: authResult.expiresIn,
          tokenType: authResult.tokenType,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Refresh token error', { error: (error as Error).message });

      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh token',
      };
      res.status(401).json(response);
    }
  };

  logout = async (req: Request, res: Response): Promise<void> => {
    try {
      // ✅ NEW: Revoke all refresh tokens for the user
      const userId = (req as AuthenticatedRequest).userId;

      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: 'Authentication required',
        };
        res.status(401).json(response);
        return;
      }

      await this.authService.logout(userId);

      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      };

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Logout error', { error: (error as Error).message });

      const response: ApiResponse = {
        success: false,
        error: 'Failed to logout',
      };
      res.status(500).json(response);
    }
  };

  updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      // Get user ID from authenticated request
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        const response: ApiResponse = {
          success: false,
          error: 'User authentication required',
        };
        res.status(401).json(response);
        return;
      }

      // Validate the request body
      const profileData = UpdateProfileSchema.parse(req.body);

      // Validate timezone if provided
      if (profileData.timezone && !isValidTimezone(profileData.timezone)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"',
        };
        res.status(400).json(response);
        return;
      }

      // Update the user profile
      const updatedUser = await this.authService.updateProfile(userId, profileData);

      const response: ApiResponse = {
        success: true,
        data: updatedUser,
      };

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Update profile error', { error: (error as Error).message });

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update profile',
      };
      res.status(500).json(response);
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
        const response: ApiResponse = {
          success: false,
          error: 'User authentication required',
        };
        res.status(401).json(response);
        return;
      }

      const { timezone } = UpdateTimezoneSchema.parse(req.body);

      // Validate timezone format
      if (!isValidTimezone(timezone)) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid IANA timezone format. Please use format like "Europe/Paris" or "America/New_York"',
        };
        res.status(400).json(response);
        return;
      }

      // Update timezone via profile update
      const updatedUser = await this.authService.updateProfile(userId, { timezone });

      // Return complete user profile structure (same as updateProfile endpoint)
      const response: ApiResponse = {
        success: true,
        data: updatedUser,
      };

      res.status(200).json(response);
    } catch (error) {
      this.logger.error('Update timezone error', { error: (error as Error).message });

      if (error instanceof z.ZodError) {
        const response: ApiResponse = {
          success: false,
          error: 'Invalid input data',
          validationErrors: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message,
          })),
        };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update timezone',
      };
      res.status(500).json(response);
    }
  };
}

// Factory function to create controller with dependencies
export const createAuthController = (): AuthController => {
  const prisma = new PrismaClient();
  const userRepository = new UserRepository(prisma);
  const magicLinkRepository = new MagicLinkRepository(prisma);
  
  // Use centralized email service factory
  const emailService = EmailServiceFactory.getInstance();
  const authService = new AuthService(userRepository, magicLinkRepository, emailService);
  
  // Create logger for UnifiedInvitationService
  const unifiedInvitationLogger = {
    info: (message: string, meta?: Record<string, unknown>): void => logger.info(message, meta),
    error: (message: string, meta?: Record<string, unknown>): void => logger.error(message, meta),
    warn: (message: string, meta?: Record<string, unknown>): void => logger.warn(message, meta),
    debug: (message: string, meta?: Record<string, unknown>): void => logger.debug(message, meta),
  };
  
  const unifiedInvitationService = new UnifiedInvitationService(prisma, unifiedInvitationLogger, emailService);
  
  return new AuthController(authService, unifiedInvitationService, logger);
};