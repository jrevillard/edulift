import { UnifiedInvitationService } from '../UnifiedInvitationService';
import { MockEmailService } from '../MockEmailService';
import { FamilyRole, GroupRole, FamilyInvitationStatus as InvitationStatus } from '@prisma/client';

describe('UnifiedInvitationService - TDD Implementation', () => {
  let invitationService: UnifiedInvitationService;
  let mockPrisma: any;
  let mockEmailService: MockEmailService;
  let mockLogger: any;

  beforeEach(() => {
    mockPrisma = {
      family: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      familyMember: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn()
      },
      familyInvitation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      group: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      groupFamilyMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      groupInvitation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      child: {
        findMany: jest.fn(),
      },
      groupChildMember: {
        createMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    mockEmailService = new MockEmailService();
    mockEmailService.sendGroupInvitation = jest.fn();
    mockEmailService.sendFamilyInvitation = jest.fn();
    
    invitationService = new UnifiedInvitationService(
      mockPrisma,
      mockLogger,
      mockEmailService
    );
    
    jest.clearAllMocks();
  });

  describe('Family Invitations', () => {
    describe('createFamilyInvitation', () => {
      const familyId = 'family-123';
      const adminId = 'admin-123';
      const inviteData = {
        email: 'newmember@example.com',
        role: FamilyRole.MEMBER,
        personalMessage: 'Welcome to our family!'
      };

      it('should create invitation with unique code for each invitation', async () => {
        // RED: This test will fail initially as service doesn't exist
        const mockFamily = { 
          id: familyId, 
          name: 'Test Family',
          members: []
        };
        
        const mockInviterMember = {
          userId: adminId,
          familyId,
          role: FamilyRole.ADMIN,
          family: mockFamily,
          user: { name: 'Admin User' }
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            family: {
              findUnique: jest.fn().mockResolvedValue(mockFamily),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(mockInviterMember),
              count: jest.fn().mockResolvedValue(1)
            },
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({
                id: 'invite-123',
                familyId,
                email: inviteData.email,
                role: inviteData.role,
                inviteCode: 'ABC1234',
                status: InvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                personalMessage: inviteData.personalMessage,
                createdBy: adminId
              })
            },
            user: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
          };
          return await callback(tx);
        });

        const result = await invitationService.createFamilyInvitation(familyId, inviteData, adminId);

        expect(result.inviteCode).toBe('ABC1234');
      });

      it('should support invitation without email (public link)', async () => {
        // RED: Test for public invitation links
        const publicInviteData = {
          role: FamilyRole.MEMBER,
          personalMessage: 'Join us!'
        };

        const mockFamily = { 
          id: familyId, 
          name: 'Test Family',
          members: []
        };
        
        const mockInviterMember = {
          userId: adminId,
          familyId,
          role: FamilyRole.ADMIN,
          family: mockFamily,
          user: { name: 'Admin User' }
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            family: {
              findUnique: jest.fn().mockResolvedValue(mockFamily),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(mockInviterMember),
              count: jest.fn().mockResolvedValue(1)
            },
            familyInvitation: {
              create: jest.fn().mockResolvedValue({
                id: 'invite-124',
                familyId,
                email: null,
                role: publicInviteData.role,
                inviteCode: 'ABC1234',
                status: InvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                personalMessage: publicInviteData.personalMessage,
                createdBy: adminId
              })
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.createFamilyInvitation(familyId, publicInviteData, adminId);

        expect(result.email).toBeNull();
        expect(result.inviteCode).toBe('ABC1234');
      });

      it('should throw error if user is not family admin', async () => {
        // RED: Test permission check
        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId,
                role: FamilyRole.MEMBER // Not admin
              })
            }
          };
          return await callback(tx);
        });

        await expect(invitationService.createFamilyInvitation(familyId, inviteData, adminId))
          .rejects.toThrow('Only family administrators can send invitations');
      });

      it('should prevent duplicate active invitations for same email', async () => {
        // RED: Test duplicate prevention
        const mockFamily = { 
          id: familyId, 
          name: 'Test Family',
          members: []
        };
        
        const mockInviterMember = {
          userId: adminId,
          familyId,
          role: FamilyRole.ADMIN,
          family: mockFamily,
          user: { name: 'Admin User' }
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            family: {
              findUnique: jest.fn().mockResolvedValue(mockFamily),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(mockInviterMember),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue(null) // User doesn't exist yet
            },
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'existing-invite',
                status: InvitationStatus.PENDING,
                email: inviteData.email
              })
            }
          };
          return await callback(tx);
        });

        await expect(invitationService.createFamilyInvitation(familyId, inviteData, adminId))
          .rejects.toThrow('An active invitation already exists for this email');
      });
    });

    describe('validateFamilyInvitation', () => {
      it('should validate invitation code without authentication', async () => {
        // RED: Public validation endpoint
        const inviteCode = 'VALID123';
        const mockInvitation = {
          id: 'invite-123',
          familyId: 'family-123',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: FamilyRole.MEMBER,
          personalMessage: 'Welcome!',
          family: {
            id: 'family-123',
            name: 'Test Family'
          },
          createdByUser: {
            name: 'Admin User'
          }
        };

        mockPrisma.familyInvitation.findFirst.mockResolvedValue(mockInvitation);

        const result = await invitationService.validateFamilyInvitation(inviteCode);

        expect(result.valid).toBe(true);
        expect(result.familyName).toBe('Test Family');
        expect(result.role).toBe(FamilyRole.MEMBER);
        expect(result.personalMessage).toBe('Welcome!');
        expect(result.inviterName).toBe('Admin User');
      });

      it('should return invalid for expired invitations', async () => {
        // RED: Test expiry validation
        const inviteCode = 'EXPIRED123';
        const mockInvitation = {
          id: 'invite-123',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Past date
        };

        mockPrisma.familyInvitation.findFirst.mockResolvedValue(mockInvitation);

        const result = await invitationService.validateFamilyInvitation(inviteCode);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invitation has expired');
      });

      it('should return invalid for non-existent codes', async () => {
        // RED: Test invalid code
        mockPrisma.familyInvitation.findFirst.mockResolvedValue(null);

        const result = await invitationService.validateFamilyInvitation('INVALID');

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid invitation code');
      });

      it('should reject authenticated user with different email than invitation', async () => {
        // SECURITY: Prevent invitation hijacking
        const inviteCode = 'SECURE123';
        const currentUserId = 'user-123';
        const mockInvitation = {
          id: 'invite-123',
          familyId: 'family-123',
          email: 'intended@example.com', // Invitation sent to this email
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: FamilyRole.MEMBER,
          family: {
            id: 'family-123',
            name: 'Test Family'
          },
          createdByUser: {
            name: 'Admin User'
          }
        };

        const mockCurrentUser = {
          id: currentUserId,
          email: 'hacker@example.com', // Different email
          familyMemberships: []
        };

        mockPrisma.familyInvitation.findFirst.mockResolvedValue(mockInvitation);
        mockPrisma.user.findUnique.mockResolvedValue(mockCurrentUser);

        const result = await invitationService.validateFamilyInvitation(inviteCode, currentUserId);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('This invitation was sent to a different email address. Please log in with the correct account or sign up.');
      });

      it('should allow authenticated user with matching email to validate invitation', async () => {
        // SECURITY: Allow correct user to validate invitation
        const inviteCode = 'SECURE123';
        const currentUserId = 'user-123';
        const mockInvitation = {
          id: 'invite-123',
          familyId: 'family-123',
          email: 'intended@example.com', // Invitation sent to this email
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: FamilyRole.MEMBER,
          family: {
            id: 'family-123',
            name: 'Test Family'
          },
          createdByUser: {
            name: 'Admin User'
          }
        };

        const mockCurrentUser = {
          id: currentUserId,
          email: 'intended@example.com', // Same email as invitation
          familyMemberships: []
        };

        mockPrisma.familyInvitation.findFirst.mockResolvedValue(mockInvitation);
        mockPrisma.user.findUnique.mockResolvedValue(mockCurrentUser);

        const result = await invitationService.validateFamilyInvitation(inviteCode, currentUserId);

        expect(result.valid).toBe(true);
        expect(result.familyName).toBe('Test Family');
        expect(result.email).toBe('intended@example.com');
      });
    });

    describe('acceptFamilyInvitation', () => {
      const inviteCode = 'VALID123';
      const userId = 'user-123';

      it('should handle user without family joining', async () => {
        // RED: User without family accepts invitation
        const mockInvitation = {
          id: 'invite-123',
          familyId: 'family-123',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: FamilyRole.MEMBER,
          family: { name: 'Test Family' }
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation),
              update: jest.fn().mockResolvedValue({
                ...mockInvitation,
                status: InvitationStatus.ACCEPTED,
                acceptedBy: userId,
                acceptedAt: new Date()
              })
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: userId, name: 'New User' })
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(null), // No existing family
              create: jest.fn().mockResolvedValue({
                userId,
                familyId: 'family-123',
                role: FamilyRole.MEMBER
              })
            },
            family: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'family-123',
                name: 'Test Family',
                members: [{
                  userId,
                  role: FamilyRole.MEMBER,
                  user: { id: userId, email: 'test@example.com', name: 'New User' }
                }],
                children: [],
                vehicles: []
              })
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);

        expect(result.success).toBe(true);
      });

      it('should prevent user with existing family from joining another', async () => {
        // RED: User with family tries to join another
        const mockInvitation = {
          id: 'invite-123',
          familyId: 'family-456',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation)
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: userId })
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId,
                familyId: 'family-123', // Different family
                role: FamilyRole.MEMBER,
                family: { name: 'Current Family' }
              })
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);
        expect(result.success).toBe(false);
        expect(result.error).toBe('You already belong to a family: Current Family');
      });

      it('should handle user leaving current family if they are not last admin', async () => {
        // RED: User can leave if not last admin
        const mockInvitation = {
          id: 'invite-123',
          familyId: 'family-456',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: FamilyRole.MEMBER,
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation),
              update: jest.fn()
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: userId })
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId,
                familyId: 'family-123',
                role: FamilyRole.ADMIN
              }),
              count: jest.fn().mockResolvedValue(2), // Multiple admins
              delete: jest.fn(),
              create: jest.fn()
            },
            family: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'family-456',
                name: 'New Family',
                members: [{
                  userId,
                  role: FamilyRole.MEMBER,
                  user: { id: userId, email: 'test@example.com', name: 'Test User' }
                }],
                children: [],
                vehicles: []
              })
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptFamilyInvitation(inviteCode, userId, { leaveCurrentFamily: true });

        expect(result.success).toBe(true);
      });

      it('should reject user with different email from accepting invitation', async () => {
        // SECURITY: Prevent invitation hijacking during acceptance
        const mockInvitation = {
          id: 'invite-123',
          familyId: 'family-123',
          email: 'intended@example.com', // Invitation sent to this email
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: FamilyRole.MEMBER,
          family: { name: 'Test Family' }
        };

        const mockUser = {
          id: userId,
          email: 'hacker@example.com', // Different email
          name: 'Hacker User'
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation)
            },
            user: {
              findUnique: jest.fn().mockResolvedValue(mockUser)
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);
        expect(result.success).toBe(false);
        expect(result.error).toBe('This invitation was sent to a different email address');
      });

      it('should allow user with matching email to accept invitation', async () => {
        // SECURITY: Allow correct user to accept invitation
        const mockInvitation = {
          id: 'invite-123',
          familyId: 'family-123',
          email: 'intended@example.com', // Invitation sent to this email
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: FamilyRole.MEMBER,
          family: { name: 'Test Family' }
        };

        const mockUser = {
          id: userId,
          email: 'intended@example.com', // Same email as invitation
          name: 'Intended User'
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation),
              update: jest.fn().mockResolvedValue({
                ...mockInvitation,
                status: InvitationStatus.ACCEPTED,
                acceptedBy: userId,
                acceptedAt: new Date()
              })
            },
            user: {
              findUnique: jest.fn().mockResolvedValue(mockUser)
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(null), // No existing family
              create: jest.fn().mockResolvedValue({
                userId,
                familyId: 'family-123',
                role: FamilyRole.MEMBER
              })
            },
            family: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'family-123',
                name: 'Test Family',
                members: [{
                  userId,
                  role: FamilyRole.MEMBER,
                  user: { id: userId, email: 'intended@example.com', name: 'Intended User' }
                }],
                children: [],
                vehicles: []
              })
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);

        expect(result.success).toBe(true);
      });
    });
  });

  describe('Group Invitations', () => {
    describe('createGroupInvitation', () => {
      const groupId = 'group-123';
      const adminId = 'admin-123';
      const targetFamilyId = 'family-456';

      it('should create invitation for entire family', async () => {
        // RED: Group invitations target families
        const inviteData = {
          targetFamilyId,
          role: GroupRole.MEMBER,
          personalMessage: 'Join our carpool group!'
        };

        const mockGroup = {
          id: groupId,
          name: 'Test Group',
          familyId: 'admin-family-123'
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            group: {
              findUnique: jest.fn().mockResolvedValue(mockGroup)
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId: 'admin-family-123',
                role: FamilyRole.ADMIN
              })
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue(null) // Not already member
            },
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue(null), // No existing
              create: jest.fn().mockResolvedValue({
                id: 'group-invite-123',
                groupId,
                targetFamilyId,
                role: inviteData.role,
                inviteCode: 'ABC1234',
                status: InvitationStatus.PENDING,
                personalMessage: inviteData.personalMessage,
                createdBy: adminId
              })
            },
            family: {
              findUnique: jest.fn().mockResolvedValue({
                id: targetFamilyId,
                name: 'Target Family',
                members: [
                  { role: FamilyRole.ADMIN, user: { email: 'admin@family.com' } }
                ]
              })
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.createGroupInvitation(groupId, inviteData, adminId);

        expect(result.targetFamilyId).toBe(targetFamilyId);
        expect(result.inviteCode).toBe('ABC1234');
      });

      it('should send emails to all family admins', async () => {
        // RED: Email notifications to family admins
        const inviteData = {
          targetFamilyId,
          role: GroupRole.MEMBER
        };

        const mockGroup = {
          id: groupId,
          name: 'Test Group',
          familyId: 'admin-family-123'
        };

        const mockTargetFamily = {
          id: targetFamilyId,
          name: 'Target Family',
          members: [
            { role: FamilyRole.ADMIN, user: { email: 'admin1@family.com', name: 'Admin One' } },
            { role: FamilyRole.ADMIN, user: { email: 'admin2@family.com', name: 'Admin Two' } },
            { role: FamilyRole.MEMBER, user: { email: 'member@family.com', name: 'Member' } }
          ]
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            group: {
              findUnique: jest.fn().mockResolvedValue(mockGroup)
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId: 'admin-family-123',
                role: FamilyRole.ADMIN
              })
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue(null)
            },
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({
                id: 'group-invite-123',
                groupId,
                targetFamilyId,
                inviteCode: 'ABC1234',
                status: InvitationStatus.PENDING
              })
            },
            family: {
              findUnique: jest.fn().mockResolvedValue(mockTargetFamily)
            }
          };
          return await callback(tx);
        });

        await invitationService.createGroupInvitation(groupId, inviteData, adminId);

        // Should send emails only to admins
        expect(mockEmailService.sendGroupInvitation).toHaveBeenCalledTimes(2);
        expect(mockEmailService.sendGroupInvitation).toHaveBeenCalledWith(
          expect.objectContaining({ to: 'admin1@family.com' })
        );
        expect(mockEmailService.sendGroupInvitation).toHaveBeenCalledWith(
          expect.objectContaining({ to: 'admin2@family.com' })
        );
      });

      it('should support public group invitations without target family', async () => {
        // RED: Public group invitation links
        const inviteData = {
          email: 'public@example.com',
          role: GroupRole.MEMBER,
          personalMessage: 'Open invitation to join!'
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            group: {
              findUnique: jest.fn().mockResolvedValue({
                id: groupId,
                name: 'Test Group',
                familyId: 'admin-family-123'
              })
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId: 'admin-family-123',
                role: FamilyRole.ADMIN
              })
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue(null)
            },
            groupInvitation: {
              create: jest.fn().mockResolvedValue({
                id: 'group-invite-124',
                groupId,
                targetFamilyId: null,
                email: inviteData.email,
                role: inviteData.role,
                inviteCode: 'ABC1234',
                status: InvitationStatus.PENDING,
                personalMessage: inviteData.personalMessage
              })
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.createGroupInvitation(groupId, inviteData, adminId);

        expect(result.targetFamilyId).toBeNull();
        expect(result.email).toBe('public@example.com');
        expect(result.inviteCode).toBe('ABC1234');
      });
    });

    describe('acceptGroupInvitation', () => {
      const inviteCode = 'GRPVALID123';
      const userId = 'user-123';

      it('should handle unauthenticated user flow', async () => {
        // RED: Unauthenticated user validates invitation
        const mockInvitation = {
          id: 'invite-123',
          groupId: 'group-123',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          group: { name: 'Test Group' }
        };

        mockPrisma.groupInvitation.findFirst.mockResolvedValue(mockInvitation);

        const validation = await invitationService.validateGroupInvitation(inviteCode);

        expect(validation.valid).toBe(true);
        expect(validation.groupName).toBe('Test Group');
      });

      it('should redirect user without family to onboarding', async () => {
        // RED: User without family needs onboarding
        const mockInvitation = {
          id: 'invite-123',
          groupId: 'group-123',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation)
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: userId })
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(null) // No family
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptGroupInvitation(inviteCode, userId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Family onboarding required');
      });

      it('should allow family admin to accept for entire family', async () => {
        // RED: Family admin accepts group invitation
        const mockInvitation = {
          id: 'invite-123',
          groupId: 'group-123',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: GroupRole.MEMBER,
          group: { id: 'group-123', name: 'Test Group' }
        };

        const userFamilyId = 'user-family-123';

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation),
              update: jest.fn()
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: userId })
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId,
                familyId: userFamilyId,
                role: FamilyRole.ADMIN,
                family: {
                  id: userFamilyId,
                  name: 'User Family',
                  members: [
                    { userId: 'user-1', role: FamilyRole.ADMIN },
                    { userId: 'user-2', role: FamilyRole.MEMBER }
                  ]
                }
              }),
              findMany: jest.fn().mockResolvedValue([
                { userId: 'user-1', role: FamilyRole.ADMIN },
                { userId: 'user-2', role: FamilyRole.MEMBER }
              ])
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue(null), // Not already member
              create: jest.fn()
            },
            child: {
              findMany: jest.fn().mockResolvedValue([])
            },
            groupChildMember: {
              createMany: jest.fn()
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptGroupInvitation(inviteCode, userId);

        expect(result.success).toBe(true);
      });

      it('should prevent family member from accepting group invitation', async () => {
        // RED: Non-admin cannot accept
        const mockInvitation = {
          id: 'invite-123',
          groupId: 'group-123',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation)
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: userId, name: 'Member User' })
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId,
                familyId: 'family-123',
                role: FamilyRole.MEMBER, // Not admin
                family: {
                  members: [
                    { role: FamilyRole.ADMIN, user: { name: 'Admin Name' } }
                  ]
                }
              })
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue(null)
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptGroupInvitation(inviteCode, userId);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Only your family admin can accept this invitation');
      });

      it('should handle family already in group', async () => {
        // RED: Family already member of group
        const mockInvitation = {
          id: 'invite-123',
          groupId: 'group-123',
          inviteCode,
          status: InvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          group: { name: 'Test Group' }
        };

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue(mockInvitation)
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({ id: userId })
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId,
                familyId: 'family-123',
                role: FamilyRole.ADMIN
              })
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue({
                familyId: 'family-123',
                groupId: 'group-123',
                joinedAt: new Date('2024-01-01')
              })
            }
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptGroupInvitation(inviteCode, userId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Your family is already a member of Test Group');
      });
    });
  });


  describe('Invitation Management', () => {
    describe('listInvitations', () => {
      it('should list all pending invitations for a user', async () => {
        // RED: Combined family and group invitations
        const userId = 'user-123';
        
        mockPrisma.user.findUnique.mockResolvedValue({
          id: userId,
          email: 'user@example.com'
        });
        
        mockPrisma.familyInvitation.findMany.mockResolvedValue([
          {
            id: 'fam-inv-1',
            inviteCode: 'FAM123',
            role: FamilyRole.MEMBER,
            status: InvitationStatus.PENDING,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            family: { name: 'Family One' }
          }
        ]);

        mockPrisma.groupInvitation.findMany.mockResolvedValue([
          {
            id: 'grp-inv-1',
            inviteCode: 'GRP123',
            role: GroupRole.MEMBER,
            status: InvitationStatus.PENDING,
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            group: { name: 'Group One' }
          }
        ]);

        const result = await invitationService.listUserInvitations(userId);

        expect(result.familyInvitations).toHaveLength(1);
        expect(result.groupInvitations).toHaveLength(1);
        expect(result.familyInvitations[0].familyName).toBe('Family One');
        expect(result.groupInvitations[0].groupName).toBe('Group One');
      });
    });

    describe('cancelInvitation', () => {
      it('should cancel family invitation by admin', async () => {
        // RED: Cancel family invitation
        const invitationId = 'fam-inv-123';
        const adminId = 'admin-123';

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            familyInvitation: {
              findUnique: jest.fn().mockResolvedValue({
                id: invitationId,
                familyId: 'family-123',
                status: InvitationStatus.PENDING
              }),
              update: jest.fn()
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId: 'family-123',
                role: FamilyRole.ADMIN
              })
            }
          };
          return await callback(tx);
        });

        await invitationService.cancelFamilyInvitation(invitationId, adminId);

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });

      it('should cancel group invitation by admin', async () => {
        // RED: Cancel group invitation
        const invitationId = 'grp-inv-123';
        const adminId = 'admin-123';

        mockPrisma.$transaction.mockImplementation(async (callback: any) => {
          const tx = {
            groupInvitation: {
              findUnique: jest.fn().mockResolvedValue({
                id: invitationId,
                groupId: 'group-123',
                status: InvitationStatus.PENDING,
                group: { familyId: 'admin-family-123' }
              }),
              update: jest.fn()
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId: 'admin-family-123',
                role: FamilyRole.ADMIN
              })
            }
          };
          return await callback(tx);
        });

        await invitationService.cancelGroupInvitation(invitationId, adminId);

        expect(mockPrisma.$transaction).toHaveBeenCalled();
      });
    });
  });

  describe('Cleanup Operations', () => {
    it('should clean up expired invitations', async () => {
      // RED: Cleanup service
      mockPrisma.familyInvitation.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.groupInvitation.updateMany.mockResolvedValue({ count: 2 });

      const result = await invitationService.cleanupExpiredInvitations();

      expect(mockPrisma.familyInvitation.updateMany).toHaveBeenCalledWith({
        where: {
          status: InvitationStatus.PENDING,
          expiresAt: { lt: expect.any(Date) }
        },
        data: { status: InvitationStatus.EXPIRED }
      });

      expect(result.familyInvitationsExpired).toBe(3);
      expect(result.groupInvitationsExpired).toBe(2);
    });
  });
});