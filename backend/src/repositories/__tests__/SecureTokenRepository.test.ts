import { TokenType } from '@prisma/client';
import { SecureTokenRepository, CreateSecureTokenData } from '../SecureTokenRepository';

// Mock Prisma Client
const mockPrisma = {
  secureToken: {
    create: jest.fn(),
    findFirst: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    findMany: jest.fn(),
  },
} as any;

describe('SecureTokenRepository', () => {
  let repository: SecureTokenRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new SecureTokenRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create a secure token with provided data', async () => {
      const data: CreateSecureTokenData = {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        codeChallenge: 'test-challenge',
        type: TokenType.MAGIC_LINK,
      };

      const expectedToken = {
        id: 'token123',
        token: expect.any(String), // Generated random token
        userId: data.userId,
        expiresAt: data.expiresAt,
        used: false,
        codeChallenge: data.codeChallenge,
        type: data.type,
        createdAt: expect.any(Date),
      };

      mockPrisma.secureToken.create.mockResolvedValue(expectedToken);

      const result = await repository.create(data);

      expect(mockPrisma.secureToken.create).toHaveBeenCalledWith({
        data: {
          userId: data.userId,
          expiresAt: data.expiresAt,
          codeChallenge: data.codeChallenge,
          type: data.type,
          token: expect.any(String),
        },
      });

      expect(result).toEqual(expectedToken);
    });
  });

  describe('findValidToken', () => {
    it('should find valid token without type filter', async () => {
      const token = 'test-token';
      const expectedToken = {
        id: 'token123',
        token,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000), // Future
        used: false,
        codeChallenge: 'challenge',
        type: TokenType.MAGIC_LINK,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.findFirst.mockResolvedValue(expectedToken);

      const result = await repository.findValidToken(token);

      expect(mockPrisma.secureToken.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          used: false,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });

      expect(result).toEqual(expectedToken);
    });

    it('should find valid token with type filter', async () => {
      const token = 'test-token';
      const type = TokenType.ACCOUNT_DELETION;
      const expectedToken = {
        id: 'token123',
        token,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000), // Future
        used: false,
        codeChallenge: 'challenge',
        type,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.findFirst.mockResolvedValue(expectedToken);

      const result = await repository.findValidToken(token, type);

      expect(mockPrisma.secureToken.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          used: false,
          expiresAt: {
            gt: expect.any(Date),
          },
          type,
        },
      });

      expect(result).toEqual(expectedToken);
    });
  });

  describe('findValidTokenWithPKCE', () => {
    it('should find valid token with PKCE challenge', async () => {
      const token = 'test-token';
      const codeChallenge = 'test-challenge';
      const expectedToken = {
        id: 'token123',
        token,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000), // Future
        used: false,
        codeChallenge,
        type: TokenType.MAGIC_LINK,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.findFirst.mockResolvedValue(expectedToken);

      const result = await repository.findValidTokenWithPKCE(token, codeChallenge);

      expect(mockPrisma.secureToken.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          used: false,
          expiresAt: {
            gt: expect.any(Date),
          },
          codeChallenge,
        },
      });

      expect(result).toEqual(expectedToken);
    });

    it('should find valid token without PKCE challenge', async () => {
      const token = 'test-token';
      const expectedToken = {
        id: 'token123',
        token,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000), // Future
        used: false,
        codeChallenge: 'challenge',
        type: TokenType.MAGIC_LINK,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.findFirst.mockResolvedValue(expectedToken);

      const result = await repository.findValidTokenWithPKCE(token);

      expect(mockPrisma.secureToken.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          used: false,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
      });

      expect(result).toEqual(expectedToken);
    });
  });

  describe('Convenience methods for MAGIC_LINK', () => {
    it('should create magic link using convenience method', async () => {
      const data = {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000),
        codeChallenge: 'challenge',
      };

      const expectedToken = {
        id: 'token123',
        token: 'generated-token',
        userId: data.userId,
        expiresAt: data.expiresAt,
        used: false,
        codeChallenge: data.codeChallenge,
        type: TokenType.MAGIC_LINK,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.create.mockResolvedValue(expectedToken);

      const result = await repository.createMagicLink(data);

      expect(mockPrisma.secureToken.create).toHaveBeenCalledWith({
        data: {
          userId: data.userId,
          expiresAt: data.expiresAt,
          codeChallenge: data.codeChallenge,
          type: TokenType.MAGIC_LINK,
          token: expect.any(String),
        },
      });

      expect(result).toEqual(expectedToken);
    });

    it('should find valid magic link', async () => {
      const token = 'test-token';
      const expectedToken = {
        id: 'token123',
        token,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        codeChallenge: 'challenge',
        type: TokenType.MAGIC_LINK,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.findFirst.mockResolvedValue(expectedToken);

      const result = await repository.findValidMagicLink(token);

      expect(mockPrisma.secureToken.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          used: false,
          expiresAt: {
            gt: expect.any(Date),
          },
          type: TokenType.MAGIC_LINK,
        },
      });

      expect(result).toEqual(expectedToken);
    });
  });

  describe('Convenience methods for ACCOUNT_DELETION', () => {
    it('should create account deletion token using convenience method', async () => {
      const data = {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000),
        codeChallenge: 'challenge',
      };

      const expectedToken = {
        id: 'token123',
        token: 'generated-token',
        userId: data.userId,
        expiresAt: data.expiresAt,
        used: false,
        codeChallenge: data.codeChallenge,
        type: TokenType.ACCOUNT_DELETION,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.create.mockResolvedValue(expectedToken);

      const result = await repository.createAccountDeletionToken(data);

      expect(mockPrisma.secureToken.create).toHaveBeenCalledWith({
        data: {
          userId: data.userId,
          expiresAt: data.expiresAt,
          codeChallenge: data.codeChallenge,
          type: TokenType.ACCOUNT_DELETION,
          token: expect.any(String),
        },
      });

      expect(result).toEqual(expectedToken);
    });

    it('should find valid account deletion token', async () => {
      const token = 'test-token';
      const expectedToken = {
        id: 'token123',
        token,
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000),
        used: false,
        codeChallenge: 'challenge',
        type: TokenType.ACCOUNT_DELETION,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.findFirst.mockResolvedValue(expectedToken);

      const result = await repository.findValidAccountDeletionToken(token);

      expect(mockPrisma.secureToken.findFirst).toHaveBeenCalledWith({
        where: {
          token,
          used: false,
          expiresAt: {
            gt: expect.any(Date),
          },
          type: TokenType.ACCOUNT_DELETION,
        },
      });

      expect(result).toEqual(expectedToken);
    });
  });

  describe('New token types for future features', () => {
    it('should create email modification token', async () => {
      const data = {
        userId: 'user123',
        expiresAt: new Date(Date.now() + 3600000),
        codeChallenge: 'challenge',
      };

      const expectedToken = {
        id: 'token123',
        token: 'generated-token',
        userId: data.userId,
        expiresAt: data.expiresAt,
        used: false,
        codeChallenge: data.codeChallenge,
        type: TokenType.EMAIL_MODIFICATION,
        createdAt: new Date(),
      };

      mockPrisma.secureToken.create.mockResolvedValue(expectedToken);

      const result = await repository.createEmailModificationToken(data);

      expect(mockPrisma.secureToken.create).toHaveBeenCalledWith({
        data: {
          userId: data.userId,
          expiresAt: data.expiresAt,
          codeChallenge: data.codeChallenge,
          type: TokenType.EMAIL_MODIFICATION,
          token: expect.any(String),
        },
      });

      expect(result).toEqual(expectedToken);
    });

    // Family and group invitations no longer use PKCE and have been moved to separate systems
    // These tests have been removed as the methods no longer exist in SecureTokenRepository

  describe('markAsUsed', () => {
    it('should mark token as used', async () => {
      const token = 'test-token';

      mockPrisma.secureToken.updateMany.mockResolvedValue({ count: 1 });

      await repository.markAsUsed(token);

      expect(mockPrisma.secureToken.updateMany).toHaveBeenCalledWith({
        where: { token },
        data: { used: true },
      });
    });
  });

  describe('cleanupExpired', () => {
    it('should cleanup expired tokens', async () => {
      mockPrisma.secureToken.deleteMany.mockResolvedValue({ count: 5 });

      const result = await repository.cleanupExpired();

      expect(mockPrisma.secureToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { used: true },
            { expiresAt: { lt: expect.any(Date) } },
          ],
        },
      });

      expect(result).toBe(5);
    });
  });
});
});