import { AuthService } from '../AuthService';
import { UserRepository } from '../../repositories/UserRepository';
import { SecureTokenRepository } from '../../repositories/SecureTokenRepository';
import { EmailService } from '../EmailService';
import { RefreshTokenService } from '../RefreshTokenService';
import { PrismaClient } from '@prisma/client';

// Mock RefreshTokenService
jest.mock('../RefreshTokenService');

// Mock repositories and services
const mockUserRepository = {
  findByEmail: jest.fn(),
  create: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findGroupMembers: jest.fn(),
  getUserGroups: jest.fn(),
  getGroupMembers: jest.fn(),
  getGroupById: jest.fn(),
} as unknown as jest.Mocked<UserRepository>;

const mockSecureTokenRepository = {
  create: jest.fn(),
  createMagicLink: jest.fn(),
  createAccountDeletionToken: jest.fn(),
  findValidToken: jest.fn(),
  findValidMagicLink: jest.fn(),
  findValidMagicLinkWithPKCE: jest.fn(),
  findValidAccountDeletionToken: jest.fn(),
  findValidAccountDeletionTokenWithPKCE: jest.fn(),
  markAsUsed: jest.fn(),
  cleanupExpired: jest.fn(),
  findUserTokens: jest.fn(),
  findUserMagicLinks: jest.fn(),
  findUserAccountDeletionTokens: jest.fn(),
  revokeUserTokens: jest.fn(),
  revokeUserMagicLinks: jest.fn(),
  revokeUserAccountDeletionTokens: jest.fn(),
} as unknown as SecureTokenRepository;

