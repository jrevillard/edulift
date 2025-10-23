import { UnifiedInvitationService } from '../services/UnifiedInvitationService';
import { FamilyRole, GroupRole, FamilyInvitationStatus, GroupInvitationStatus } from '@prisma/client';
import { MockEmailService } from '../services/MockEmailService';

describe('Invitation Edge Cases and Security Tests', () => {
  let invitationService: UnifiedInvitationService;
  let mockPrisma: any;
  let mockEmailService: MockEmailService;
  let mockLogger: any;

  beforeEach(() => {
    // Complete mock setup for edge case testing
    mockPrisma = {
      family: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      familyMember: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      familyInvitation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      group: {
        findUnique: jest.fn(),
      },
      groupFamilyMember: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      groupInvitation: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
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
    // Spy on the actual methods
    jest.spyOn(mockEmailService, 'sendFamilyInvitation').mockImplementation(jest.fn());
    jest.spyOn(mockEmailService, 'sendGroupInvitation').mockImplementation(jest.fn());
    jest.spyOn(mockEmailService, 'sendMagicLink').mockImplementation(jest.fn());
    invitationService = new UnifiedInvitationService(mockPrisma, mockLogger, mockEmailService);
  });

  describe('Family Invitation Edge Cases', () => {
    describe('Null Field Handling', () => {
      it('should handle invitation with null email (public link)', async () => {
        // TRUTH: Public invitations don't require email
        const familyId = 'family-123';
        const adminId = 'admin-123';
        const publicInviteData = {
          role: FamilyRole.MEMBER,
          personalMessage: 'Public invitation link',
        };

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId,
                role: FamilyRole.ADMIN,
                family: { id: familyId, name: 'Test Family' },
                user: { name: 'Admin User' },
              }),
              count: jest.fn().mockResolvedValue(1),
            },
            familyInvitation: {
              create: jest.fn().mockResolvedValue({
                id: 'public-invite-123',
                familyId,
                email: null, // Public invitation
                role: FamilyRole.MEMBER,
                inviteCode: 'PUBLIC12',
                personalMessage: 'Public invitation link',
                status: FamilyInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdBy: adminId,
                invitedBy: adminId,
              }),
            },
          };
          return await callback(tx);
        });

        const result = await invitationService.createFamilyInvitation(familyId, publicInviteData, adminId);

        expect(result.email).toBeNull();
        expect(result.inviteCode).toBe('PUBLIC12');
        expect(result.personalMessage).toBe('Public invitation link');
      });

      it('should handle invitation with null personal message', async () => {
        const familyId = 'family-123';
        const adminId = 'admin-123';
        const inviteData = {
          email: 'test@example.com',
          role: FamilyRole.MEMBER,
          // No personalMessage
        };

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId,
                role: FamilyRole.ADMIN,
                family: { id: familyId, name: 'Test Family' },
                user: { name: 'Admin User' },
              }),
              count: jest.fn().mockResolvedValue(1),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue(null),
            },
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockResolvedValue({
                id: 'no-message-invite',
                familyId,
                email: 'test@example.com',
                role: FamilyRole.MEMBER,
                inviteCode: 'NOMSG123',
                personalMessage: null, // No message
                status: FamilyInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdBy: adminId,
                invitedBy: adminId,
              }),
            },
          };
          return await callback(tx);
        });

        const result = await invitationService.createFamilyInvitation(familyId, inviteData, adminId);

        expect(result.personalMessage).toBeNull();
        expect(result.email).toBe('test@example.com');
      });
    });

    describe('Validation Edge Cases', () => {
      it('should handle validation request without authentication', async () => {
        // TRUTH: Public validation doesn't require authentication
        const inviteCode = 'PUBLIC123';
        const mockInvitation = {
          id: 'invitation-123',
          familyId: 'family-456',
          inviteCode,
          email: null, // Public invitation
          status: FamilyInvitationStatus.PENDING,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          role: FamilyRole.MEMBER,
          personalMessage: null,
          family: {
            id: 'family-456',
            name: 'Public Family',
          },
          createdByUser: {
            name: 'Public Admin',
          },
        };

        mockPrisma.familyInvitation.findFirst.mockResolvedValue(mockInvitation);

        const result = await invitationService.validateFamilyInvitation(inviteCode);

        expect(result.valid).toBe(true);
        expect(result.familyName).toBe('Public Family');
        expect(result.role).toBe(FamilyRole.MEMBER);
        expect(result.email).toBeUndefined();
        expect(result.personalMessage).toBeUndefined();
        expect(result.existingUser).toBeUndefined();
      });

      it('should handle validation with corrupted invitation data', async () => {
        // TRUTH: Graceful failure for corrupted data
        const inviteCode = 'CORRUPT1';
        
        // Simulate database returning null unexpectedly
        mockPrisma.familyInvitation.findFirst.mockImplementation(() => {
          throw new Error('Database connection lost');
        });

        const result = await invitationService.validateFamilyInvitation(inviteCode);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Temporary validation error. Please try again.');
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('should handle extremely long invite codes', async () => {
        // TRUTH: Handle malformed or malicious input
        const longCode = 'A'.repeat(10000); // Extremely long code
        
        mockPrisma.familyInvitation.findFirst.mockResolvedValue(null);

        const result = await invitationService.validateFamilyInvitation(longCode);

        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid invitation code');
        expect(result.errorCode).toBe('INVALID_CODE');
      });

      it('should handle special characters in invite codes', async () => {
        const specialCodes = [
          '\'; DROP TABLE families; --', // SQL injection attempt
          '<script>alert("xss")</script>', // XSS attempt
          '../../etc/passwd', // Path traversal attempt
          '%00%00%00', // Null byte injection
          'NORMAL123', // Normal code for comparison
        ];

        for (const code of specialCodes) {
          mockPrisma.familyInvitation.findFirst.mockResolvedValue(null);

          const result = await invitationService.validateFamilyInvitation(code);

          expect(result.valid).toBe(false);
          expect(result.error).toBe('Invalid invitation code');
          expect(result.errorCode).toBe('INVALID_CODE');
        }
      });
    });

    describe('Family Acceptance Edge Cases', () => {
      it('should handle acceptance with null email invitation', async () => {
        // TRUTH: Public invitations can be accepted by anyone
        const inviteCode = 'PUBLIC123';
        const userId = 'user-456';

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'public-invitation',
                familyId: 'family-789',
                inviteCode,
                email: null, // Public invitation
                status: FamilyInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                role: FamilyRole.MEMBER,
                family: { name: 'Public Family' },
              }),
              update: jest.fn().mockResolvedValue({}),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: userId,
                email: 'anyone@example.com',
                name: 'Any User',
              }),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(null), // No existing family
              create: jest.fn().mockResolvedValue({}),
            },
            family: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'family-789',
                name: 'Public Family',
                members: [],
                children: [],
                vehicles: [],
              }),
            },
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);

        expect(result.success).toBe(true);
      });

      it('should handle acceptance failure during transaction', async () => {
        const inviteCode = 'FAIL123';
        const userId = 'user-456';

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            familyInvitation: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'failing-invitation',
                familyId: 'family-fail',
                inviteCode,
                email: 'fail@example.com',
                status: FamilyInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                role: FamilyRole.MEMBER,
                family: { name: 'Fail Family' },
              }),
              update: jest.fn().mockRejectedValue(new Error('Database constraint violation')),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: userId,
                email: 'fail@example.com',
              }),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(null),
              create: jest.fn().mockRejectedValue(new Error('Database constraint violation')),
            },
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);
        expect(result.success).toBe(false);
        expect(result.error).toBe('Database constraint violation');
      });
    });
  });

  describe('Group Invitation Edge Cases', () => {
    describe('Complex Family Target Scenarios', () => {
      it('should handle group invitation to non-existent family', async () => {
        const groupId = 'group-123';
        const adminId = 'admin-456';
        const inviteData = {
          targetFamilyId: 'non-existent-family',
          role: GroupRole.MEMBER,
        };

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            group: {
              findUnique: jest.fn().mockResolvedValue({
                id: groupId,
                name: 'Test Group',
                familyId: 'admin-family',
              }),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId: 'admin-family',
                role: FamilyRole.ADMIN,
              }),
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            family: {
              findUnique: jest.fn().mockResolvedValue(null), // Family not found
            },
          };
          return await callback(tx);
        });

        await expect(invitationService.createGroupInvitation(groupId, inviteData, adminId))
          .rejects.toThrow('Target family not found');
      });

      it('should handle group invitation without target family or email', async () => {
        const groupId = 'group-123';
        const adminId = 'admin-456';
        const invalidData = {
          role: GroupRole.MEMBER,
          // Neither targetFamilyId nor email provided
        };

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            group: {
              findUnique: jest.fn().mockResolvedValue({
                id: groupId,
                name: 'Test Group',
                familyId: 'admin-family',
              }),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId: adminId,
                familyId: 'admin-family',
                role: FamilyRole.ADMIN,
              }),
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            groupInvitation: {
              create: jest.fn(),
            },
          };
          return await callback(tx);
        });

        await expect(invitationService.createGroupInvitation(groupId, invalidData, adminId))
          .rejects.toThrow('Either targetFamilyId or email must be provided for group invitations');
      });
    });

    describe('Group Acceptance Edge Cases', () => {
      it('should handle user without family trying to join group', async () => {
        const inviteCode = 'GROUP123';
        const userId = 'user-orphan';

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'group-inv-orphan',
                groupId: 'group-789',
                inviteCode,
                status: GroupInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                group: { name: 'Orphan Group' },
              }),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: userId,
                email: 'orphan@example.com',
              }),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue(null), // No family membership
            },
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptGroupInvitation(inviteCode, userId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Family onboarding required');
      });

      it('should handle family already being group member', async () => {
        const inviteCode = 'EXISTING1';
        const userId = 'user-existing';

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'existing-inv',
                groupId: 'group-existing',
                inviteCode,
                status: GroupInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                group: { id: 'group-existing', name: 'Existing Group' },
              }),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: userId,
                email: 'existing@example.com',
              }),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId,
                familyId: 'family-existing',
                role: FamilyRole.ADMIN,
              }),
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue({
                familyId: 'family-existing',
                groupId: 'group-existing',
                joinedAt: new Date('2024-01-01'),
              }),
            },
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptGroupInvitation(inviteCode, userId);

        expect(result.success).toBe(false);
        expect(result.error).toBe('Your family is already a member of Existing Group');
      });

      it('should handle non-admin family member trying to accept', async () => {
        const inviteCode = 'MEMBER123';
        const userId = 'user-member';

        mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
          const tx = {
            groupInvitation: {
              findFirst: jest.fn().mockResolvedValue({
                id: 'member-inv',
                groupId: 'group-member',
                inviteCode,
                status: GroupInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              }),
            },
            user: {
              findUnique: jest.fn().mockResolvedValue({
                id: userId,
                email: 'member@example.com',
              }),
            },
            familyMember: {
              findFirst: jest.fn().mockResolvedValue({
                userId,
                familyId: 'family-member',
                role: FamilyRole.MEMBER, // Not admin
                family: {
                  members: [{
                    role: FamilyRole.ADMIN,
                    user: { name: 'Family Admin' },
                  }],
                },
              }),
            },
            groupFamilyMember: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          };
          return await callback(tx);
        });

        const result = await invitationService.acceptGroupInvitation(inviteCode, userId);

        expect(result.success).toBe(false);
        expect(result.error).toContain('Only your family admin can accept this invitation');
      });
    });
  });

  describe('Concurrent Access and Race Conditions', () => {
    it('should handle concurrent invitation creation attempts', async () => {
      const familyId = 'family-race';
      const adminId = 'admin-race';
      const inviteData = {
        email: 'race@example.com',
        role: FamilyRole.MEMBER,
      };

      // Simulate race condition where first request creates, second finds existing
      let callCount = 0;
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        callCount++;
        const tx = {
          familyMember: {
            findFirst: jest.fn().mockResolvedValue({
              userId: adminId,
              familyId,
              role: FamilyRole.ADMIN,
              family: { id: familyId, name: 'Race Family' },
              user: { name: 'Race Admin' },
            }),
            count: jest.fn().mockResolvedValue(1),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(
              callCount === 1 ? null : { // First call: no existing, second: existing
                id: 'existing-race',
                email: 'race@example.com',
                status: FamilyInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            ),
            create: jest.fn().mockResolvedValue({
              id: `race-invite-${callCount}`,
              familyId,
              email: 'race@example.com',
              role: FamilyRole.MEMBER,
              inviteCode: `RACE${callCount}`,
              status: FamilyInvitationStatus.PENDING,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              createdBy: adminId,
              invitedBy: adminId,
            }),
          },
        };
        return await callback(tx);
      });

      // First call should succeed
      const result1 = await invitationService.createFamilyInvitation(familyId, inviteData, adminId);
      expect(result1.inviteCode).toBe('RACE1');

      // Second call should fail with duplicate error
      await expect(invitationService.createFamilyInvitation(familyId, inviteData, adminId))
        .rejects.toThrow('An active invitation already exists for this email');
    });

    it('should handle concurrent invitation acceptance attempts', async () => {
      const inviteCode = 'RACECOND';
      const userId = 'user-racer';

      let acceptCount = 0;
      mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        acceptCount++;
        const tx = {
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(
              acceptCount === 1 ? {
                id: 'race-invitation',
                familyId: 'race-family',
                inviteCode,
                email: 'racer@example.com',
                status: FamilyInvitationStatus.PENDING,
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                role: FamilyRole.MEMBER,
                family: { name: 'Race Family' },
              } : null, // Second attempt finds null (already processed)
            ),
            update: jest.fn(),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: userId,
              email: 'racer@example.com',
            }),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          family: {
            findUnique: jest.fn().mockResolvedValue({
              id: 'race-family',
              name: 'Race Family',
              members: [],
              children: [],
              vehicles: [],
            }),
          },
        };
        return await callback(tx);
      });

      // First acceptance should succeed
      const result1 = await invitationService.acceptFamilyInvitation(inviteCode, userId);
      expect(result1.success).toBe(true);

      // Second acceptance should fail
      const result2 = await invitationService.acceptFamilyInvitation(inviteCode, userId);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Invalid invitation code');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large family data without memory issues', async () => {
      const inviteCode = 'BIGFAM123';
      const userId = 'user-big';

      // Create large family data
      const largeFamily = {
        id: 'large-family',
        name: 'Large Family',
        members: Array(100).fill(null).map((_, i) => ({
          id: `member-${i}`,
          userId: `user-${i}`,
          role: i === 0 ? FamilyRole.ADMIN : FamilyRole.MEMBER,
          user: {
            id: `user-${i}`,
            email: `user${i}@largefamily.com`,
            name: `User ${i}`,
          },
        })),
        children: Array(50).fill(null).map((_, i) => ({
          id: `child-${i}`,
          familyId: 'large-family',
          name: `Child ${i}`,
          age: 5 + (i % 15),
          grade: `${1 + (i % 12)}th Grade`,
          school: `School ${i % 5}`,
        })),
        vehicles: Array(20).fill(null).map((_, i) => ({
          id: `vehicle-${i}`,
          familyId: 'large-family',
          make: `Make ${i}`,
          model: `Model ${i}`,
          year: 2010 + i,
          capacity: 4 + (i % 4),
          licensePlate: `PLATE${i.toString().padStart(3, '0')}`,
        })),
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const tx = {
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue({
              id: 'large-invite',
              familyId: 'large-family',
              inviteCode,
              email: 'bigfam@example.com',
              status: FamilyInvitationStatus.PENDING,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              role: FamilyRole.MEMBER,
              family: { name: 'Large Family' },
            }),
            update: jest.fn(),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue({
              id: userId,
              email: 'bigfam@example.com',
            }),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
          family: {
            findUnique: jest.fn().mockResolvedValue(largeFamily),
          },
        };
        return await callback(tx);
      });

      const startTime = Date.now();
      const result = await invitationService.acceptFamilyInvitation(inviteCode, userId);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);

      // Should complete within reasonable time (less than 1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle rapid validation requests without degradation', async () => {
      const baseCode = 'RAPID';
      
      // Mock multiple invitations
      mockPrisma.familyInvitation.findFirst.mockImplementation((args: any) => {
        const code = args.where.inviteCode;
        if (code.startsWith(baseCode)) {
          const index = code.replace(baseCode, '');
          return Promise.resolve({
            id: `rapid-${index}`,
            familyId: `family-${index}`,
            inviteCode: code,
            status: FamilyInvitationStatus.PENDING,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            role: FamilyRole.MEMBER,
            family: { id: `family-${index}`, name: `Rapid Family ${index}` },
            createdByUser: { name: `Admin ${index}` },
          });
        }
        return Promise.resolve(null);
      });

      // Make rapid concurrent requests
      const startTime = Date.now();
      const promises = Array(50).fill(null).map(async (_, i) => {
        return await invitationService.validateFamilyInvitation(`${baseCode}${i}`);
      });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should succeed
      results.forEach((result, i) => {
        expect(result.valid).toBe(true);
        expect(result.familyName).toBe(`Rapid Family ${i}`);
      });

      // Should complete within reasonable time
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('International and Unicode Support', () => {
    it('should handle unicode characters in family names and messages', async () => {
      const familyId = 'unicode-family';
      const adminId = 'unicode-admin';
      const unicodeData = {
        email: 'unicode@example.com',
        role: FamilyRole.MEMBER,
        personalMessage: '¡Bienvenido! 🎉 欢迎加入我们的家庭 👨‍👩‍👧‍👦',
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const tx = {
          familyMember: {
            findFirst: jest.fn().mockResolvedValue({
              userId: adminId,
              familyId,
              role: FamilyRole.ADMIN,
              family: { 
                id: familyId, 
                name: 'Família José 李家庭 🏠', 
              },
              user: { name: 'José María 李明' },
            }),
            count: jest.fn().mockResolvedValue(1),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'unicode-invite',
              familyId,
              email: 'unicode@example.com',
              role: FamilyRole.MEMBER,
              inviteCode: 'UNICODE1',
              personalMessage: unicodeData.personalMessage,
              status: FamilyInvitationStatus.PENDING,
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              createdBy: adminId,
              invitedBy: adminId,
            }),
          },
        };
        return await callback(tx);
      });

      const result = await invitationService.createFamilyInvitation(familyId, unicodeData, adminId);

      expect(result.personalMessage).toBe('¡Bienvenido! 🎉 欢迎加入我们的家庭 👨‍👩‍👧‍👦');
      expect(result.email).toBe('unicode@example.com');
      expect(mockEmailService.sendFamilyInvitation).toHaveBeenCalledWith(
        'unicode@example.com',
        expect.objectContaining({
          familyName: 'Família José 李家庭 🏠',
          inviterName: 'José María 李明',
          personalMessage: unicodeData.personalMessage,
        }),
      );
    });

    it('should handle very long unicode strings', async () => {
      const longUnicodeMessage = `${'🎉'.repeat(1000)  }Welcome to our family! ${  '欢迎'.repeat(500)}`;
      
      const familyId = 'long-unicode';
      const adminId = 'long-admin';
      const longData = {
        email: 'long@example.com',
        role: FamilyRole.MEMBER,
        personalMessage: longUnicodeMessage,
      };

      mockPrisma.$transaction.mockImplementation(async (callback: (tx: any) => Promise<any>) => {
        const tx = {
          familyMember: {
            findFirst: jest.fn().mockResolvedValue({
              userId: adminId,
              familyId,
              role: FamilyRole.ADMIN,
              family: { id: familyId, name: 'Long Unicode Family' },
              user: { name: 'Long Admin' },
            }),
            count: jest.fn().mockResolvedValue(1),
          },
          user: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
          familyInvitation: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({
              id: 'long-unicode-invite',
              personalMessage: longUnicodeMessage,
            }),
          },
        };
        return await callback(tx);
      });

      const result = await invitationService.createFamilyInvitation(familyId, longData, adminId);

      expect(result.personalMessage).toBe(longUnicodeMessage);
      expect(result.personalMessage?.length).toBeGreaterThan(2000);
    });
  });
});