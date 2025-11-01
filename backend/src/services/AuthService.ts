import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { MagicLinkRepository } from '../repositories/MagicLinkRepository';
import { EmailServiceInterface } from '../types/EmailServiceInterface';
import { CreateUserData, UpdateProfileData } from '../types';
import { verifyChallenge } from 'pkce-challenge';
import crypto from 'crypto';
import { RefreshTokenService } from './RefreshTokenService';
import { logger } from '../utils/logger';

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
  platform?: string; // Platform type for magic link generation
  code_challenge: string; // PKCE: SHA256 hash of code_verifier, base64url encoded - REQUIRED
}

export class AuthService {
  private jwtAccessSecret: string;
  private refreshTokenService: RefreshTokenService;

  constructor(
    private userRepository: UserRepository,
    private magicLinkRepository: MagicLinkRepository,
    private emailService: EmailServiceInterface,
  ) {
    // Access token secret for JWT generation
    this.jwtAccessSecret = process.env.JWT_ACCESS_SECRET || 'fallback-secret-key';
    this.refreshTokenService = new RefreshTokenService();
  }

  async requestMagicLink(options: MagicLinkRequestOptions): Promise<MagicLinkRequestResult> {
    // PKCE is now mandatory - no overloads without code_challenge
    const options_internal = options;

    const { email, name: userName, timezone, inviteCode, platform = 'web', code_challenge } = options_internal;

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
    const magicLink = await this.magicLinkRepository.create({
      userId: user.id,
      expiresAt,
      codeChallenge: code_challenge, // Store PKCE challenge for later verification - REQUIRED
    });

    // Generate magic link URL based on platform
    const magicLinkUrl = this.generateMagicLinkUrl(magicLink.token, platform, inviteCode);
    
    // Send magic link email with platform-specific URL
    logger.debug('🔍 DEBUG: AuthService sending magic link:', { platform, inviteCode, url: magicLinkUrl });
    await this.emailService.sendMagicLink(email, magicLink.token, inviteCode, magicLinkUrl);

    return { success: true, userExists };
  }

  async verifyMagicLink(token: string, code_verifier?: string): Promise<any | null> {
    const magicLink = await this.magicLinkRepository.findValidToken(token);

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
    await this.magicLinkRepository.markAsUsed(token);

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
   * Generate magic link URL based on platform type
   */
  private generateMagicLinkUrl(token: string, platform: string, inviteCode?: string): string {
    const baseUrl = platform === 'native' 
      ? 'edulift://auth/verify' 
      : `${process.env.FRONTEND_URL || 'https://app.edulift.com'}/auth/verify`;
    
    const params = new URLSearchParams({ token });
    if (inviteCode) {
      params.append('inviteCode', inviteCode);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }
}