import { AuthService } from '../AuthService';
import { UserRepository } from '../../repositories/UserRepository';
import { MagicLinkRepository } from '../../repositories/MagicLinkRepository';
import { EmailService } from '../EmailService';
import { RefreshTokenService } from '../RefreshTokenService';

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

const mockMagicLinkRepository = {
  create: jest.fn(),
  findValidToken: jest.fn(),
  markAsUsed: jest.fn(),
  cleanupExpired: jest.fn(),
  findUserTokens: jest.fn(),
  revokeUserTokens: jest.fn(),
} as unknown as MagicLinkRepository;

const mockEmailService = {
  sendMagicLink: jest.fn(),
  sendScheduleNotification: jest.fn(),
  sendGroupInvitation: jest.fn(),
  verifyConnection: jest.fn(),
} as unknown as EmailService;

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();

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
      mockMagicLinkRepository,
      mockEmailService,
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
      (mockMagicLinkRepository.create as jest.Mock).mockResolvedValue({
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
      expect(mockMagicLinkRepository.create).toHaveBeenCalledWith({
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
      (mockMagicLinkRepository.create as jest.Mock).mockResolvedValue({
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
      (mockMagicLinkRepository.create as jest.Mock).mockResolvedValue({
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
      (mockMagicLinkRepository.create as jest.Mock).mockResolvedValue({
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

      (mockMagicLinkRepository.findValidToken as jest.Mock).mockResolvedValue({
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

      expect(mockMagicLinkRepository.findValidToken).toHaveBeenCalledWith(token);
      expect(mockMagicLinkRepository.markAsUsed).toHaveBeenCalledWith(token);
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

      (mockMagicLinkRepository.findValidToken as jest.Mock).mockResolvedValue(null);

      const result = await authService.verifyMagicLink(token, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk');

      expect(result).toBeNull();
    });

    it('should return null when user not found', async () => {
      const token = 'valid-token';

      (mockMagicLinkRepository.findValidToken as jest.Mock).mockResolvedValue({
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
});