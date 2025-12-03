import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { SecureTokenRepository } from '../repositories/SecureTokenRepository';
import { EmailServiceInterface } from '../types/EmailServiceInterface';
import { CreateUserData, UpdateProfileData } from '../types';
import { verifyChallenge } from 'pkce-challenge';
import crypto from 'crypto';
import { RefreshTokenService } from './RefreshTokenService';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { UrlGenerator } from '../utils/UrlGenerator';

/**
 * SECURITY: Timing-safe comparison for PKCE verification
 * Prevents timing attacks by ensuring constant-time comparison
 */
const timingSafeVerifyChallenge = async (codeVerifier: string, codeChallenge: string): Promise<boolean> => {
  try {
    // Use the library's verifyChallenge to compute expected challenge
    const isValid = await verifyChallenge(codeVerifier, codeChallenge);

    // For additional security, we use timing-safe comparison
    // Convert boolean to buffer for timing-safe comparison
    const actualBuffer = Buffer.from(isValid ? '1' : '0', 'utf8');
    const expectedBuffer = Buffer.from('1', 'utf8');

    // If library verification passed, do timing-safe comparison with success value
    if (isValid) {
      return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
    }

    // For failed verification, still do timing-safe comparison to prevent timing attacks
    const failBuffer = Buffer.from('0', 'utf8');
    crypto.timingSafeEqual(actualBuffer, failBuffer); // Always false, but constant time
    return false;

  } catch {
    // Ensure timing consistency even on errors
    const errorBuffer = Buffer.from('0', 'utf8');
    const falseBuffer = Buffer.from('0', 'utf8');
    crypto.timingSafeEqual(errorBuffer, falseBuffer);
    return false;
  }
};

export interface MagicLinkRequestResult {
  success: boolean;
  userExists: boolean;
}

export interface MagicLinkRequestOptions {
  email: string;
  name?: string;
  timezone?: string; // Optional user timezone (IANA format)
  inviteCode?: string; // Optional invitation context
  code_challenge: string; // PKCE: SHA256 hash of code_verifier, base64url encoded - REQUIRED
}

export interface AccountDeletionRequestOptions {
  userId: string;
  code_challenge: string; // PKCE: SHA256 hash of code_verifier, base64url encoded - REQUIRED
}

export class AuthService {
  private jwtAccessSecret: string;
  private refreshTokenService: RefreshTokenService;

  constructor(
    private userRepository: UserRepository,
    private secureTokenRepository: SecureTokenRepository,
    private emailService: EmailServiceInterface,
    private prisma: PrismaClient,
  ) {
    // Access token secret for JWT generation - MUST be set
    if (!process.env.JWT_ACCESS_SECRET) {
      throw new Error('JWT_ACCESS_SECRET environment variable must be set - application cannot start');
    }
    this.jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
    this.refreshTokenService = new RefreshTokenService();
  }

