import { NotificationService } from '../NotificationService';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../repositories/UserRepository';
import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';

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
        groupId: 'group-1',
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: 'group-1',
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: 'child-1', name: 'Alice' },
          },
        ],
        vehicleAssignments: [],
      };

      const mockGroupMembers = [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: 'parent1@example.com', name: 'Parent 1' },
        },
        {
          userId: 'user-2', 
          user: { id: 'user-2', email: 'parent2@example.com', name: 'Parent 2' },
        },
      ];

      const mockChildWithFamily = {
        id: 'child-1',
        name: 'Alice',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1' },
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
        where: { id: 'child-1' },
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

    it('should notify only relevant family members and drivers', async () => {
      const scheduleSlotId = 'slot-1';
      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: 'group-1',
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: 'child-1', name: 'Alice' },
          },
        ],
        vehicleAssignments: [
          {
            vehicle: {
              id: 'vehicle-1',
              name: 'Test Vehicle',
              capacity: 4,
            },
            driver: { id: 'driver-1', name: 'Driver' },
          },
        ],
      };

      const mockGroupMembers = [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: 'parent1@example.com', name: 'Parent 1' },
        },
        {
          userId: 'user-2',
          user: { id: 'user-2', email: 'parent2@example.com', name: 'Parent 2' },
        },
        {
          userId: 'driver-1',
          user: { id: 'driver-1', email: 'driver@example.com', name: 'Driver' },
        },
        {
          userId: 'other-user',
          user: { id: 'other-user', email: 'other@example.com', name: 'Other User' },
        },
      ];

      const mockChildWithFamily = {
        id: 'child-1',
        name: 'Alice',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1' },
            { userId: 'user-2' },
          ],
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      // Act
      await notificationService.notifyScheduleSlotChange(scheduleSlotId, 'DRIVER_ASSIGNED');

      // Assert - Should notify driver and family members, but not other users
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
        'driver@example.com',
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
        groupId: 'group-1',
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: 'group-1',
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: 'child-1', name: 'Alice' },
          },
        ],
        vehicleAssignments: [],
      };

      const mockGroupMembers = [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: 'parent1@example.com', name: 'Parent 1' },
        },
      ];

      const mockChildWithFamily = {
        id: 'child-1',
        name: 'Alice',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1' },
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
        groupId: 'group-1',
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: 'group-1',
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: 'child-1', name: 'Alice' },
          },
          {
            child: { id: 'child-2', name: 'Bob' },
          },
        ],
        vehicleAssignments: [],
      };

      const mockGroupMembers = [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: 'parent1@example.com', name: 'Parent 1' },
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
          id: 'child-1',
          name: 'Alice',
          family: {
            id: 'family-1',
            members: [
              { userId: 'user-1' },
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
    it('should notify all affected family members and drivers when slot is cancelled', async () => {
      const scheduleSlotId = 'slot-1';
      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: 'group-1',
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: 'child-1', name: 'Alice' },
          },
        ],
        vehicleAssignments: [
          {
            vehicle: {
              id: 'vehicle-1',
              name: 'Test Vehicle',
              capacity: 4,
            },
            driver: { id: 'driver-1', name: 'Driver' },
          },
        ],
      };

      const mockGroupMembers = [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: 'parent1@example.com', name: 'Parent 1' },
        },
        {
          userId: 'driver-1',
          user: { id: 'driver-1', email: 'driver@example.com', name: 'Driver' },
        },
      ];

      const mockChildWithFamily = {
        id: 'child-1',
        name: 'Alice',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1' },
          ],
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

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
        'driver@example.com',
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
        groupId: 'group-1',
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: 'group-1',
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: 'child-1', name: 'Alice' },
          },
        ],
        vehicleAssignments: [],
      };

      const mockGroupMembers = [
        {
          userId: 'user-1',
          user: { id: 'user-1', email: 'parent1@example.com', name: 'Parent 1' },
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
        groupId: 'group-1',
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: 'group-1',
          name: 'Test Group',
        },
        childAssignments: [
          {
            child: { id: 'child-1', name: 'Alice' },
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