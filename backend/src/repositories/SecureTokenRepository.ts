import { PrismaClient, TokenType } from '@prisma/client';

interface SecureToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  used: boolean;
  codeChallenge: string; // PKCE: SHA256 hash of code_verifier, base64url encoded - required
  type: TokenType;
  createdAt: Date;
}
import { randomBytes } from 'crypto';

export interface CreateSecureTokenData {
  userId: string;
  expiresAt: Date;
  codeChallenge: string; // PKCE: SHA256 hash of code_verifier, base64url encoded - required
  type: TokenType;
}

export class SecureTokenRepository {
  constructor(private prisma: PrismaClient) {}

  async create(data: CreateSecureTokenData): Promise<SecureToken> {
    const token = this.generateSecureToken();

    return this.prisma.secureToken.create({
      data: {
        userId: data.userId,
        expiresAt: data.expiresAt,
        codeChallenge: data.codeChallenge,
        type: data.type,
        token,
      },
    });
  }

  async findValidToken(token: string, type?: TokenType): Promise<SecureToken | null> {
    const where: {
      token: string;
      used: boolean;
      expiresAt: { gt: Date };
      type?: TokenType;
    } = {
      token,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    };

    // If type is specified, include it in the query
    if (type) {
      where.type = type;
    }

    return this.prisma.secureToken.findFirst({ where });
  }

  /**
   * SECURITY: Find valid token with PKCE validation for cross-user attack prevention
   * This method should be used instead of findValidToken for PKCE-protected flows
   */
  async findValidTokenWithPKCE(token: string, codeChallenge?: string, type?: TokenType): Promise<SecureToken | null> {
    const where: {
      token: string;
      used: boolean;
      expiresAt: { gt: Date };
      codeChallenge?: string;
      type?: TokenType;
    } = {
      token,
      used: false,
      expiresAt: {
        gt: new Date(),
      },
    };

    // If codeChallenge is provided, include it in the query for additional security
    if (codeChallenge) {
      where.codeChallenge = codeChallenge;
    }

    // If type is specified, include it in the query
    if (type) {
      where.type = type;
    }

    return this.prisma.secureToken.findFirst({ where });
  }

  async markAsUsed(token: string): Promise<void> {
    await this.prisma.secureToken.updateMany({
      where: { token },
      data: { used: true },
    });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.prisma.secureToken.deleteMany({
      where: {
        OR: [
          { used: true },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    return result.count;
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }

  async findUserTokens(userId: string, type?: TokenType): Promise<SecureToken[]> {
    const where: { userId: string; type?: TokenType } = { userId };

    if (type) {
      where.type = type;
    }

    return this.prisma.secureToken.findMany({
      where,
      orderBy: { expiresAt: 'desc' },
    });
  }

  async revokeUserTokens(userId: string, type?: TokenType): Promise<void> {
    const where: {
      userId: string;
      used: boolean;
      type?: TokenType;
    } = {
      userId,
      used: false,
    };

    if (type) {
      where.type = type;
    }

    await this.prisma.secureToken.updateMany({
      where,
      data: { used: true },
    });
  }

  // Convenience methods for specific token types

  async createMagicLink(data: Omit<CreateSecureTokenData, 'type'>): Promise<SecureToken> {
    return this.create({ ...data, type: TokenType.MAGIC_LINK });
  }

  async createAccountDeletionToken(data: Omit<CreateSecureTokenData, 'type'>): Promise<SecureToken> {
    return this.create({ ...data, type: TokenType.ACCOUNT_DELETION });
  }

  async createEmailModificationToken(data: Omit<CreateSecureTokenData, 'type'>): Promise<SecureToken> {
    return this.create({ ...data, type: TokenType.EMAIL_MODIFICATION });
  }

  // Note: Family and Group invitations don't use PKCE and remain in their own tables
  // Only MAGIC_LINK, ACCOUNT_DELETION, and EMAIL_MODIFICATION tokens use this centralized PKCE system

  async findValidMagicLink(token: string): Promise<SecureToken | null> {
    return this.findValidToken(token, TokenType.MAGIC_LINK);
  }

  async findValidAccountDeletionToken(token: string): Promise<SecureToken | null> {
    return this.findValidToken(token, TokenType.ACCOUNT_DELETION);
  }

  async findValidEmailModificationToken(token: string): Promise<SecureToken | null> {
    return this.findValidToken(token, TokenType.EMAIL_MODIFICATION);
  }

  
  async findValidMagicLinkWithPKCE(token: string): Promise<SecureToken | null> {
    // Find token without codeChallenge filter (PKCE validation happens in AuthService)
    return this.findValidToken(token, TokenType.MAGIC_LINK);
  }

  async findValidAccountDeletionTokenWithPKCE(token: string): Promise<SecureToken | null> {
    // Find token without codeChallenge filter (PKCE validation happens in AuthService)
    return this.findValidToken(token, TokenType.ACCOUNT_DELETION);
  }

  async findValidEmailModificationTokenWithPKCE(token: string): Promise<SecureToken | null> {
    // Find token without codeChallenge filter (PKCE validation happens in AuthService)
    return this.findValidToken(token, TokenType.EMAIL_MODIFICATION);
  }

  
  async findUserMagicLinks(userId: string): Promise<SecureToken[]> {
    return this.findUserTokens(userId, TokenType.MAGIC_LINK);
  }

  async findUserAccountDeletionTokens(userId: string): Promise<SecureToken[]> {
    return this.findUserTokens(userId, TokenType.ACCOUNT_DELETION);
  }

  async findUserEmailModificationTokens(userId: string): Promise<SecureToken[]> {
    return this.findUserTokens(userId, TokenType.EMAIL_MODIFICATION);
  }

  
  async revokeUserMagicLinks(userId: string): Promise<void> {
    return this.revokeUserTokens(userId, TokenType.MAGIC_LINK);
  }

  async revokeUserAccountDeletionTokens(userId: string): Promise<void> {
    return this.revokeUserTokens(userId, TokenType.ACCOUNT_DELETION);
  }

  async revokeUserEmailModificationTokens(userId: string): Promise<void> {
    return this.revokeUserTokens(userId, TokenType.EMAIL_MODIFICATION);
  }

  }