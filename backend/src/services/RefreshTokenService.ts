import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class RefreshTokenService {
  /**
   * Generate a new refresh token for a user
   * @param userId - User ID to generate token for
   * @param tokenFamily - Optional token family ID for rotation (inherits from old token)
   * @returns Object with token (unhashed) and expiration date
   */
  public async generateRefreshToken(userId: string, tokenFamily?: string): Promise<{
    token: string;
    expiresAt: Date;
  }> {
    // Generate secure random token (64 bytes = 128 hex chars)
    const token = crypto.randomBytes(64).toString('hex');

    // Hash token for storage (SHA256)
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Calculate expiration: 60 days SLIDING (optimized for EduLift)
    // Covers school vacations (2 weeks) with comfortable buffer
    const expiresAt = new Date();
    const expiryDays = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '60', 10);
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    // Store hashed token in database
    const data: any = {
      userId,
      token: hashedToken,
      expiresAt,
    };

    // If tokenFamily is provided (during rotation), use it to link tokens
    // This allows revoking all tokens in a family when reuse is detected
    if (tokenFamily) {
      data.tokenFamily = tokenFamily;
    }

    await prisma.refreshToken.create({ data });

    // Return original (unhashed) token to client
    return { token, expiresAt };
  }

  /**
   * Verify and rotate a refresh token (token rotation for security)
   * @param token - Refresh token to verify
   * @returns Object with userId and new refresh token
   * @throws Error if token is invalid, revoked, expired, or reused
   */
  public async verifyAndRotateRefreshToken(token: string): Promise<{
    userId: string;
    newRefreshToken: string;
    newRefreshTokenExpiresAt: Date;
  }> {
    // Hash the received token to compare with DB
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Fetch token from database
    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token: hashedToken },
    });

    // Validation checks
    if (!refreshToken) {
      throw new Error('Invalid refresh token');
    }

    // Check for reuse BEFORE checking if revoked
    // This is critical for security: reused tokens indicate theft
    if (refreshToken.usedAt !== null) {
      // ⚠️ REUSE DETECTED = Potential token theft
      // Revoke ALL tokens in this family for security
      await this.revokeTokenFamily(refreshToken.tokenFamily);
      throw new Error('Token reuse detected - all tokens revoked for security');
    }

    if (refreshToken.isRevoked) {
      throw new Error('Refresh token has been revoked');
    }

    // ✅ SLIDING EXPIRATION: Renews expiration on each use
    // Active users never get logged out (60 days since last use)
    if (new Date() > refreshToken.expiresAt) {
      throw new Error('Refresh token has expired');
    }

    // Mark token as used (for reuse detection)
    await prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { usedAt: new Date() },
    });

    // Generate NEW refresh token (rotation for security)
    // Pass the tokenFamily to link the new token with the old one
    const { token: newToken, expiresAt } = await this.generateRefreshToken(
      refreshToken.userId,
      refreshToken.tokenFamily, // ✅ Inherit token family for reuse detection
    );

    // After successful rotation, revoke the old token
    // This ensures reuse detection works: if old token is used again,
    // it will have usedAt set (caught at line 82), not isRevoked
    await prisma.refreshToken.update({
      where: { id: refreshToken.id },
      data: { isRevoked: true },
    });

    return {
      userId: refreshToken.userId,
      newRefreshToken: newToken,
      newRefreshTokenExpiresAt: expiresAt,
    };
  }

  /**
   * Revoke all tokens in a token family (security measure for token reuse detection)
   * @param tokenFamily - Token family ID to revoke
   */
  private async revokeTokenFamily(tokenFamily: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { tokenFamily },
      data: { isRevoked: true },
    });
  }

  /**
   * Revoke all refresh tokens for a user (logout)
   * @param userId - User ID to revoke tokens for
   */
  public async revokeAllUserTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });
  }

  /**
   * Clean up expired tokens (cron job utility)
   * @param olderThanDays - Delete tokens expired more than N days ago
   */
  public async cleanupExpiredTokens(olderThanDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}