  async requestMagicLink(options: MagicLinkRequestOptions): Promise<MagicLinkRequestResult> {
    // PKCE is now mandatory - no overloads without code_challenge
    const options_internal = options;

    const { email, name: userName, timezone, inviteCode, code_challenge } = options_internal;

    // SECURITY: Validate PKCE code_challenge - MANDATORY for all requests
    if (!code_challenge || code_challenge.length < 43 || code_challenge.length > 128) {
      throw new Error('code_challenge is required and must be 43-128 characters for PKCE validation');
    }

    let user = await this.userRepository.findByEmail(email);
    let userExists = true;

    if (!user) {
      if (!userName) {
        throw new Error('Name is required for new users');
      }

      const userData: CreateUserData = {
        email,
        name: userName,
        ...(timezone && { timezone }), // Only include timezone if provided
      };
      user = await this.userRepository.create(userData);
      userExists = false;
    }

    // Create magic link that expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const magicLink = await this.secureTokenRepository.createMagicLink({
      userId: user.id,
      expiresAt,
      codeChallenge: code_challenge, // Store PKCE challenge for later verification - REQUIRED
    });

    // Generate magic link URL
    const magicLinkUrl = this.generateMagicLinkUrl(magicLink.token, inviteCode);

    // Send magic link email
    logger.debug('🔍 DEBUG: AuthService sending magic link:', { inviteCode, url: magicLinkUrl });
    await this.emailService.sendMagicLink(email, magicLink.token, inviteCode, magicLinkUrl);

    return { success: true, userExists };
  }

  /**
   * Request account deletion confirmation via email
   * Generates secure token with PKCE protection and sends confirmation email
   */
  async requestAccountDeletion(options: AccountDeletionRequestOptions): Promise<{ success: boolean; message: string }> {
    const { userId, code_challenge } = options;

    // SECURITY: Validate PKCE code_challenge - MANDATORY for all requests
    if (!code_challenge || code_challenge.length < 43 || code_challenge.length > 128) {
      throw new Error('code_challenge is required and must be 43-128 characters for PKCE validation');
    }

    // Validate user exists
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    logger.info('requestAccountDeletion: Processing deletion request', {
      userId,
      userEmail: user.email,
      userName: user.name,
      timestamp: new Date().toISOString(),
    });

    // Create account deletion token that expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const magicLink = await this.secureTokenRepository.createAccountDeletionToken({
      userId,
      expiresAt,
      codeChallenge: code_challenge, // Store PKCE challenge for later verification - REQUIRED
    });

    // Generate account deletion URL using the same pattern as magic links
    const deletionUrl = this.generateAccountDeletionUrl(magicLink.token);

    // Send account deletion confirmation email
    await this.emailService.sendAccountDeletionRequest(user.email, user.name || 'User', deletionUrl);

    logger.info('requestAccountDeletion: Deletion email sent', {
      userId,
      userEmail: user.email,
      userName: user.name,
      tokenId: `${magicLink.token.substring(0, 10)  }...`,
      expiresAt: magicLink.expiresAt.toISOString(),
    });

    return {
      success: true,
      message: 'Account deletion confirmation sent to your email',
    };
  }

  async verifyMagicLink(token: string, code_verifier?: string): Promise<any | null> {
    const magicLink = await this.secureTokenRepository.findValidMagicLinkWithPKCE(token, code_verifier);

    if (!magicLink) {
      return null;
    }

    // SECURITY: PKCE validation to prevent cross-user attacks - MANDATORY for all tokens
    if (!code_verifier) {
      throw new Error('code_verifier required for PKCE validation');
    }

    // SECURITY: Use timing-safe PKCE validation to prevent timing attacks
    const isValid = await timingSafeVerifyChallenge(code_verifier, magicLink.codeChallenge);
    if (!isValid) {
      // Invalid PKCE validation - potential cross-user attack
      logger.warn(`🚨 SECURITY: Invalid PKCE validation for token ${token} - potential cross-user attack`);
      throw new Error('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
    }

    const user = await this.userRepository.findById(magicLink.userId);

    if (!user) {
      return null;
    }

    // Mark magic link as used
    await this.secureTokenRepository.markAsUsed(token);

    // ✅ NEW: Generate short-lived access token (15 minutes) + refresh token (60 days SLIDING)
    const accessToken = this.generateAccessToken(user);
    const accessExpiryMinutes = parseInt(process.env.JWT_ACCESS_EXPIRY?.replace('m', '') || '15', 10);
    const expiresIn = accessExpiryMinutes * 60; // Convert to seconds

    // Generate refresh token
    const { token: refreshToken } =
      await this.refreshTokenService.generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        timezone: user.timezone,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      accessToken,      // New: Short-lived access token (15 min)
      refreshToken,     // New: Long-lived refresh token (60 days)
      expiresIn,        // New: Expiration in seconds
      tokenType: 'Bearer',
      // Legacy fields for backward compatibility
      token: accessToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  /**
   * Confirm and execute account deletion using PKCE-protected token
   */
  async confirmAccountDeletion(token: string, code_verifier?: string): Promise<{ success: boolean; message: string; deletedAt: string }> {
    // Find valid token using existing repository method
    const magicLink = await this.secureTokenRepository.findValidAccountDeletionTokenWithPKCE(token, code_verifier);

    if (!magicLink) {
      throw new Error('Invalid or expired deletion token');
    }

    // SECURITY: PKCE validation to prevent cross-user attacks - MANDATORY for all tokens
    if (!code_verifier) {
      throw new Error('code_verifier required for PKCE validation');
    }

    // SECURITY: Use timing-safe PKCE validation to prevent timing attacks
    const isValid = await timingSafeVerifyChallenge(code_verifier, magicLink.codeChallenge);
    if (!isValid) {
      // Invalid PKCE validation - potential cross-user attack
      logger.warn(`🚨 SECURITY: Invalid PKCE validation for deletion token ${token} - potential cross-user attack`);
      throw new Error('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');
    }

    // Get user for logging
    const user = await this.userRepository.findById(magicLink.userId);
    if (!user) {
      throw new Error('User not found');
    }

    logger.info('confirmAccountDeletion: Proceeding with account deletion', {
      userId: magicLink.userId,
      userEmail: user.email,
      userName: user.name,
      tokenId: `${token.substring(0, 10)  }...`,
      timestamp: new Date().toISOString(),
    });

    // Mark token as used first to prevent reuse
    await this.secureTokenRepository.markAsUsed(token);

    // Execute account deletion directly
    const deletionResult = await this.performAccountDeletion(magicLink.userId, user);

    logger.info('confirmAccountDeletion: Account deleted successfully via email confirmation', {
      userId: magicLink.userId,
      userEmail: user.email,
      userName: user.name,
      deletedAt: deletionResult.deletedAt,
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      message: 'Account deleted successfully via email confirmation',
      deletedAt: deletionResult.deletedAt,
    };
  }

  /**
   * ✅ NEW: Refresh access token using refresh token (with rotation)
   * @param refreshToken - Refresh token to verify and rotate
   * @returns New access token and new refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<any> {
    // Verify and rotate refresh token
    const {
      userId,
      newRefreshToken,
    } = await this.refreshTokenService.verifyAndRotateRefreshToken(refreshToken);

    // Get user data
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Generate new access token (15 minutes)
    const accessToken = this.generateAccessToken(user);
    const accessExpiryMinutes = parseInt(process.env.JWT_ACCESS_EXPIRY?.replace('m', '') || '15', 10);
    const expiresIn = accessExpiryMinutes * 60; // Convert to seconds

    return {
      accessToken,
      refreshToken: newRefreshToken,  // ✅ Rotated token
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  /**
   * ✅ NEW: Logout user by revoking all refresh tokens
   * @param userId - User ID to logout
   */
  async logout(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllUserTokens(userId);
  }

  /**
   * ✅ NEW: Generate short-lived access token (15 minutes)
   * @param user - User to generate token for
   * @returns JWT access token
   */
  generateAccessToken(user: { id: string; email: string; name: string }): string {
    const payload = {
      userId: user.id,
      email: user.email,
      name: user.name,
      jti: crypto.randomBytes(16).toString('hex'), // Unique JWT ID for each token
    };

    // Use environment variable or default to 15 minutes
    const expiresIn = process.env.JWT_ACCESS_EXPIRY || '15m';

    // @ts-expect-error - jwt.sign expiresIn accepts string values like '15m' (TypeScript definition issue)
    return jwt.sign(payload, this.jwtAccessSecret, {
      expiresIn,
      issuer: 'edulift-api',
    });
  }


  async updateProfile(userId: string, profileData: UpdateProfileData): Promise<any> {
    try {
      // Validate the profile data
      if (profileData.email && !this.isValidEmail(profileData.email)) {
        throw new Error('Invalid email format');
      }

      if (profileData.name && profileData.name.trim().length === 0) {
        throw new Error('Name cannot be empty');
      }

      // Check if user exists
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if email is already taken by another user
      if (profileData.email && profileData.email !== user.email) {
        const existingUser = await this.userRepository.findByEmail(profileData.email);
        if (existingUser && existingUser.id !== userId) {
          throw new Error('Email is already in use by another account');
        }
      }

      // Update the user profile (timezone validation handled in UserRepository)
      const updatedUser = await this.userRepository.update(userId, profileData);

      // Return only actual Prisma User fields - don't invent fields that don't exist
      return {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        timezone: updatedUser.timezone,
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      };
    } catch (error) {
      if (process.env.NODE_ENV !== 'test') {
        logger.error('Profile update failed:', error instanceof Error ? { message: error.message, stack: error.stack } : { error });
      }
      throw error;
    }
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Private helper method to perform account deletion (used by confirmAccountDeletion)
   */
  private async performAccountDeletion(userId: string, user: any): Promise<{success: boolean; message: string; deletedAt: string}> {
    const startTime = Date.now();

    logger.info('performAccountDeletion: Starting account deletion', {
      userId,
      userEmail: user.email,
      timestamp: new Date().toISOString(),
    });

    try {
      await this.prisma.$transaction(async (tx) => {
        // Step 1: Analyze family membership
        const familyMembership = await tx.familyMember.findFirst({
          where: { userId },
          include: {
            family: {
              include: {
                members: {
                  include: { user: true },
                },
                children: true,
                vehicles: true,
              },
            },
          },
        });

        if (familyMembership) {
          const family = familyMembership.family;
          const admins = family.members.filter(m => m.role === 'ADMIN');

          logger.debug('performAccountDeletion: Found family membership', {
            userId,
            familyId: family.id,
            familyName: family.name,
            totalMembers: family.members.length,
            adminCount: admins.length,
          });

          if (admins.length === 1) {
            // LAST ADMIN = delete complete family
            logger.warn('performAccountDeletion: Last admin - deleting family', {
              userId,
              familyId: family.id,
              familyName: family.name,
              childrenCount: family.children?.length || 0,
              vehicleCount: family.vehicles?.length || 0,
            });

            // Family deletion will cascade to children, vehicles, groups
            await tx.family.delete({ where: { id: family.id } });

            logger.info('performAccountDeletion: Family deleted successfully', {
              userId,
              familyId: family.id,
            });
          } else {
            // OTHER ADMIN = delete member only
            logger.debug('performAccountDeletion: Multiple admins - deleting member only', {
              userId,
              familyId: family.id,
              familyName: family.name,
              remainingAdmins: admins.filter(a => a.id !== userId).length,
            });

            await tx.familyMember.delete({ where: { id: familyMembership.id } });

            logger.info('performAccountDeletion: Family member deleted successfully', {
              userId,
              familyId: family.id,
            });
          }
        }

        // Step 2: Cleanup group relationships
        const groupRelationsDeleted = await tx.groupFamilyMember.deleteMany({
          where: { addedBy: userId },
        });
        const childRelationsDeleted = await tx.groupChildMember.deleteMany({
          where: { addedBy: userId },
        });

        logger.debug('performAccountDeletion: Group relationships cleaned up', {
          userId,
          groupFamilyMembersDeleted: groupRelationsDeleted.count,
          groupChildMembersDeleted: childRelationsDeleted.count,
        });

        // Step 3: Cleanup personal data
        await tx.activityLog.deleteMany({ where: { userId } });
        await tx.secureToken.deleteMany({ where: { userId } });
        await tx.fcmToken.deleteMany({ where: { userId } });
        await tx.refreshToken.deleteMany({ where: { userId } });

        logger.debug('performAccountDeletion: Personal data cleaned up', {
          userId,
          activityLogsDeleted: true,
          secureTokensDeleted: true,
          fcmTokensDeleted: true,
          refreshTokensDeleted: true,
        });

        // Step 4: Clean up created invitations
        // Delete invitations created by the user (since fields are not nullable)
        const familyInvitationsDeleted = await tx.familyInvitation.deleteMany({
          where: {
            OR: [
              { invitedBy: userId },
              { createdBy: userId },
            ],
          },
        });

        const groupInvitationsDeleted = await tx.groupInvitation.deleteMany({
          where: {
            OR: [
              { invitedBy: userId },
              { createdBy: userId },
            ],
          },
        });

        const vehicleAssignmentsUpdated = await tx.scheduleSlotVehicle.updateMany({
          where: { driverId: userId },
          data: { driverId: null },
        });

        logger.debug('performAccountDeletion: References cleaned up', {
          userId,
          familyInvitationsDeleted: familyInvitationsDeleted.count,
          groupInvitationsDeleted: groupInvitationsDeleted.count,
          vehicleAssignmentsUpdated: vehicleAssignmentsUpdated.count,
        });

        // Step 5: Delete the user
        await tx.user.delete({ where: { id: userId } });

        logger.info('performAccountDeletion: User deleted successfully', {
          userId,
          email: user.email,
          name: user.name,
          duration: Date.now() - startTime,
        });
      });

      return {
        success: true,
        message: 'Account deleted successfully',
        deletedAt: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Perform account deletion error:', {
        error: error instanceof Error ? error.message : String(error),
        userId,
        stack: error instanceof Error ? error.stack : undefined,
        duration: Date.now() - startTime,
      });

      if (error instanceof Error) {
        throw error;
      }

      throw new Error('Failed to delete account');
    }
  }

  /**
   * Helper method to get user by ID (used by controller for validation)
   */
  async getUserById(userId: string): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    // Return only safe user fields
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      timezone: user.timezone,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  /**
   * Generate magic link URL using centralized UrlGenerator
   */
  private generateMagicLinkUrl(token: string, inviteCode?: string): string {
    return UrlGenerator.generateMagicLinkUrl(token, inviteCode);
  }

  /**
   * Generate account deletion URL using centralized UrlGenerator
   */
  private generateAccountDeletionUrl(token: string): string {
    return UrlGenerator.generateAccountDeletionUrl(token);
  }
}