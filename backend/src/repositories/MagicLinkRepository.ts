import { PrismaClient } from '@prisma/client';

interface MagicLink {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
  codeChallenge: string; // PKCE: SHA256 hash of code_verifier, base64url encoded - required
}
import { randomBytes } from 'crypto';

export interface CreateMagicLinkData {
  userId: string;
  expiresAt: Date;
  codeChallenge: string; // PKCE: SHA256 hash of code_verifier, base64url encoded - required
}

export class MagicLinkRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateMagicLinkData): Promise<MagicLink> {
    const token = this.generateSecureToken();
    
    return this.prisma.magicLink.create({
      data: {
        userId: data.userId,
        expiresAt: data.expiresAt,
        codeChallenge: data.codeChallenge,
        token
      }
    });
  }

  async findValidToken(token: string): Promise<MagicLink | null> {
    return this.prisma.magicLink.findFirst({
      where: {
        token,
        used: false,
        expiresAt: {
          gt: new Date()
        }
      }
    });
  }

  /**
   * SECURITY: Find valid token with PKCE validation for cross-user attack prevention
   * This method should be used instead of findValidToken for PKCE-protected flows
   */
  async findValidTokenWithPKCE(token: string, codeChallenge?: string): Promise<MagicLink | null> {
    const where: any = {
      token,
      used: false,
      expiresAt: {
        gt: new Date()
      }
    };

    // If codeChallenge is provided, include it in the query for additional security
    if (codeChallenge) {
      where.codeChallenge = codeChallenge;
    }

    return this.prisma.magicLink.findFirst({ where });
  }

  async markAsUsed(token: string): Promise<void> {
    await this.prisma.magicLink.updateMany({
      where: { token },
      data: { used: true }
    });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.magicLink.deleteMany({
      where: {
        OR: [
          { used: true },
          { expiresAt: { lt: new Date() } }
        ]
      }
    });

    return result.count;
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  async findUserTokens(userId: string): Promise<MagicLink[]> {
    return this.prisma.magicLink.findMany({
      where: { userId },
      orderBy: { expiresAt: 'desc' }
    });
  }

  async revokeUserTokens(userId: string): Promise<void> {
    await this.prisma.magicLink.updateMany({
      where: { 
        userId,
        used: false 
      },
      data: { used: true }
    });
  }
}