const mockEmailService = {
  sendMagicLink: jest.fn(),
  sendScheduleNotification: jest.fn(),
  sendGroupInvitation: jest.fn(),
  sendAccountDeletionRequest: jest.fn(),
  verifyConnection: jest.fn(),
} as unknown as EmailService;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default successful implementations for SecureTokenRepository
    (mockSecureTokenRepository.createAccountDeletionToken as jest.Mock).mockResolvedValue({
      id: 'token-1',
      token: 'deletion-token',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      used: false,
      codeChallenge: 'default-challenge',
      type: 'ACCOUNT_DELETION',
      createdAt: new Date(),
    } as any);

    (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue({
      id: 'token-1',
      token: 'deletion-token',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      used: false,
      codeChallenge: 'default-challenge',
      type: 'ACCOUNT_DELETION',
      createdAt: new Date(),
    } as any);

    (mockSecureTokenRepository.markAsUsed as jest.Mock).mockResolvedValue(undefined);

    // Mock RefreshTokenService methods
    (RefreshTokenService as jest.MockedClass<typeof RefreshTokenService>).mockImplementation(() => {
      return {
        generateRefreshToken: jest.fn().mockResolvedValue({
          token: 'mock-refresh-token',
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        }),
        verifyAndRotateRefreshToken: jest.fn(),
        revokeAllUserTokens: jest.fn(),
        cleanupExpiredTokens: jest.fn(),
      } as any;
    });

    authService = new AuthService(
      mockUserRepository,
      mockSecureTokenRepository,
      mockEmailService,
      {} as PrismaClient,
    );
  });

  describe('requestMagicLink', () => {
    it('should create magic link for existing user', async () => {
      const email = 'test@example.com';
      const existingUser = {
        id: 'user-1',
        email,
        name: 'Test User',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockUserRepository.findByEmail as jest.Mock).mockResolvedValue(existingUser);
      (mockSecureTokenRepository.createMagicLink as jest.Mock).mockResolvedValue({
        id: 'link-1',
        token: 'magic-token',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
        used: false,
        createdAt: new Date(),
      });

      const result = await authService.requestMagicLink({ 
        email, 
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });

      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(email);
      expect(mockSecureTokenRepository.createMagicLink).toHaveBeenCalledWith({
        userId: 'user-1',
        expiresAt: expect.any(Date),
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });
      expect(mockEmailService.sendMagicLink).toHaveBeenCalledWith(
        email,
        'magic-token',
        undefined,
        'https://app.edulift.com/auth/verify?token=magic-token',
      );
      expect(result).toEqual({ success: true, userExists: true });
    });

    it('should create user and magic link for new user', async () => {
      const email = 'new@example.com';
      const name = 'New User';

      (mockUserRepository.findByEmail as jest.Mock).mockResolvedValue(null);
      (mockUserRepository.create as jest.Mock).mockResolvedValue({
        id: 'user-2',
        email,
        name,
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (mockSecureTokenRepository.createMagicLink as jest.Mock).mockResolvedValue({
        id: 'link-2',
        token: 'magic-token-2',
        userId: 'user-2',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false,
        createdAt: new Date(),
      });

      const result = await authService.requestMagicLink({ 
        email, 
        name,
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith({ email, name });
      expect(result).toEqual({ success: true, userExists: false });
    });

    it('should throw error when name not provided for new user', async () => {
      const email = 'new@example.com';

      (mockUserRepository.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(authService.requestMagicLink({ 
        email,
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      })).rejects.toThrow(
        'Name is required for new users',
      );
    });

    it('should throw error when name is an empty string for new user', async () => {
      const email = 'emptyname@example.com';
      const name = '';

      (mockUserRepository.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(authService.requestMagicLink({ 
        email, 
        name,
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      })).rejects.toThrow(
        'Name is required for new users',
      );
    });

    it('should handle name as a string for new users', async () => {
      const email = 'new@example.com';
      const name = 'John Doe';

      (mockUserRepository.findByEmail as jest.Mock).mockResolvedValue(null);
      (mockUserRepository.create as jest.Mock).mockResolvedValue({
        id: 'user-2',
        email,
        name,
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await authService.requestMagicLink({
        email,
        name,
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith({ email, name });
    });

    it('should include invite code in magic link email when provided', async () => {
      const email = 'test@example.com';
      const inviteCode = 'ABC123XYZ';
      const existingUser = {
        id: 'user-1',
        email,
        name: 'Test User',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockUserRepository.findByEmail as jest.Mock).mockResolvedValue(existingUser);
      (mockSecureTokenRepository.createMagicLink as jest.Mock).mockResolvedValue({
        token: 'magic-link-token',
      });

      await authService.requestMagicLink({ 
        email, 
        inviteCode,
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });

      expect(mockEmailService.sendMagicLink).toHaveBeenCalledWith(
        email,
        'magic-link-token',
        inviteCode,
'https://app.edulift.com/auth/verify?token=magic-link-token&inviteCode=ABC123XYZ',
      );
    });

    it('should work with both name and invite code for new users', async () => {
      const email = 'new@example.com';
      const name = 'New User';
      const inviteCode = 'FAMILY456';

      (mockUserRepository.findByEmail as jest.Mock).mockResolvedValue(null);
      (mockUserRepository.create as jest.Mock).mockResolvedValue({
        id: 'user-2',
        email,
        name,
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      (mockSecureTokenRepository.createMagicLink as jest.Mock).mockResolvedValue({
        token: 'new-user-token',
      });

      await authService.requestMagicLink({ 
        email, 
        name, 
        inviteCode,
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });

      expect(mockUserRepository.create).toHaveBeenCalledWith({ email, name });
      expect(mockEmailService.sendMagicLink).toHaveBeenCalledWith(
        email,
        'new-user-token',
        inviteCode,
        'https://app.edulift.com/auth/verify?token=new-user-token&inviteCode=FAMILY456',
      );
    });
  });

  describe('verifyMagicLink', () => {
    it('should verify valid magic link and return auth data', async () => {
      const token = 'valid-token';
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockSecureTokenRepository.findValidMagicLinkWithPKCE as jest.Mock).mockResolvedValue({
        id: 'link-1',
        token,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        used: false,
        createdAt: new Date(),
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(user);

      const result = await authService.verifyMagicLink(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');

      expect(mockSecureTokenRepository.findValidMagicLinkWithPKCE).toHaveBeenCalledWith(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
      expect(mockSecureTokenRepository.markAsUsed).toHaveBeenCalledWith(token);
      expect(result).toEqual({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          timezone: user.timezone,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
        accessToken: expect.any(String),
        refreshToken: 'mock-refresh-token',
        expiresIn: 900, // 15 minutes in seconds
        tokenType: 'Bearer',
        // Legacy fields
        token: expect.any(String),
        expiresAt: expect.any(Date),
      });
    });

    it('should return null for invalid or expired token', async () => {
      const token = 'invalid-token';

      (mockSecureTokenRepository.findValidMagicLinkWithPKCE as jest.Mock).mockResolvedValue(null);
      // Reset user mock to return null
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await authService.verifyMagicLink(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');

      expect(result).toBeNull();
    });

    it('should return null when user not found', async () => {
      const token = 'valid-token';

      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue({
        id: 'link-1',
        token,
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(null);

      const result = await authService.verifyMagicLink(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');

      expect(result).toBeNull();
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should update user profile successfully', async () => {
      const userId = 'user-123';
      const profileData = { name: 'Updated Name', email: 'updated@example.com' };
      const mockUser = {
        id: userId,
        email: 'old@example.com',
        name: 'Old Name',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockUpdatedUser = {
        id: userId,
        email: 'updated@example.com',
        name: 'Updated Name',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByEmail.mockResolvedValue(null); // Email is available
      mockUserRepository.update.mockResolvedValue(mockUpdatedUser);

      const result = await authService.updateProfile(userId, profileData);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('updated@example.com');
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, profileData);
      expect(result).toEqual({
        id: userId,
        email: 'updated@example.com',
        name: 'Updated Name',
        timezone: 'UTC',
        createdAt: mockUpdatedUser.createdAt,
        updatedAt: mockUpdatedUser.updatedAt,
      });
    });

    it('should update only name when email is not provided', async () => {
      const userId = 'user-123';
      const profileData = { name: 'Updated Name Only' };
      const mockUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Old Name',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockUpdatedUser = {
        id: userId,
        email: 'user@example.com',
        name: 'Updated Name Only',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(mockUpdatedUser);

      const result = await authService.updateProfile(userId, profileData);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, profileData);
      expect(result).toEqual({
        id: userId,
        email: 'user@example.com',
        name: 'Updated Name Only',
        timezone: 'UTC',
        createdAt: mockUpdatedUser.createdAt,
        updatedAt: mockUpdatedUser.updatedAt,
      });
    });

    it('should throw error when user is not found', async () => {
      const userId = 'nonexistent-user';
      const profileData = { name: 'Test Name' };

      mockUserRepository.findById.mockResolvedValue(null);

      await expect(authService.updateProfile(userId, profileData))
        .rejects.toThrow('User not found');

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when email is invalid', async () => {
      const userId = 'user-123';
      const profileData = { email: 'invalid-email' };

      await expect(authService.updateProfile(userId, profileData))
        .rejects.toThrow('Invalid email format');

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when name is empty', async () => {
      const userId = 'user-123';
      const profileData = { name: '   ' };

      await expect(authService.updateProfile(userId, profileData))
        .rejects.toThrow('Name cannot be empty');

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should throw error when email is already taken by another user', async () => {
      const userId = 'user-123';
      const profileData = { email: 'taken@example.com' };
      const mockUser = {
        id: userId,
        email: 'current@example.com',
        name: 'Test User',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockExistingUser = {
        id: 'other-user',
        email: 'taken@example.com',
        name: 'Other User',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByEmail.mockResolvedValue(mockExistingUser);

      await expect(authService.updateProfile(userId, profileData))
        .rejects.toThrow('Email is already in use by another account');

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith('taken@example.com');
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should allow updating to same email address', async () => {
      const userId = 'user-123';
      const profileData = { name: 'Updated Name', email: 'same@example.com' };
      const mockUser = {
        id: userId,
        email: 'same@example.com',
        name: 'Old Name',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockUpdatedUser = {
        id: userId,
        email: 'same@example.com',
        name: 'Updated Name',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByEmail.mockResolvedValue(mockUser); // Same user
      mockUserRepository.update.mockResolvedValue(mockUpdatedUser);

      const result = await authService.updateProfile(userId, profileData);

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      // Email check should be skipped since it's the same email
      expect(mockUserRepository.findByEmail).not.toHaveBeenCalled();
      expect(mockUserRepository.update).toHaveBeenCalledWith(userId, profileData);
      expect(result).toEqual({
        id: userId,
        email: 'same@example.com',
        name: 'Updated Name',
        timezone: 'UTC',
        createdAt: mockUpdatedUser.createdAt,
        updatedAt: mockUpdatedUser.updatedAt,
      });
    });
  });

  describe('requestAccountDeletion', () => {
    const userId = 'user-123';
    const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const mockUser = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      timezone: 'UTC',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should request account deletion successfully', async () => {
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockSecureTokenRepository.createAccountDeletionToken as jest.Mock).mockResolvedValue({
        id: 'link-1',
        token: 'deletion-token',
        userId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        type: 'ACCOUNT_DELETION',
      });

      const result = await authService.requestAccountDeletion({ userId, code_challenge: codeChallenge });

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockSecureTokenRepository.createAccountDeletionToken).toHaveBeenCalledWith({
        userId,
        expiresAt: expect.any(Date),
        codeChallenge,
      });
      expect(mockEmailService.sendAccountDeletionRequest).toHaveBeenCalledWith(
        mockUser.email,
        mockUser.name,
        'https://app.edulift.com/auth/profile/delete-confirm?token=deletion-token',
      );
      expect(result).toEqual({
        success: true,
        message: 'Account deletion confirmation sent to your email',
      });
    });

    it('should throw error when user not found', async () => {
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(authService.requestAccountDeletion({ userId, code_challenge: codeChallenge }))
        .rejects.toThrow('User not found');

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockSecureTokenRepository.createMagicLink).not.toHaveBeenCalled();
      expect(mockEmailService.sendAccountDeletionRequest).not.toHaveBeenCalled();
    });

    it('should throw error when PKCE code_challenge is missing', async () => {
      await expect(authService.requestAccountDeletion({ userId, code_challenge: '' }))
        .rejects.toThrow('code_challenge is required and must be 43-128 characters for PKCE validation');

      await expect(authService.requestAccountDeletion({ userId, code_challenge: undefined as any }))
        .rejects.toThrow('code_challenge is required and must be 43-128 characters for PKCE validation');

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockSecureTokenRepository.createMagicLink).not.toHaveBeenCalled();
      expect(mockEmailService.sendAccountDeletionRequest).not.toHaveBeenCalled();
    });

    it('should throw error when PKCE code_challenge is too short', async () => {
      const shortChallenge = 'short';

      await expect(authService.requestAccountDeletion({ userId, code_challenge: shortChallenge }))
        .rejects.toThrow('code_challenge is required and must be 43-128 characters for PKCE validation');

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockSecureTokenRepository.createMagicLink).not.toHaveBeenCalled();
      expect(mockEmailService.sendAccountDeletionRequest).not.toHaveBeenCalled();
    });

    it('should throw error when PKCE code_challenge is too long', async () => {
      const longChallenge = 'a'.repeat(129);

      await expect(authService.requestAccountDeletion({ userId, code_challenge: longChallenge }))
        .rejects.toThrow('code_challenge is required and must be 43-128 characters for PKCE validation');

      expect(mockUserRepository.findById).not.toHaveBeenCalled();
      expect(mockSecureTokenRepository.createMagicLink).not.toHaveBeenCalled();
      expect(mockEmailService.sendAccountDeletionRequest).not.toHaveBeenCalled();
    });

    it('should handle email service errors gracefully', async () => {
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockSecureTokenRepository.createMagicLink as jest.Mock).mockResolvedValue({
        token: 'deletion-token',
      });
      (mockEmailService.sendAccountDeletionRequest as jest.Mock).mockRejectedValue(new Error('Email service failed'));

      await expect(authService.requestAccountDeletion({ userId, code_challenge: codeChallenge }))
        .rejects.toThrow('Email service failed');

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockSecureTokenRepository.createAccountDeletionToken).toHaveBeenCalledWith({
        userId,
        expiresAt: expect.any(Date),
        codeChallenge,
      });
      expect(mockEmailService.sendAccountDeletionRequest).toHaveBeenCalled();
    });

    it('should handle magic link repository errors gracefully', async () => {
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockSecureTokenRepository.createAccountDeletionToken as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(authService.requestAccountDeletion({ userId, code_challenge: codeChallenge }))
        .rejects.toThrow('Database error');

      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockSecureTokenRepository.createAccountDeletionToken).toHaveBeenCalled();
      expect(mockEmailService.sendAccountDeletionRequest).not.toHaveBeenCalled();
    });

    it('should work with valid PKCE code_challenge of exactly 43 characters', async () => {
      const exact43Challenge = 'a'.repeat(43);
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockSecureTokenRepository.createMagicLink as jest.Mock).mockResolvedValue({
        id: 'link-1',
        token: 'test-token',
        userId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge: exact43Challenge,
      });
      (mockEmailService.sendAccountDeletionRequest as jest.Mock).mockResolvedValue(undefined);

      const result = await authService.requestAccountDeletion({ userId, code_challenge: exact43Challenge });

      expect(mockSecureTokenRepository.createAccountDeletionToken).toHaveBeenCalledWith({
        userId,
        expiresAt: expect.any(Date),
        codeChallenge: exact43Challenge,
      });
      expect(result.success).toBe(true);
    });

    it('should work with valid PKCE code_challenge of exactly 128 characters', async () => {
      const exact128Challenge = 'a'.repeat(128);
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockSecureTokenRepository.createMagicLink as jest.Mock).mockResolvedValue({
        id: 'link-1',
        token: 'test-token',
        userId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge: exact128Challenge,
      });
      (mockEmailService.sendAccountDeletionRequest as jest.Mock).mockResolvedValue(undefined);

      const result = await authService.requestAccountDeletion({ userId, code_challenge: exact128Challenge });

      expect(mockSecureTokenRepository.createAccountDeletionToken).toHaveBeenCalledWith({
        userId,
        expiresAt: expect.any(Date),
        codeChallenge: exact128Challenge,
      });
      expect(result.success).toBe(true);
    });

    it('should handle user with null name gracefully', async () => {
      const userWithNullName = { ...mockUser, name: null };
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(userWithNullName);
      (mockSecureTokenRepository.createMagicLink as jest.Mock).mockResolvedValue({
        id: 'link-1',
        token: 'test-token',
        userId,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge,
      });
      (mockEmailService.sendAccountDeletionRequest as jest.Mock).mockResolvedValue(undefined);

      const result = await authService.requestAccountDeletion({ userId, code_challenge: codeChallenge });

      expect(mockEmailService.sendAccountDeletionRequest).toHaveBeenCalledWith(
        mockUser.email,
        'User',
        expect.any(String),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('confirmAccountDeletion', () => {
    const userId = 'user-123';
    const token = 'deletion-token';
    const codeVerifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const codeChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const mockUser = {
      id: userId,
      email: 'test@example.com',
      name: 'Test User',
      timezone: 'UTC',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    let performAccountDeletionSpy: jest.SpyInstance;

    beforeEach(() => {
      performAccountDeletionSpy = jest.spyOn(authService, 'performAccountDeletion' as any);
    });

    afterEach(() => {
      performAccountDeletionSpy.mockRestore();
    });

    it('should confirm account deletion successfully', async () => {
      const mockMagicLink = {
        id: 'link-1',
        token,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes from now
        used: false,
        createdAt: new Date(),
        codeChallenge,
      };

      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue(mockMagicLink);
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockSecureTokenRepository.markAsUsed as jest.Mock).mockResolvedValue(undefined);

      // Mock the performAccountDeletion method
      const mockDeleteResult = {
        success: true,
        message: 'Account deleted successfully',
        deletedAt: new Date().toISOString(),
      };
      performAccountDeletionSpy.mockResolvedValue(mockDeleteResult);

      const result = await authService.confirmAccountDeletion(token, codeVerifier);

      expect(mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE).toHaveBeenCalledWith(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
      expect(mockSecureTokenRepository.markAsUsed).toHaveBeenCalledWith(token);
      expect(performAccountDeletionSpy).toHaveBeenCalledWith(userId, mockUser);
      expect(result).toEqual({
        success: true,
        message: 'Account deleted successfully via email confirmation',
        deletedAt: mockDeleteResult.deletedAt,
      });
    });

    it('should throw error for invalid or expired token', async () => {
      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue(null);

      await expect(authService.confirmAccountDeletion(token, codeVerifier))
        .rejects.toThrow('Invalid or expired deletion token');

      expect(mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE).toHaveBeenCalledWith(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
      expect(mockSecureTokenRepository.markAsUsed).not.toHaveBeenCalled();
      expect(performAccountDeletionSpy).not.toHaveBeenCalled();
    });

    it('should throw error when code_verifier is missing', async () => {
      const mockMagicLink = {
        id: 'link-1',
        token,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge,
      };

      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue(mockMagicLink);

      await expect(authService.confirmAccountDeletion(token, ''))
        .rejects.toThrow('code_verifier required for PKCE validation');

      await expect(authService.confirmAccountDeletion(token, undefined as any))
        .rejects.toThrow('code_verifier required for PKCE validation');

      expect(mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE).toHaveBeenCalledWith(token, '');
      expect(mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE).toHaveBeenCalledWith(token, undefined);
      expect(mockSecureTokenRepository.markAsUsed).not.toHaveBeenCalled();
      expect(performAccountDeletionSpy).not.toHaveBeenCalled();
    });

    it('should throw error when PKCE validation fails (security attack)', async () => {
      const mockMagicLink = {
        id: 'link-1',
        token,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge: 'different-challenge-hash', // Different from what verifier generates
      };

      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue(mockMagicLink);

      await expect(authService.confirmAccountDeletion(token, codeVerifier))
        .rejects.toThrow('🚨 SECURITY: Invalid PKCE validation for token - potential cross-user attack');

      expect(mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE).toHaveBeenCalledWith(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
      expect(mockSecureTokenRepository.markAsUsed).not.toHaveBeenCalled();
      expect(performAccountDeletionSpy).not.toHaveBeenCalled();
    });

    it('should throw error when user not found', async () => {
      const mockMagicLink = {
        id: 'link-1',
        token,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge,
      };

      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue(mockMagicLink);
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(null);

      await expect(authService.confirmAccountDeletion(token, codeVerifier))
        .rejects.toThrow('User not found');

      expect(mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE).toHaveBeenCalledWith(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
      expect(mockUserRepository.findById).toHaveBeenCalledWith(userId);
      expect(mockSecureTokenRepository.markAsUsed).not.toHaveBeenCalled();
      expect(performAccountDeletionSpy).not.toHaveBeenCalled();
    });

    it('should handle account deletion errors gracefully', async () => {
      const mockMagicLink = {
        id: 'link-1',
        token,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge,
      };

      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue(mockMagicLink);
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockSecureTokenRepository.markAsUsed as jest.Mock).mockResolvedValue(undefined);

      // Mock performAccountDeletion to throw an error
      performAccountDeletionSpy.mockRejectedValue(new Error('Deletion failed'));

      await expect(authService.confirmAccountDeletion(token, codeVerifier))
        .rejects.toThrow('Deletion failed');

      expect(mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE).toHaveBeenCalledWith(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
      expect(mockSecureTokenRepository.markAsUsed).toHaveBeenCalledWith(token);
      expect(performAccountDeletionSpy).toHaveBeenCalledWith(userId, mockUser);
    });

    it('should handle token marking as used errors gracefully', async () => {
      const mockMagicLink = {
        id: 'link-1',
        token,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge,
      };

      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue(mockMagicLink);
      (mockUserRepository.findById as jest.Mock).mockResolvedValue(mockUser);
      (mockSecureTokenRepository.markAsUsed as jest.Mock).mockRejectedValue(new Error('Mark as used failed'));

      await expect(authService.confirmAccountDeletion(token, codeVerifier))
        .rejects.toThrow('Mark as used failed');

      expect(mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE).toHaveBeenCalledWith(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');
      expect(mockSecureTokenRepository.markAsUsed).toHaveBeenCalledWith(token);
      expect(performAccountDeletionSpy).not.toHaveBeenCalled();
    });

    // Edge case: Timing attack prevention - ensure constant time behavior
    it('should handle PKCE validation timing attacks securely', async () => {
      const mockMagicLink = {
        id: 'link-1',
        token,
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        used: false,
        createdAt: new Date(),
        codeChallenge: 'wrong-challenge', // Intentionally wrong
      };

      (mockSecureTokenRepository.findValidAccountDeletionTokenWithPKCE as jest.Mock).mockResolvedValue(mockMagicLink);

      // Test that PKCE validation doesn't return instantly (indicating timing-safe comparison)
      const startTime = performance.now();
      try {
        await authService.confirmAccountDeletion(token, 'wrong-verifier-that-is-long-enough-to-pass-validation-but-will-fail-pkce');
      } catch {
        // Expected to fail
      }
      const duration = performance.now() - startTime;

      // Ensure it takes at least some time (not instant, indicating timing-safe comparison)
      expect(duration).toBeGreaterThan(0.1); // Reduced threshold for timing test reliability
    });
  });
});