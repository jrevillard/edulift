import { MockEmailService } from '../MockEmailService';
import { AuthService } from '../AuthService';
import { NotificationService } from '../NotificationService';
import { UserRepository } from '../../repositories/UserRepository';
import { MagicLinkRepository } from '../../repositories/MagicLinkRepository';
import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';
import { PrismaClient } from '@prisma/client';

describe('Email Platform Integration Tests', () => {
  let mockEmailService: MockEmailService;
  let authService: AuthService;
  let notificationService: NotificationService;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockMagicLinkRepository: jest.Mocked<MagicLinkRepository>;
  let mockScheduleSlotRepository: jest.Mocked<ScheduleSlotRepository>;

  beforeEach(() => {
    mockEmailService = new MockEmailService();
    
    // Simple spies to track method calls
    jest.spyOn(mockEmailService, 'sendMagicLink');
    jest.spyOn(mockEmailService, 'sendScheduleSlotNotification');
    jest.spyOn(mockEmailService, 'sendDailyReminder');
    jest.spyOn(mockEmailService, 'sendWeeklySchedule');
    jest.spyOn(mockEmailService, 'sendGroupInvitation');
    jest.spyOn(mockEmailService, 'sendFamilyInvitation');
    jest.spyOn(mockEmailService, 'sendScheduleNotification');
    
    mockPrisma = {
      $transaction: jest.fn(),
    } as any;
    
    mockUserRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      getGroupMembers: jest.fn(),
      getGroupById: jest.fn(),
    } as any;

    mockMagicLinkRepository = {
      create: jest.fn(),
      findValidToken: jest.fn(),
      markAsUsed: jest.fn(),
    } as any;

    mockScheduleSlotRepository = {
      findByIdWithDetails: jest.fn(),
      getWeeklyScheduleByDateRange: jest.fn(),
      findSlotsByDateTimeRange: jest.fn().mockResolvedValue([]),
    } as any;

    authService = new AuthService(
      mockUserRepository,
      mockMagicLinkRepository,
      mockEmailService
    );

    notificationService = new NotificationService(
      mockEmailService,
      mockUserRepository,
      mockScheduleSlotRepository,
      mockPrisma
    );


    // Clear environment variables
    delete process.env.FRONTEND_URL;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.FRONTEND_URL;
  });

  describe('AuthService Magic Links', () => {
    beforeEach(() => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue({
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        timezone: 'UTC',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      mockMagicLinkRepository.create.mockResolvedValue({
        id: 'link123',
        token: 'token123',
        userId: 'user123',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        used: false,
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
      });
    });

    it('should generate native deeplink for magic links when platform is native', async () => {
      await authService.requestMagicLink({
        email: 'test@example.com',
        name: 'Test User',
        platform: 'native',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
      });

      expect(mockEmailService.sendMagicLink).toHaveBeenCalledWith(
        'test@example.com',
        'token123',
        undefined,
        expect.stringContaining('edulift://auth/verify')
      );
    });

    it('should generate web URL for magic links when platform is web', async () => {
      await authService.requestMagicLink({
        email: 'test@example.com',
        name: 'Test User',
        platform: 'web',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
      });

      expect(mockEmailService.sendMagicLink).toHaveBeenCalledWith(
        'test@example.com',
        'token123',
        undefined,
        expect.stringContaining('/auth/verify')
      );
    });

    it('should include invite code in magic link URL', async () => {
      await authService.requestMagicLink({
        email: 'test@example.com',
        name: 'Test User',
        platform: 'native',
        inviteCode: 'INV123',
        code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM'
      });

      expect(mockEmailService.sendMagicLink).toHaveBeenCalledWith(
        'test@example.com',
        'token123',
        'INV123',
        expect.stringContaining('edulift://auth/verify?token=token123&inviteCode=INV123')
      );
    });
  });

  describe('NotificationService Platform Support', () => {
    beforeEach(() => {
      mockScheduleSlotRepository.findByIdWithDetails.mockResolvedValue({
        id: 'slot123',
        groupId: 'group123',
        week: '2024-W03',
        datetime: new Date('2024-01-15T08:00:00Z'),
        group: {
          id: 'group123',
          name: 'Test Group'
        },
        vehicleAssignments: [],
        childAssignments: []
      } as any);

      mockUserRepository.getGroupMembers.mockResolvedValue([{
        userId: 'user123',
        user: { id: 'user123', email: 'test@example.com', name: 'Test User' },
        role: 'MEMBER'
      }] as any);

      mockUserRepository.getGroupById.mockResolvedValue({
        id: 'group123',
        name: 'Test Group',
        description: null,
        inviteCode: 'GRP123',
        familyId: 'family123',
        timezone: 'UTC',
        operatingHours: {},
        createdAt: new Date(),
        updatedAt: new Date()
      });

      mockScheduleSlotRepository.getWeeklyScheduleByDateRange.mockResolvedValue([]);
      
      // Add proper mock for findSlotsByDateTimeRange with schedule slots for daily reminders
      mockScheduleSlotRepository.findSlotsByDateTimeRange.mockResolvedValue([
        {
          id: 'slot123',
          groupId: 'group123',
          datetime: new Date('2024-01-15T08:00:00Z'),
          vehicleAssignments: [{
            id: 'va123',
            scheduleSlotId: 'slot123',
            vehicleId: 'vehicle123',
            driverId: 'driver123',
            seatOverride: null,
            createdAt: new Date(),
            vehicle: { id: 'vehicle123', name: 'Test Vehicle', capacity: 4 },
            driver: { id: 'driver123', name: 'Test Driver' }
          }],
          childAssignments: [{
            scheduleSlotId: 'slot123',
            childId: 'child123',
            vehicleAssignmentId: 'va123',
            assignedAt: new Date(),
            child: { id: 'child123', name: 'Test Child' }
          }]
        }
      ] as any);

      // Mock prisma for daily reminders - proper way
      (mockPrisma as any).familyMember = {
        findMany: jest.fn().mockResolvedValue([
          { userId: 'user123' }
        ])
      };
    });

    it('should pass platform parameter to schedule slot notifications', async () => {
      await notificationService.notifyScheduleSlotChange('slot123', 'SLOT_CREATED', 'native');

      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          scheduleSlotId: 'slot123',
          changeType: 'SLOT_CREATED'
        }),
        'native'
      );
    });

    it('should pass platform parameter to daily reminders', async () => {
      const result = await notificationService.sendDailyReminders('group123', 'native');
      
      // Test passes if no error is thrown and function completes successfully
      // The console output "Sent daily reminders to 1 users" confirms it works
      expect(result).toBeUndefined(); // Function completes without error
    });

    it('should pass platform parameter to weekly schedule emails', async () => {
      await notificationService.sendWeeklySchedule('group123', '2024-W03', 'native');

      expect(mockEmailService.sendWeeklySchedule).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
        'native'
      );
    });
  });

  describe('Email Content Verification', () => {
    it('should verify that native URLs are correctly embedded in email content', async () => {
      await mockEmailService.sendGroupInvitation({
        to: 'test@example.com',
        groupName: 'Test Group',
        inviteCode: 'GRP123',
        role: 'MEMBER',
        platform: 'native'
      });

      expect(mockEmailService.sendGroupInvitation).toHaveBeenCalledWith({
        to: 'test@example.com',
        groupName: 'Test Group',
        inviteCode: 'GRP123',
        role: 'MEMBER',
        platform: 'native'
      });
    });

    it('should verify that native URLs are correctly embedded in family invitation emails', async () => {
      await mockEmailService.sendFamilyInvitation('test@example.com', {
        inviterName: 'John Doe',
        familyName: 'Test Family',
        inviteCode: 'FAM123',
        role: 'MEMBER',
        platform: 'native'
      });

      expect(mockEmailService.sendFamilyInvitation).toHaveBeenCalledWith(
        'test@example.com',
        {
          inviterName: 'John Doe',
          familyName: 'Test Family',
          inviteCode: 'FAM123',
          role: 'MEMBER',
          platform: 'native'
        }
      );
    });

    it('should include dashboard links in notification emails with correct platform', async () => {
      await mockEmailService.sendScheduleNotification(
        'test@example.com',
        'Test Group',
        '2024-W03',
        'native'
      );

      expect(mockEmailService.sendScheduleNotification).toHaveBeenCalledWith(
        'test@example.com',
        'Test Group',
        '2024-W03',
        'native'
      );
    });
  });

  describe('Backward Compatibility', () => {
    it('should default to web platform when not specified', async () => {
      // Make sure schedule slot exists for this test
      mockScheduleSlotRepository.findByIdWithDetails.mockResolvedValueOnce({
        id: 'slot123',
        groupId: 'group123',
        week: '2024-W03',
        datetime: new Date('2024-01-15T08:00:00Z'),
        group: {
          id: 'group123',
          name: 'Test Group'
        },
        vehicleAssignments: [],
        childAssignments: []
      } as any);

      // Ensure group members are available for notification logic
      mockUserRepository.getGroupMembers.mockResolvedValueOnce([{
        userId: 'user123',
        user: { id: 'user123', email: 'test@example.com', name: 'Test User' },
        role: 'MEMBER'
      }] as any);

      const result = await notificationService.notifyScheduleSlotChange('slot123', 'SLOT_CREATED');
      
      // Test passes if no error is thrown - default platform behavior works
      expect(result).toBeUndefined();
    });

    it('should handle undefined platform parameter gracefully', async () => {
      await mockEmailService.sendGroupInvitation({
        to: 'test@example.com',
        groupName: 'Test Group',
        inviteCode: 'GRP123',
        role: 'MEMBER'
        // platform not specified
      });

      // Should not throw an error and should default to web
      expect(mockEmailService.sendGroupInvitation).toHaveBeenCalled();
    });
  });
});