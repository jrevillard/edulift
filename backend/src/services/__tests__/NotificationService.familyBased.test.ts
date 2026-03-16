import { NotificationService } from '../NotificationService';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../repositories/UserRepository';
import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';
import { TEST_IDS } from '../../utils/testHelpers';

// Mock dependencies
const mockEmailService = {
  sendMagicLink: jest.fn().mockResolvedValue(undefined),
  sendScheduleNotification: jest.fn().mockResolvedValue(undefined),
  sendGroupInvitation: jest.fn().mockResolvedValue(undefined),
  sendScheduleSlotNotification: jest.fn().mockResolvedValue(undefined),
  sendDailyReminder: jest.fn().mockResolvedValue(undefined),
  sendWeeklySchedule: jest.fn().mockResolvedValue(undefined),
  sendFamilyInvitation: jest.fn().mockResolvedValue(undefined),
  sendAccountDeletionRequest: jest.fn().mockResolvedValue(undefined),
  verifyConnection: jest.fn().mockResolvedValue(true),
};

const mockUserRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  // TODO: Replace getGroupMembers with family-based notifications
  getGroupMembers: jest.fn(),
  getGroupById: jest.fn(),
} as unknown as UserRepository;

const mockScheduleSlotRepository = {
  findByIdWithDetails: jest.fn(),
  findConflictingSlotsForParentByDateTime: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as unknown as ScheduleSlotRepository;

const mockPrisma = {
  child: {
    findUnique: jest.fn(),
  },
  vehicle: {
    findUnique: jest.fn(),
  },
  familyMember: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('NotificationService - Family Based Notifications', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    notificationService = new NotificationService(
      mockEmailService,
      mockUserRepository,
      mockScheduleSlotRepository,
      mockPrisma,
    );
  });

  describe('Vehicle Assignment Notifications', () => {
    it('should notify all family members when a child is assigned to a vehicle', async () => {
      // Setup test data
      const scheduleSlotId = 'slot-1';
      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: TEST_IDS.CHILD, name: 'Alice' },
          },
        ],
        vehicleAssignments: [],
      };

      const mockGroupMembers = [
        {
          userId: TEST_IDS.USER,
          user: { id: TEST_IDS.USER, email: 'parent1@example.com', name: 'Parent 1' },
        },
        {
          userId: 'user-2', 
          user: { id: 'user-2', email: 'parent2@example.com', name: 'Parent 2' },
        },
      ];

      const mockChildWithFamily = {
        id: TEST_IDS.CHILD,
        name: 'Alice',
        family: {
          id: TEST_IDS.FAMILY,
          members: [
            { userId: TEST_IDS.USER },
            { userId: 'user-2' },
          ],
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);

      // Act
      await notificationService.notifyScheduleSlotChange(scheduleSlotId, 'VEHICLE_ASSIGNED');

      // Assert
      expect(mockPrisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_IDS.CHILD },
        include: {
          family: {
            include: {
              members: {
                select: { userId: true },
              },
            },
          },
        },
      });

      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent1@example.com',
        expect.objectContaining({
          changeType: 'VEHICLE_ASSIGNED',
          assignedChildren: ['Alice'],
        }),
      );

      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent2@example.com',
        expect.objectContaining({
          changeType: 'VEHICLE_ASSIGNED',
          assignedChildren: ['Alice'],
        }),
              );
    });

    it('should notify only relevant family members and vehicle family members', async () => {
      const scheduleSlotId = 'slot-1';
      const vehicleFamilyId = 'vehicle-family-1'; // Family that owns the vehicle
      const vehicleFamilyUserId = 'vehicle-family-member-1';

      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: TEST_IDS.CHILD, name: 'Alice' },
          },
        ],
        vehicleAssignments: [
          {
            vehicle: {
              id: TEST_IDS.VEHICLE,
              name: 'Test Vehicle',
              capacity: 4,
              familyId: vehicleFamilyId, // Vehicle belongs to this family
            },
            driver: { id: 'driver-1', name: 'Driver' }, // Driver still exists but not used for notifications
          },
        ],
      };

      const mockGroupMembers = [
        {
          userId: TEST_IDS.USER,
          user: { id: TEST_IDS.USER, email: 'parent1@example.com', name: 'Parent 1' },
        },
        {
          userId: 'user-2',
          user: { id: 'user-2', email: 'parent2@example.com', name: 'Parent 2' },
        },
        {
          userId: vehicleFamilyUserId,
          user: { id: vehicleFamilyUserId, email: 'vehicle-family@example.com', name: 'Vehicle Family Member' },
        },
        {
          userId: 'other-user',
          user: { id: 'other-user', email: 'other@example.com', name: 'Other User' },
        },
      ];

      const mockChildWithFamily = {
        id: TEST_IDS.CHILD,
        name: 'Alice',
        family: {
          id: TEST_IDS.FAMILY,
          members: [
            { userId: TEST_IDS.USER },
            { userId: 'user-2' },
          ],
        },
      };

      const mockVehicleFamilyMembers = [
        { userId: vehicleFamilyUserId },
      ];

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);
      // Mock the family member query for vehicle's family
      (mockPrisma.familyMember.findMany as jest.Mock).mockResolvedValue(mockVehicleFamilyMembers);

      // Act
      await notificationService.notifyScheduleSlotChange(scheduleSlotId, 'DRIVER_ASSIGNED');

      // Assert - Should notify vehicle's family members and child's family members, but not other users
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(3);
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent1@example.com',
        expect.anything(),
              );
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent2@example.com',
        expect.anything(),
              );
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'vehicle-family@example.com',
        expect.anything(),
              );
      expect(mockEmailService.sendScheduleSlotNotification).not.toHaveBeenCalledWith(
        'other@example.com',
        expect.anything(),
              );
    });
  });

  describe('Child Assignment Notifications', () => {
    it('should notify family members when child is added to schedule', async () => {
      const scheduleSlotId = 'slot-1';
      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: TEST_IDS.CHILD, name: 'Alice' },
          },
        ],
        vehicleAssignments: [],
      };

      const mockGroupMembers = [
        {
          userId: TEST_IDS.USER,
          user: { id: TEST_IDS.USER, email: 'parent1@example.com', name: 'Parent 1' },
        },
      ];

      const mockChildWithFamily = {
        id: TEST_IDS.CHILD,
        name: 'Alice',
        family: {
          id: TEST_IDS.FAMILY,
          members: [
            { userId: TEST_IDS.USER },
          ],
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      // Act
      await notificationService.notifyScheduleSlotChange(scheduleSlotId, 'CHILD_ADDED');

      // Assert
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent1@example.com',
        expect.objectContaining({
          changeType: 'CHILD_ADDED',
          assignedChildren: ['Alice'],
        }),
              );
    });

    it('should handle multiple children from different families', async () => {
      const scheduleSlotId = 'slot-1';
      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: TEST_IDS.CHILD, name: 'Alice' },
          },
          {
            child: { id: 'child-2', name: 'Bob' },
          },
        ],
        vehicleAssignments: [],
      };

      const mockGroupMembers = [
        {
          userId: TEST_IDS.USER,
          user: { id: TEST_IDS.USER, email: 'parent1@example.com', name: 'Parent 1' },
        },
        {
          userId: 'user-2',
          user: { id: 'user-2', email: 'parent2@example.com', name: 'Parent 2' },
        },
        {
          userId: 'user-3',
          user: { id: 'user-3', email: 'parent3@example.com', name: 'Parent 3' },
        },
      ];

      // Setup mocks for different children from different families
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockPrisma.child.findUnique as jest.Mock)
        .mockResolvedValueOnce({
          id: TEST_IDS.CHILD,
          name: 'Alice',
          family: {
            id: TEST_IDS.FAMILY,
            members: [
              { userId: TEST_IDS.USER },
              { userId: 'user-2' },
            ],
          },
        })
        .mockResolvedValueOnce({
          id: 'child-2',
          name: 'Bob',
          family: {
            id: 'family-2',
            members: [
              { userId: 'user-3' },
            ],
          },
        });
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      // Act
      await notificationService.notifyScheduleSlotChange(scheduleSlotId, 'CHILD_REMOVED');

      // Assert - Should notify all family members from both families
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(3);
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent1@example.com',
        expect.anything(),
              );
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent2@example.com',
        expect.anything(),
              );
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent3@example.com',
        expect.anything(),
              );
    });
  });

  describe('Slot Cancellation Notifications', () => {
    it('should notify all affected family members and vehicle family members when slot is cancelled', async () => {
      const scheduleSlotId = 'slot-1';
      const vehicleFamilyId = 'vehicle-family-1';

      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: TEST_IDS.CHILD, name: 'Alice' },
          },
        ],
        vehicleAssignments: [
          {
            vehicle: {
              id: TEST_IDS.VEHICLE,
              name: 'Test Vehicle',
              capacity: 4,
              familyId: vehicleFamilyId,
            },
          },
        ],
      };

      const mockGroupMembers = [
        {
          userId: TEST_IDS.USER,
          user: { id: TEST_IDS.USER, email: 'parent1@example.com', name: 'Parent 1' },
        },
        {
          userId: 'vehicle-family-member-1',
          user: { id: 'vehicle-family-member-1', email: 'vehicle-family@example.com', name: 'Vehicle Family' },
        },
      ];

      const mockChildWithFamily = {
        id: TEST_IDS.CHILD,
        name: 'Alice',
        family: {
          id: TEST_IDS.FAMILY,
          members: [
            { userId: TEST_IDS.USER },
          ],
        },
      };

      const mockVehicleFamilyMembers = [
        { userId: 'vehicle-family-member-1' },
      ];

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);
      (mockPrisma.familyMember.findMany as jest.Mock).mockResolvedValue(mockVehicleFamilyMembers);

      // Act
      await notificationService.notifyScheduleSlotChange(scheduleSlotId, 'SLOT_CANCELLED');

      // Assert
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(2);
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'parent1@example.com',
        expect.objectContaining({
          changeType: 'SLOT_CANCELLED',
        }),
              );
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledWith(
        'vehicle-family@example.com',
        expect.objectContaining({
          changeType: 'SLOT_CANCELLED',
        }),
              );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing child family gracefully', async () => {
      const scheduleSlotId = 'slot-1';
      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: TEST_IDS.CHILD, name: 'Alice' },
          },
        ],
        vehicleAssignments: [],
      };

      const mockGroupMembers = [
        {
          userId: TEST_IDS.USER,
          user: { id: TEST_IDS.USER, email: 'parent1@example.com', name: 'Parent 1' },
        },
      ];

      // Setup mocks - child has no family
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(null);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      // Act & Assert - Should not throw error
      await expect(notificationService.notifyScheduleSlotChange(scheduleSlotId, 'CHILD_ADDED'))
        .resolves
        .not.toThrow();

      // Should not send any notifications for family members (only drivers if any)
      expect(mockEmailService.sendScheduleSlotNotification).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      const scheduleSlotId = 'slot-1';
      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: TEST_IDS.CHILD, name: 'Alice' },
          },
        ],
        vehicleAssignments: [],
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue([]);
      (mockPrisma.child.findUnique as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert - Should handle error gracefully
      await expect(notificationService.notifyScheduleSlotChange(scheduleSlotId, 'CHILD_ADDED'))
        .resolves
        .not.toThrow();
    });
  });
});