import { UnifiedInvitationService } from '../UnifiedInvitationService';
import { MockEmailService } from '../MockEmailService';
import { GroupInvitationStatus } from '@prisma/client';

describe('UnifiedInvitationService - Group Invitation Validation Security', () => {
  let invitationService: UnifiedInvitationService;
  let mockPrisma: any;
  let mockEmailService: MockEmailService;
  let mockLogger: any;

  beforeEach(() => {
    mockPrisma = {
      groupInvitation: {
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    mockEmailService = new MockEmailService();
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    invitationService = new UnifiedInvitationService(mockPrisma, mockLogger, mockEmailService);
  });

  describe('validateGroupInvitation - Basic Validation', () => {
    const inviteCode = 'GRP123A';

    it('should validate a valid group invitation without authentication', async () => {
      // Arrange
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
        email: 'user@example.com',
        group: { 
          id: 'group-123',
          name: 'Test Carpool Group', 
        },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
      });

      // Act
      const result = await invitationService.validateGroupInvitation(inviteCode);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.groupName).toBe('Test Carpool Group');
      expect(result.email).toBe('user@example.com');
      expect(result.existingUser).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should return error for invalid invitation code', async () => {
      // Arrange
      mockPrisma.groupInvitation.findFirst.mockResolvedValue(null);

      // Act
      const result = await invitationService.validateGroupInvitation('INVALID');

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid invitation code');
      expect(result.groupName).toBeUndefined();
    });

    it('should return error for expired invitation', async () => {
      // Arrange
      const expiredInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Expired 24 hours ago
        group: { name: 'Test Group' },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(expiredInvitation);

      // Act
      const result = await invitationService.validateGroupInvitation(inviteCode);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invitation has expired');
    });

    it('should handle invitation without email (public invitation)', async () => {
      // Arrange
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: null, // Public invitation
        group: { 
          id: 'group-123',
          name: 'Public Group', 
        },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);

      // Act
      const result = await invitationService.validateGroupInvitation(inviteCode);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.groupName).toBe('Public Group');
      expect(result.email).toBeUndefined();
      expect(result.existingUser).toBeUndefined();
    });
  });

  describe('validateGroupInvitation - Email Security Validation', () => {
    const inviteCode = 'GRP123A';
    const currentUserId = 'current-user-123';

    it('should allow access when authenticated user email matches invitation email', async () => {
      // Arrange
      const invitationEmail = 'jerome.revillard@be-ys-software.com';
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: invitationEmail,
        group: { 
          id: 'group-123',
          name: 'Collège Carpool', 
        },
      };

      const mockCurrentUser = {
        id: currentUserId,
        email: invitationEmail, // Same email as invitation
        name: 'Jerome Revillard',
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(mockCurrentUser) // For security check
        .mockResolvedValueOnce(mockCurrentUser); // For existingUser check

      // Act
      const result = await invitationService.validateGroupInvitation(inviteCode, currentUserId);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.groupName).toBe('Collège Carpool');
      expect(result.email).toBe(invitationEmail);
      expect(result.existingUser).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should block access when authenticated user email does not match invitation email', async () => {
      // Arrange
      const invitationEmail = 'jerome.revillard@be-ys-software.com';
      const wrongUserEmail = 'other.user@example.com';
      
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: invitationEmail,
        group: { 
          id: 'group-123',
          name: 'Collège Carpool', 
        },
      };

      const mockCurrentUser = {
        id: currentUserId,
        email: wrongUserEmail, // Different email from invitation
        name: 'Wrong User',
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue(mockCurrentUser);

      // Act
      const result = await invitationService.validateGroupInvitation(inviteCode, currentUserId);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('This invitation was sent to a different email address. Please log in with the correct account or sign up.');
      expect(result.errorCode).toBe('EMAIL_MISMATCH');
      expect(result.groupName).toBeUndefined();
    });

    it('should allow access for unauthenticated users (no currentUserId provided)', async () => {
      // Arrange
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: 'jerome.revillard@be-ys-software.com',
        group: { 
          id: 'group-123',
          name: 'Collège Carpool', 
        },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'existing-user',
        email: 'jerome.revillard@be-ys-software.com',
        name: 'Jerome Revillard',
      });

      // Act - No currentUserId provided (unauthenticated)
      const result = await invitationService.validateGroupInvitation(inviteCode);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.groupName).toBe('Collège Carpool');
      expect(result.email).toBe('jerome.revillard@be-ys-software.com');
      expect(result.existingUser).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should allow access for invitations without email even when user is authenticated', async () => {
      // Arrange - Public invitation without specific email
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: null, // No specific email (public invitation)
        group: { 
          id: 'group-123',
          name: 'Public Group', 
        },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);

      // Act - Authenticated user but invitation has no email
      const result = await invitationService.validateGroupInvitation(inviteCode, currentUserId);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.groupName).toBe('Public Group');
      expect(result.email).toBeUndefined();
      expect(result.existingUser).toBeUndefined();
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });

    it('should handle case when current user is not found in database', async () => {
      // Arrange
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: 'jerome.revillard@be-ys-software.com',
        group: { 
          id: 'group-123',
          name: 'Test Group', 
        },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // Current user not found in security check
        .mockResolvedValueOnce({ // But invitation email user exists
          id: 'invited-user',
          email: 'jerome.revillard@be-ys-software.com',
          name: 'Jerome Revillard',
        });

      // Act
      const result = await invitationService.validateGroupInvitation(inviteCode, currentUserId);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.groupName).toBe('Test Group');
      expect(result.email).toBe('jerome.revillard@be-ys-software.com');
      expect(result.existingUser).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.errorCode).toBeUndefined();
    });
  });

  describe('validateGroupInvitation - User Existence Check', () => {
    const inviteCode = 'GRP123A';

    it('should correctly identify existing user', async () => {
      // Arrange
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: 'existing.user@example.com',
        group: { 
          id: 'group-123',
          name: 'Test Group', 
        },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        email: 'existing.user@example.com',
        name: 'Existing User',
      });

      // Act
      const result = await invitationService.validateGroupInvitation(inviteCode);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.email).toBe('existing.user@example.com');
      expect(result.existingUser).toBe(true);
    });

    it('should correctly identify non-existing user', async () => {
      // Arrange
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: 'new.user@example.com',
        group: { 
          id: 'group-123',
          name: 'Test Group', 
        },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue(null); // User doesn't exist

      // Act
      const result = await invitationService.validateGroupInvitation(inviteCode);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.email).toBe('new.user@example.com');
      expect(result.existingUser).toBe(false);
    });
  });

  describe('validateGroupInvitation - Prisma Call Verification', () => {
    const inviteCode = 'GRP123A';

    it('should call Prisma with correct parameters for finding invitation', async () => {
      // Arrange
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        group: { name: 'Test Group' },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);

      // Act
      await invitationService.validateGroupInvitation(inviteCode);

      // Assert
      expect(mockPrisma.groupInvitation.findFirst).toHaveBeenCalledWith({
        where: {
          inviteCode,
          status: GroupInvitationStatus.PENDING,
        },
        include: {
          group: true,
          invitedByUser: true,
        },
      });
    });

    it('should call Prisma to check user existence when invitation has email', async () => {
      // Arrange
      const invitationEmail = 'test@example.com';
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: invitationEmail,
        group: { name: 'Test Group' },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // Act
      await invitationService.validateGroupInvitation(inviteCode);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: invitationEmail },
      });
    });

    it('should call Prisma to check current user when userId is provided', async () => {
      // Arrange
      const currentUserId = 'user-123';
      const invitationEmail = 'test@example.com';
      const mockInvitation = {
        id: 'invite-123',
        groupId: 'group-123',
        inviteCode,
        status: GroupInvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        email: invitationEmail,
        group: { name: 'Test Group' },
      };

      mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: currentUserId,
        email: invitationEmail,
        name: 'Test User',
      });

      // Act
      await invitationService.validateGroupInvitation(inviteCode, currentUserId);

      // Assert
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: currentUserId },
      });
    });
  });
});