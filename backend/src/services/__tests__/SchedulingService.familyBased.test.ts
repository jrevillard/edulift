import { SchedulingService } from '../SchedulingService';
import { PrismaClient } from '@prisma/client';
import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';

// Mock dependencies
const mockScheduleSlotRepository = {
  findConflictingSlotsForParentByDateTime: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findByGroupAndDateTime: jest.fn(),
} as unknown as ScheduleSlotRepository;

const mockPrisma = {
  vehicle: {
    findUnique: jest.fn(),
  },
  child: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('SchedulingService - Family Based Conflict Detection', () => {
  let schedulingService: SchedulingService;

  beforeEach(() => {
    jest.clearAllMocks();
    
    schedulingService = new SchedulingService(mockScheduleSlotRepository, mockPrisma);
  });

  describe('Vehicle Conflict Detection', () => {
    it('should detect conflict when parent\'s family vehicle is already assigned', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [
            {
              driverId: 'other-driver',
              vehicle: {
                id: 'vehicle-1',
                name: 'Family Car',
                capacity: 5,
              },
            },
          ],
          childAssignments: [],
        },
      ];

      const mockVehicleWithFamily = {
        id: 'vehicle-1',
        name: 'Family Car',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1', role: 'ADMIN' },
          ],
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.vehicle.findUnique as jest.Mock).mockResolvedValue(mockVehicleWithFamily);

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(mockPrisma.vehicle.findUnique).toHaveBeenCalledWith({
        where: { id: 'vehicle-1' },
        include: {
          family: {
            include: {
              members: {
                where: { userId: parentId },
                select: { userId: true, role: true },
              },
            },
          },
        },
      });

      expect(conflicts).toContain('Vehicle Family Car from your family is already assigned to schedule slot slot-1');
    });

    it('should not detect conflict when vehicle belongs to different family', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [
            {
              driverId: 'other-driver',
              vehicle: {
                id: 'vehicle-1',
                name: 'Other Family Car',
                capacity: 5,
              },
            },
          ],
          childAssignments: [],
        },
      ];

      const mockVehicleWithFamily = {
        id: 'vehicle-1',
        name: 'Other Family Car',
        family: {
          id: 'family-2',
          members: [], // Parent not in this family
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.vehicle.findUnique as jest.Mock).mockResolvedValue(mockVehicleWithFamily);

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(conflicts).not.toContain(expect.stringContaining('Vehicle Other Family Car'));
    });

    it('should detect conflict when parent is driving', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [
            {
              driverId: 'user-1', // Same as parentId
              vehicle: {
                id: 'vehicle-1',
                name: 'Any Car',
                capacity: 5,
              },
            },
          ],
          childAssignments: [],
        },
      ];

      // Setup mocks
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.vehicle.findUnique as jest.Mock).mockResolvedValue({ family: { members: [] } });

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(conflicts).toContain('Parent is already driving in schedule slot slot-1');
    });
  });

  describe('Child Conflict Detection', () => {
    it('should detect conflict when parent\'s family child is already assigned', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [],
          childAssignments: [
            {
              child: {
                id: 'child-1',
                name: 'Alice',
              },
            },
          ],
        },
      ];

      const mockChildWithFamily = {
        id: 'child-1',
        name: 'Alice',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1', role: 'PARENT' },
          ],
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(mockPrisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: 'child-1' },
        include: {
          family: {
            include: {
              members: {
                where: { userId: parentId },
                select: { userId: true, role: true },
              },
            },
          },
        },
      });

      expect(conflicts).toContain('Child Alice from your family is already assigned to schedule slot slot-1');
    });

    it('should not detect conflict when child belongs to different family', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [],
          childAssignments: [
            {
              child: {
                id: 'child-1',
                name: 'Bob',
              },
            },
          ],
        },
      ];

      const mockChildWithFamily = {
        id: 'child-1',
        name: 'Bob',
        family: {
          id: 'family-2',
          members: [], // Parent not in this family
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(conflicts).not.toContain(expect.stringContaining('Child Bob'));
    });

    it('should detect multiple conflicts from same family', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [
            {
              driverId: 'other-driver',
              vehicle: {
                id: 'vehicle-1',
                name: 'Family Car',
                capacity: 5,
              },
            },
          ],
          childAssignments: [
            {
              child: {
                id: 'child-1',
                name: 'Alice',
              },
            },
            {
              child: {
                id: 'child-2',
                name: 'Bob',
              },
            },
          ],
        },
      ];

      const mockVehicleWithFamily = {
        id: 'vehicle-1',
        name: 'Family Car',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1', role: 'ADMIN' },
          ],
        },
      };

      const mockChildWithFamily1 = {
        id: 'child-1',
        name: 'Alice',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1', role: 'PARENT' },
          ],
        },
      };

      const mockChildWithFamily2 = {
        id: 'child-2',
        name: 'Bob',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1', role: 'PARENT' },
          ],
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.vehicle.findUnique as jest.Mock).mockResolvedValue(mockVehicleWithFamily);
      (mockPrisma.child.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockChildWithFamily1)
        .mockResolvedValueOnce(mockChildWithFamily2);

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(conflicts).toHaveLength(3);
      expect(conflicts).toContain('Vehicle Family Car from your family is already assigned to schedule slot slot-1');
      expect(conflicts).toContain('Child Alice from your family is already assigned to schedule slot slot-1');
      expect(conflicts).toContain('Child Bob from your family is already assigned to schedule slot slot-1');
    });
  });

  describe('Multiple Time Slots Conflicts', () => {
    it('should detect conflicts across multiple time slots', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [],
          childAssignments: [
            {
              child: {
                id: 'child-1',
                name: 'Alice',
              },
            },
          ],
        },
        {
          id: 'slot-2',
          day: 'MONDAY',
          time: '08:00',
          week: '2025-25',
          vehicleAssignments: [
            {
              driverId: 'user-1', // Parent is driving
              vehicle: {
                id: 'vehicle-1',
                name: 'School Bus',
                capacity: 20,
              },
            },
          ],
          childAssignments: [],
        },
      ];

      const mockChildWithFamily = {
        id: 'child-1',
        name: 'Alice',
        family: {
          id: 'family-1',
          members: [
            { userId: 'user-1', role: 'PARENT' },
          ],
        },
      };

      // Setup mocks
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(mockChildWithFamily);
      (mockPrisma.vehicle.findUnique as jest.Mock).mockResolvedValue({ family: { members: [] } });

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(conflicts).toHaveLength(2);
      expect(conflicts).toContain('Child Alice from your family is already assigned to schedule slot slot-1');
      expect(conflicts).toContain('Parent is already driving in schedule slot slot-2');
    });
  });

  describe('No Conflicts', () => {
    it('should return empty array when no conflicts exist', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      // Setup mocks - no conflicting slots
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue([]);

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(conflicts).toEqual([]);
    });

    it('should return empty array when parent has no family relationships', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [
            {
              driverId: 'other-driver',
              vehicle: {
                id: 'vehicle-1',
                name: 'Other Car',
                capacity: 5,
              },
            },
          ],
          childAssignments: [
            {
              child: {
                id: 'child-1',
                name: 'Other Child',
              },
            },
          ],
        },
      ];

      // Setup mocks - parent not in any families
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.vehicle.findUnique as jest.Mock).mockResolvedValue({ family: { members: [] } });
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue({ family: { members: [] } });

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert
      expect(conflicts).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      // Setup mocks - database error
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Act & Assert
      await expect(schedulingService.detectConflicts(parentId, groupId, datetime))
        .rejects
        .toThrow('Database error');
    });

    it('should handle missing vehicle data gracefully', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [
            {
              driverId: 'other-driver',
              vehicle: {
                id: 'vehicle-1',
                name: 'Missing Vehicle',
                capacity: 5,
              },
            },
          ],
          childAssignments: [],
        },
      ];

      // Setup mocks - vehicle not found
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.vehicle.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert - Should not crash and not report false conflicts
      expect(conflicts).toEqual([]);
    });

    it('should handle missing child data gracefully', async () => {
      const parentId = 'user-1';
      const groupId = 'group-1';
      const datetime = new Date('2025-06-23T08:00:00.000Z'); // Monday of week 2025-25

      const mockConflictingSlots = [
        {
          id: 'slot-1',
          datetime: new Date('2025-06-23T08:00:00.000Z'),
          vehicleAssignments: [],
          childAssignments: [
            {
              child: {
                id: 'child-1',
                name: 'Missing Child',
              },
            },
          ],
        },
      ];

      // Setup mocks - child not found
      (mockScheduleSlotRepository.findConflictingSlotsForParentByDateTime as jest.Mock).mockResolvedValue(mockConflictingSlots);
      (mockPrisma.child.findUnique as jest.Mock).mockResolvedValue(null);

      // Act
      const conflicts = await schedulingService.detectConflicts(parentId, groupId, datetime);

      // Assert - Should not crash and not report false conflicts
      expect(conflicts).toEqual([]);
    });
  });
});