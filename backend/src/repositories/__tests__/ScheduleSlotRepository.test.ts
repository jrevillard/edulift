// @ts-nocheck
import { ScheduleSlotRepository } from '../ScheduleSlotRepository';
import { PrismaClient } from '@prisma/client';
import { CreateScheduleSlotData } from '../../types';
import * as isoWeekUtils from '../../utils/isoWeekUtils';

// Mock Prisma Client
const mockPrisma = {
  scheduleSlot: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  scheduleSlotVehicle: {
    create: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  scheduleSlotChild: {
    create: jest.fn(),
    delete: jest.fn(),
  },
  vehicle: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

describe('ScheduleSlotRepository', () => {
  let repository: ScheduleSlotRepository;

  const mockScheduleSlot = {
    id: 'slot-1',
    groupId: 'group-1',
    datetime: new Date('2024-01-08T08:00:00.000Z'), // Monday of week 2024-01 at 08:00 UTC
    createdAt: new Date(),
    updatedAt: new Date(),
    group: { id: 'group-1', name: 'Test Group' },
    vehicleAssignments: [],
    childAssignments: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new ScheduleSlotRepository(mockPrisma as PrismaClient);
  });

  describe('create', () => {
    it('should create a schedule slot successfully', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: 'group-1',
        datetime: '2024-01-08T08:00:00.000Z',
      };

      mockPrisma.scheduleSlot.create.mockResolvedValue(mockScheduleSlot);

      const result = await repository.create(slotData);

      expect(mockPrisma.scheduleSlot.create).toHaveBeenCalledWith({
        data: slotData,
        include: {
          group: { select: { id: true, name: true } },
          vehicleAssignments: {
            include: {
              vehicle: { select: { id: true, name: true, capacity: true } },
              driver: { select: { id: true, name: true } },
            },
          },
          childAssignments: {
            include: {
              child: { select: { id: true, name: true } },
            },
          },
        },
      });
      expect(result).toEqual(mockScheduleSlot);
    });
  });

  describe('findById', () => {
    it('should find schedule slot by ID', async () => {
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockScheduleSlot);

      const result = await repository.findById('slot-1');

      expect(mockPrisma.scheduleSlot.findUnique).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        include: expect.objectContaining({
          group: { select: { id: true, name: true } },
          vehicleAssignments: expect.any(Object),
          childAssignments: expect.any(Object),
        }),
      });
      expect(result).toEqual(mockScheduleSlot);
    });

    it('should return null if slot not found', async () => {
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('assignVehicleToSlot', () => {
    it('should assign vehicle to slot successfully', async () => {
      const mockVehicle = { id: 'vehicle-1', name: 'Bus 1', capacity: 20, userId: 'user-1' };
      const mockDriver = { id: 'driver-1', name: 'John Doe' };
      const mockAssignment = {
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        vehicle: mockVehicle,
        driver: mockDriver,
      };

      // Mock transaction
      const mockTransaction = {
        scheduleSlot: {
          findUnique: jest.fn().mockResolvedValue(mockScheduleSlot),
          findMany: jest.fn().mockResolvedValue([]),
        },
        vehicle: {
          findUnique: jest.fn().mockResolvedValue(mockVehicle),
        },
        user: {
          findUnique: jest.fn().mockResolvedValue(mockDriver),
        },
        scheduleSlotVehicle: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockAssignment),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        return await callback(mockTransaction);
      });

      const result = await repository.assignVehicleToSlot('slot-1', 'vehicle-1', 'driver-1');

      expect(result).toEqual(mockAssignment);
      expect(mockTransaction.scheduleSlot.findUnique).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
        include: { group: true },
      });
      expect(mockTransaction.vehicle.findUnique).toHaveBeenCalledWith({
        where: { id: 'vehicle-1' },
        select: { id: true, name: true, capacity: true, familyId: true },
      });
    });

    it('should throw error if slot not found', async () => {
      const mockTransaction = {
        scheduleSlot: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        return await callback(mockTransaction);
      });

      await expect(
        repository.assignVehicleToSlot('non-existent', 'vehicle-1'),
      ).rejects.toThrow('Schedule slot not found');
    });

    it('should throw error if vehicle not found', async () => {
      const mockTransaction = {
        scheduleSlot: {
          findUnique: jest.fn().mockResolvedValue(mockScheduleSlot),
        },
        vehicle: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        return await callback(mockTransaction);
      });

      await expect(
        repository.assignVehicleToSlot('slot-1', 'non-existent'),
      ).rejects.toThrow('Vehicle not found');
    });

    it('should throw error if vehicle already assigned', async () => {
      const mockVehicle = { id: 'vehicle-1', name: 'Bus 1', capacity: 20, userId: 'user-1' };
      const existingAssignment = { id: 'existing-assignment' };

      const mockTransaction = {
        scheduleSlot: {
          findUnique: jest.fn().mockResolvedValue(mockScheduleSlot),
        },
        vehicle: {
          findUnique: jest.fn().mockResolvedValue(mockVehicle),
        },
        scheduleSlotVehicle: {
          findUnique: jest.fn().mockResolvedValue(existingAssignment),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        return await callback(mockTransaction);
      });

      await expect(
        repository.assignVehicleToSlot('slot-1', 'vehicle-1'),
      ).rejects.toThrow('Vehicle is already assigned to this schedule slot');
    });
  });

  describe('removeVehicleFromSlot', () => {
    it('should remove vehicle and keep slot when other vehicles exist', async () => {
      const mockResult = { id: 'assignment-1' };

      const mockTransaction = {
        scheduleSlotVehicle: {
          delete: jest.fn().mockResolvedValue(mockResult),
          count: jest.fn().mockResolvedValue(1), // Other vehicles still exist
        },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        return await callback(mockTransaction);
      });

      const result = await repository.removeVehicleFromSlot('slot-1', 'vehicle-1');

      expect(result.vehicleAssignment).toEqual(mockResult);
      expect(result.slotDeleted).toBe(false);
      expect(mockTransaction.scheduleSlotVehicle.delete).toHaveBeenCalledWith({
        where: {
          scheduleSlotId_vehicleId: {
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
          },
        },
      });
    });

    it('should remove vehicle and delete slot when it was the last vehicle', async () => {
      const mockResult = { id: 'assignment-1' };

      const mockTransaction = {
        scheduleSlotVehicle: {
          delete: jest.fn().mockResolvedValue(mockResult),
          count: jest.fn().mockResolvedValue(0), // No vehicles left
        },
        scheduleSlot: {
          delete: jest.fn().mockResolvedValue({}),
        },
      };

      mockPrisma.$transaction.mockImplementation(async (callback: unknown) => {
        return await callback(mockTransaction);
      });

      const result = await repository.removeVehicleFromSlot('slot-1', 'vehicle-1');

      expect(result.vehicleAssignment).toEqual(mockResult);
      expect(result.slotDeleted).toBe(true);
      expect(mockTransaction.scheduleSlot.delete).toHaveBeenCalledWith({
        where: { id: 'slot-1' },
      });
    });
  });


  describe('removeChildFromSlot', () => {
    it('should remove child from slot successfully', async () => {
      const mockResult = { scheduleSlotId: 'slot-1', childId: 'child-1' };

      mockPrisma.scheduleSlotChild.delete.mockResolvedValue(mockResult);

      const result = await repository.removeChildFromSlot('slot-1', 'child-1');

      expect(mockPrisma.scheduleSlotChild.delete).toHaveBeenCalledWith({
        where: {
          scheduleSlotId_childId: {
            scheduleSlotId: 'slot-1',
            childId: 'child-1',
          },
        },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getWeeklyScheduleByDateRange', () => {
    it('should return weekly schedule for group by date range', async () => {
      const mockSlots = [mockScheduleSlot];

      mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockSlots);

      const weekStart = new Date('2024-01-08T00:00:00.000Z'); // Monday of week 2024-01
      const weekEnd = new Date('2024-01-14T23:59:59.999Z'); // Sunday of week 2024-01
      const result = await repository.getWeeklyScheduleByDateRange('group-1', weekStart, weekEnd);

      expect(mockPrisma.scheduleSlot.findMany).toHaveBeenCalledWith({
        where: {
          groupId: 'group-1',
          datetime: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
        include: expect.any(Object),
        orderBy: [
          { datetime: 'asc' },
        ],
      });
      expect(result).toEqual(mockSlots);
    });
  });

  describe('findByGroupAndDateTime', () => {
    it('should find schedule slot by group and datetime', async () => {
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockScheduleSlot);

      const datetime = new Date('2024-01-08T08:00:00.000Z');
      const result = await repository.findByGroupAndDateTime('group-1', datetime);

      expect(mockPrisma.scheduleSlot.findUnique).toHaveBeenCalledWith({
        where: {
          groupId_datetime: {
            groupId: 'group-1',
            datetime,
          },
        },
        include: expect.any(Object),
      });
      expect(result).toEqual(mockScheduleSlot);
    });
  });

  describe('Vehicle-Specific Child Assignments', () => {
    describe('findById with vehicleAssignmentId', () => {
      it('should include vehicleAssignmentId in child assignments query', async () => {
        const mockSlotWithVehicleSpecificChildren = {
          ...mockScheduleSlot,
          vehicleAssignments: [
            {
              id: 'vehicle-assignment-1',
              scheduleSlotId: 'slot-1',
              vehicleId: 'vehicle-1',
              driverId: 'driver-1',
              vehicle: { id: 'vehicle-1', name: 'Bus #1', capacity: 8 },
              driver: { id: 'driver-1', name: 'John Driver' },
            },
            {
              id: 'vehicle-assignment-2',
              scheduleSlotId: 'slot-1',
              vehicleId: 'vehicle-2',
              driverId: 'driver-2',
              vehicle: { id: 'vehicle-2', name: 'Van #1', capacity: 4 },
              driver: { id: 'driver-2', name: 'Jane Driver' },
            },
          ],
          childAssignments: [
            {
              vehicleAssignmentId: 'vehicle-assignment-1',
              child: { id: 'child-1', name: 'Alice', familyId: 'family-1' },
            },
            {
              vehicleAssignmentId: 'vehicle-assignment-1', 
              child: { id: 'child-2', name: 'Bob', familyId: 'family-2' },
            },
            {
              vehicleAssignmentId: 'vehicle-assignment-2',
              child: { id: 'child-3', name: 'Charlie', familyId: 'family-3' },
            },
          ],
        };

        mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlotWithVehicleSpecificChildren);

        const result = await repository.findById('slot-1');

        expect(result).not.toBeNull();
        expect(mockPrisma.scheduleSlot.findUnique).toHaveBeenCalledWith({
          where: { id: 'slot-1' },
          include: {
            group: { select: { id: true, name: true } },
            vehicleAssignments: {
              include: {
                vehicle: { select: { id: true, name: true, capacity: true } },
                driver: { select: { id: true, name: true } },
              },
            },
            childAssignments: {
              select: {
                vehicleAssignmentId: true,
                child: { select: { id: true, name: true } },
              },
            },
          },
        });

        // Verify vehicle-specific child assignments
        expect(result!.childAssignments).toHaveLength(3);
        expect(result!.childAssignments[0]).toEqual({
          vehicleAssignmentId: 'vehicle-assignment-1',
          child: { id: 'child-1', name: 'Alice', familyId: 'family-1' },
        });
        expect(result!.childAssignments[1]).toEqual({
          vehicleAssignmentId: 'vehicle-assignment-1',
          child: { id: 'child-2', name: 'Bob', familyId: 'family-2' },
        });
        expect(result!.childAssignments[2]).toEqual({
          vehicleAssignmentId: 'vehicle-assignment-2',
          child: { id: 'child-3', name: 'Charlie', familyId: 'family-3' },
        });

        // Verify that children are correctly distributed across vehicles
        const vehicle1Children = result!.childAssignments.filter(
          ca => ca.vehicleAssignmentId === 'vehicle-assignment-1',
        );
        const vehicle2Children = result!.childAssignments.filter(
          ca => ca.vehicleAssignmentId === 'vehicle-assignment-2',
        );

        expect(vehicle1Children).toHaveLength(2); // Alice and Bob in Bus
        expect(vehicle2Children).toHaveLength(1); // Charlie in Van
      });

      it('should handle empty child assignments correctly', async () => {
        const mockSlotWithNoChildren = {
          ...mockScheduleSlot,
          vehicleAssignments: [
            {
              id: 'vehicle-assignment-1',
              scheduleSlotId: 'slot-1',
              vehicleId: 'vehicle-1',
              driverId: 'driver-1',
              vehicle: { id: 'vehicle-1', name: 'Bus #1', capacity: 8 },
              driver: { id: 'driver-1', name: 'John Driver' },
            },
          ],
          childAssignments: [],
        };

        mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlotWithNoChildren);

        const result = await repository.findById('slot-1');

        expect(result).not.toBeNull();
        expect(result!.childAssignments).toHaveLength(0);
        expect(result!.vehicleAssignments).toHaveLength(1);
      });
    });

    describe('findByIdWithDetails with parent information', () => {
      it('should include parent info and vehicleAssignmentId for detailed child assignments', async () => {
        const mockSlotWithDetailedChildren = {
          ...mockScheduleSlot,
          vehicleAssignments: [
            {
              id: 'vehicle-assignment-1',
              scheduleSlotId: 'slot-1',
              vehicleId: 'vehicle-1',
              driverId: 'driver-1',
              vehicle: { id: 'vehicle-1', name: 'Bus #1', capacity: 8 },
              driver: { id: 'driver-1', name: 'John Driver' },
            },
          ],
          childAssignments: [
            {
              vehicleAssignmentId: 'vehicle-assignment-1',
              child: { 
                id: 'child-1', 
                name: 'Alice', 
                familyId: 'family-1',
                parent: { id: 'parent-1', name: 'Alice Parent', email: 'alice.parent@example.com' },
              },
            },
            {
              vehicleAssignmentId: 'vehicle-assignment-1',
              child: { 
                id: 'child-2', 
                name: 'Bob', 
                familyId: 'family-2',
                parent: { id: 'parent-2', name: 'Bob Parent', email: 'bob.parent@example.com' },
              },
            },
          ],
        };

        mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlotWithDetailedChildren);

        const result = await repository.findByIdWithDetails('slot-1');

        expect(result).not.toBeNull();
        expect(mockPrisma.scheduleSlot.findUnique).toHaveBeenCalledWith({
          where: { id: 'slot-1' },
          include: {
            group: { select: { id: true, name: true } },
            vehicleAssignments: {
              include: {
                vehicle: { select: { id: true, name: true, capacity: true } },
                driver: { select: { id: true, name: true } },
              },
            },
            childAssignments: {
              select: {
                vehicleAssignmentId: true,
                child: { 
                  select: { 
                    id: true, 
                    name: true,
                  }, 
                },
              },
            },
          },
        });

        // Verify detailed child assignments with parent info
        expect(result!.childAssignments).toHaveLength(2);
        expect(result!.childAssignments[0]).toMatchObject({
          vehicleAssignmentId: 'vehicle-assignment-1',
          child: {
            id: 'child-1',
            name: 'Alice',
            parent: { name: 'Alice Parent' },
          },
        });
      });
    });

    describe('getWeeklySchedule with vehicle-specific children', () => {
      it('should return vehicle-specific child assignments across multiple slots', async () => {
        const mockWeeklySlots = [
          {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: new Date('2024-01-08T08:00:00.000Z'),
            vehicleAssignments: [
              {
                id: 'vehicle-assignment-1',
                vehicle: { id: 'vehicle-1', name: 'Bus #1', capacity: 8 },
                driver: { id: 'driver-1', name: 'John Driver' },
              },
            ],
            childAssignments: [
              {
                vehicleAssignmentId: 'vehicle-assignment-1',
                child: { id: 'child-1', name: 'Alice', familyId: 'family-1' },
              },
              {
                vehicleAssignmentId: 'vehicle-assignment-1',
                child: { id: 'child-2', name: 'Bob', familyId: 'family-2' },
              },
            ],
          },
          {
            id: 'slot-2',
            groupId: 'group-1',
            day: 'TUESDAY',
            time: '08:00',
            week: '2024-01',
            vehicleAssignments: [
              {
                id: 'vehicle-assignment-2',
                vehicle: { id: 'vehicle-2', name: 'Van #1', capacity: 4 },
                driver: { id: 'driver-2', name: 'Jane Driver' },
              },
              {
                id: 'vehicle-assignment-3',
                vehicle: { id: 'vehicle-3', name: 'Car #1', capacity: 2 },
                driver: null,
              },
            ],
            childAssignments: [
              {
                vehicleAssignmentId: 'vehicle-assignment-2',
                child: { id: 'child-3', name: 'Charlie', familyId: 'family-3' },
              },
              {
                vehicleAssignmentId: 'vehicle-assignment-3',
                child: { id: 'child-4', name: 'David', familyId: 'family-4' },
              },
            ],
          },
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockWeeklySlots);

        const weekStart = new Date('2024-01-08T00:00:00.000Z'); 
        const weekEnd = new Date('2024-01-14T23:59:59.999Z');
        const result = await repository.getWeeklyScheduleByDateRange('group-1', weekStart, weekEnd);

        expect(mockPrisma.scheduleSlot.findMany).toHaveBeenCalledWith({
          where: { 
            groupId: 'group-1', 
            datetime: { gte: expect.any(Date), lte: expect.any(Date) }, 
          },
          include: {
            vehicleAssignments: {
              include: {
                vehicle: { select: { id: true, name: true, capacity: true } },
                driver: { select: { id: true, name: true } },
              },
            },
            childAssignments: {
              select: {
                vehicleAssignmentId: true,
                child: { select: { id: true, name: true, familyId: true } },
              },
            },
          },
          orderBy: [{ datetime: 'asc' }],
        });

        // Verify cross-slot vehicle-specific assignments
        expect(result).toHaveLength(2);
        
        // Monday slot: Both children in same vehicle
        expect(result[0].childAssignments).toHaveLength(2);
        expect(result[0].childAssignments[0].vehicleAssignmentId).toBe('vehicle-assignment-1');
        expect(result[0].childAssignments[1].vehicleAssignmentId).toBe('vehicle-assignment-1');
        
        // Tuesday slot: Children in different vehicles
        expect(result[1].childAssignments).toHaveLength(2);
        expect(result[1].childAssignments[0].vehicleAssignmentId).toBe('vehicle-assignment-2');
        expect(result[1].childAssignments[1].vehicleAssignmentId).toBe('vehicle-assignment-3');
      });

      it('should handle slots with mixed vehicle assignments', async () => {
        const mockMixedSlots = [
          {
            id: 'slot-mixed',
            groupId: 'group-1',
            datetime: new Date('2024-01-10T15:00:00.000Z'),
            vehicleAssignments: [
              {
                id: 'vehicle-assignment-4',
                vehicle: { id: 'vehicle-1', name: 'Bus #1', capacity: 8 },
                driver: { id: 'driver-1', name: 'John Driver' },
              },
              {
                id: 'vehicle-assignment-5',
                vehicle: { id: 'vehicle-2', name: 'Van #1', capacity: 4 },
                driver: null, // No driver assigned
              },
            ],
            childAssignments: [
              // No children assigned to any vehicle yet
            ],
          },
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockMixedSlots);

        const weekStart = new Date('2024-01-08T00:00:00.000Z'); 
        const weekEnd = new Date('2024-01-14T23:59:59.999Z');
        const result = await repository.getWeeklyScheduleByDateRange('group-1', weekStart, weekEnd);

        expect(result).toHaveLength(1);
        expect(result[0].vehicleAssignments).toHaveLength(2);
        expect(result[0].childAssignments).toHaveLength(0);
        expect(result[0].vehicleAssignments[1].driver).toBeNull();
      });
    });

    describe('Vehicle-specific capacity validation', () => {
      it('should support querying with capacity constraints per vehicle', async () => {
        const mockSlotWithCapacityData = {
          ...mockScheduleSlot,
          vehicleAssignments: [
            {
              id: 'vehicle-assignment-1',
              scheduleSlotId: 'slot-1',
              vehicleId: 'vehicle-1',
              driverId: 'driver-1',
              vehicle: { id: 'vehicle-1', name: 'Bus #1', capacity: 3 }, // Small capacity for testing
              driver: { id: 'driver-1', name: 'John Driver' },
            },
          ],
          childAssignments: [
            {
              vehicleAssignmentId: 'vehicle-assignment-1',
              child: { id: 'child-1', name: 'Alice', familyId: 'family-1' },
            },
            {
              vehicleAssignmentId: 'vehicle-assignment-1',
              child: { id: 'child-2', name: 'Bob', familyId: 'family-2' },
            },
            {
              vehicleAssignmentId: 'vehicle-assignment-1',
              child: { id: 'child-3', name: 'Charlie', familyId: 'family-3' },
            },
          ],
        };

        mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlotWithCapacityData);

        const result = await repository.findById('slot-1');

        expect(result).not.toBeNull();
        // Verify that we can assess vehicle capacity utilization
        const vehicleAssignment = result!.vehicleAssignments[0];
        const childrenInVehicle = result!.childAssignments.filter(
          ca => ca.vehicleAssignmentId === vehicleAssignment.id,
        );

        expect(vehicleAssignment.vehicle.capacity).toBe(3);
        expect(childrenInVehicle).toHaveLength(3); // At capacity
        expect(childrenInVehicle.length).toBe(vehicleAssignment.vehicle.capacity);
      });
    });
  });

  describe('Timezone-Aware Week Filtering (Phase 2C)', () => {
    describe('getScheduleByWeek', () => {
      it('should filter schedules by week in user timezone (Asia/Tokyo)', async () => {
        // Week 1 of 2024 in Asia/Tokyo:
        // Monday 2024-01-01 00:00 JST = Sunday 2023-12-31 15:00 UTC
        // Sunday 2024-01-07 23:59:59.999 JST = Sunday 2024-01-07 14:59:59.999 UTC

        const mockSlots = [
          {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: new Date('2024-01-01T05:00:00.000Z'), // Monday 2024-01-01 14:00 JST - INCLUDED
            vehicleAssignments: [],
            childAssignments: [],
          },
          {
            id: 'slot-2',
            groupId: 'group-1',
            datetime: new Date('2024-01-07T10:00:00.000Z'), // Sunday 2024-01-07 19:00 JST - INCLUDED
            vehicleAssignments: [],
            childAssignments: [],
          },
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockSlots);

        const result = await repository.getScheduleByWeek('group-1', 2024, 1, 'Asia/Tokyo');

        // Verify correct week boundaries were used
        expect(mockPrisma.scheduleSlot.findMany).toHaveBeenCalledWith({
          where: {
            groupId: 'group-1',
            datetime: {
              gte: new Date('2023-12-31T15:00:00.000Z'), // Monday 2024-01-01 00:00 JST
              lte: new Date('2024-01-07T14:59:59.999Z'),  // Sunday 2024-01-07 23:59:59.999 JST
            },
          },
          include: expect.any(Object),
          orderBy: [{ datetime: 'asc' }],
        });

        expect(result).toEqual(mockSlots);
      });

      it('should not include schedules outside week boundaries', async () => {
        // Week 1 of 2024 in Asia/Tokyo
        const mockSlots = [
          {
            id: 'slot-inside',
            groupId: 'group-1',
            datetime: new Date('2024-01-01T05:00:00.000Z'), // Monday 14:00 JST - INCLUDED
            vehicleAssignments: [],
            childAssignments: [],
          },
          // Schedule at 2023-12-31 14:59 UTC (Sunday 2023-12-31 23:59 JST) would be EXCLUDED
          // Schedule at 2024-01-07 15:00 UTC (Monday 2024-01-08 00:00 JST) would be EXCLUDED
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockSlots);

        await repository.getScheduleByWeek('group-1', 2024, 1, 'Asia/Tokyo');

        const call = mockPrisma.scheduleSlot.findMany.mock.calls[0][0];
        const boundaries = call.where.datetime;

        // Verify excluded datetimes
        const beforeWeek = new Date('2023-12-31T14:59:00.000Z'); // Sunday 23:59 JST (before week)
        const afterWeek = new Date('2024-01-07T15:00:00.000Z');  // Monday 00:00 JST (after week)

        expect(beforeWeek.getTime()).toBeLessThan(boundaries.gte.getTime());
        expect(afterWeek.getTime()).toBeGreaterThan(boundaries.lte.getTime());
      });

      it('should handle week spanning two UTC days at start (America/Los_Angeles)', async () => {
        // Week 1 of 2024 in America/Los_Angeles (UTC-8):
        // Monday 2024-01-01 00:00 PST = Monday 2024-01-01 08:00 UTC
        // Sunday 2024-01-07 23:59:59.999 PST = Monday 2024-01-08 07:59:59.999 UTC

        const mockSlots = [
          {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: new Date('2024-01-01T10:00:00.000Z'), // Monday 02:00 PST - INCLUDED
            vehicleAssignments: [],
            childAssignments: [],
          },
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockSlots);

        await repository.getScheduleByWeek('group-1', 2024, 1, 'America/Los_Angeles');

        expect(mockPrisma.scheduleSlot.findMany).toHaveBeenCalledWith({
          where: {
            groupId: 'group-1',
            datetime: {
              gte: new Date('2024-01-01T08:00:00.000Z'), // Monday 00:00 PST
              lte: new Date('2024-01-08T07:59:59.999Z'),  // Sunday 23:59:59.999 PST
            },
          },
          include: expect.any(Object),
          orderBy: [{ datetime: 'asc' }],
        });
      });

      it('should handle week spanning two UTC days at end (Europe/Paris)', async () => {
        // Week 1 of 2024 in Europe/Paris (UTC+1):
        // Monday 2024-01-01 00:00 CET = Sunday 2023-12-31 23:00 UTC
        // Sunday 2024-01-07 23:59:59.999 CET = Sunday 2024-01-07 22:59:59.999 UTC

        const mockSlots = [
          {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: new Date('2024-01-01T10:00:00.000Z'), // Monday 11:00 CET - INCLUDED
            vehicleAssignments: [],
            childAssignments: [],
          },
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockSlots);

        await repository.getScheduleByWeek('group-1', 2024, 1, 'Europe/Paris');

        expect(mockPrisma.scheduleSlot.findMany).toHaveBeenCalledWith({
          where: {
            groupId: 'group-1',
            datetime: {
              gte: new Date('2023-12-31T23:00:00.000Z'), // Monday 00:00 CET
              lte: new Date('2024-01-07T22:59:59.999Z'),  // Sunday 23:59:59.999 CET
            },
          },
          include: expect.any(Object),
          orderBy: [{ datetime: 'asc' }],
        });
      });

      it('should handle DST transition week correctly (America/New_York)', async () => {
        // Week 11 of 2024 in America/New_York (DST starts March 10, 2024):
        // Monday 2024-03-11 00:00 EDT = Monday 2024-03-11 04:00 UTC (after DST)
        // Note: The week starts AFTER DST transition

        const mockSlots = [
          {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: new Date('2024-03-11T10:00:00.000Z'), // Monday 06:00 EDT - INCLUDED
            vehicleAssignments: [],
            childAssignments: [],
          },
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockSlots);

        await repository.getScheduleByWeek('group-1', 2024, 11, 'America/New_York');

        const call = mockPrisma.scheduleSlot.findMany.mock.calls[0][0];
        const boundaries = call.where.datetime;

        // Verify boundaries account for DST
        expect(boundaries.gte).toBeInstanceOf(Date);
        expect(boundaries.lte).toBeInstanceOf(Date);

        // Week should span exactly 7 days
        const weekDuration = boundaries.lte.getTime() - boundaries.gte.getTime();
        const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000 - 1; // -1 for the .999ms
        expect(Math.abs(weekDuration - sevenDaysInMs)).toBeLessThan(1000); // Within 1 second tolerance for DST
      });

      it('should call isoWeekUtils.getDateFromISOWeek with correct parameters', async () => {
        const getDateFromISOWeekSpy = jest.spyOn(isoWeekUtils, 'getDateFromISOWeek');
        const getWeekBoundariesSpy = jest.spyOn(isoWeekUtils, 'getWeekBoundaries');

        mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

        await repository.getScheduleByWeek('group-1', 2024, 10, 'Europe/London');

        expect(getDateFromISOWeekSpy).toHaveBeenCalledWith(2024, 10, 'Europe/London');
        expect(getWeekBoundariesSpy).toHaveBeenCalled();

        getDateFromISOWeekSpy.mockRestore();
        getWeekBoundariesSpy.mockRestore();
      });
    });

    describe('getScheduleByWeekFromDate', () => {
      it('should filter schedules by week from reference datetime', async () => {
        const mockSlots = [
          {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: new Date('2024-01-03T10:00:00.000Z'),
            vehicleAssignments: [],
            childAssignments: [],
          },
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockSlots);

        // Reference datetime in Week 1 of 2024
        const referenceDate = new Date('2024-01-03T10:00:00.000Z');
        const result = await repository.getScheduleByWeekFromDate('group-1', referenceDate, 'Asia/Tokyo');

        // Should calculate boundaries for the week containing Jan 3, 2024
        expect(mockPrisma.scheduleSlot.findMany).toHaveBeenCalledWith({
          where: {
            groupId: 'group-1',
            datetime: {
              gte: expect.any(Date),
              lte: expect.any(Date),
            },
          },
          include: expect.any(Object),
          orderBy: [{ datetime: 'asc' }],
        });

        expect(result).toEqual(mockSlots);
      });

      it('should call isoWeekUtils.getWeekBoundaries with correct parameters', async () => {
        const getWeekBoundariesSpy = jest.spyOn(isoWeekUtils, 'getWeekBoundaries');

        mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

        const referenceDate = new Date('2024-03-15T10:00:00.000Z');
        await repository.getScheduleByWeekFromDate('group-1', referenceDate, 'America/Chicago');

        expect(getWeekBoundariesSpy).toHaveBeenCalledWith(referenceDate, 'America/Chicago');

        getWeekBoundariesSpy.mockRestore();
      });

      it('should accept ISO string as datetime parameter', async () => {
        mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

        const isoString = '2024-01-03T10:00:00.000Z';
        await repository.getScheduleByWeekFromDate('group-1', isoString, 'Europe/Berlin');

        expect(mockPrisma.scheduleSlot.findMany).toHaveBeenCalled();
      });

      it('should handle timezone transitions correctly when finding week from date', async () => {
        // Test with a date during DST transition
        mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

        const dstDate = new Date('2024-03-10T10:00:00.000Z'); // DST transition in America/New_York
        await repository.getScheduleByWeekFromDate('group-1', dstDate, 'America/New_York');

        const call = mockPrisma.scheduleSlot.findMany.mock.calls[0][0];
        const boundaries = call.where.datetime;

        expect(boundaries.gte).toBeInstanceOf(Date);
        expect(boundaries.lte).toBeInstanceOf(Date);
        expect(boundaries.lte.getTime()).toBeGreaterThan(boundaries.gte.getTime());
      });
    });

    describe('Integration with existing methods', () => {
      it('getWeeklyScheduleByDateRange should still work but is deprecated', async () => {
        const mockSlots = [
          {
            id: 'slot-1',
            groupId: 'group-1',
            datetime: new Date('2024-01-08T08:00:00.000Z'),
            vehicleAssignments: [],
            childAssignments: [],
          },
        ];

        mockPrisma.scheduleSlot.findMany.mockResolvedValue(mockSlots);

        const weekStart = new Date('2024-01-08T00:00:00.000Z');
        const weekEnd = new Date('2024-01-14T23:59:59.999Z');
        const result = await repository.getWeeklyScheduleByDateRange('group-1', weekStart, weekEnd);

        expect(result).toEqual(mockSlots);
      });

      it('new methods should include same relations as deprecated method', async () => {
        mockPrisma.scheduleSlot.findMany.mockResolvedValue([]);

        await repository.getScheduleByWeek('group-1', 2024, 1, 'UTC');

        const newMethodCall = mockPrisma.scheduleSlot.findMany.mock.calls[0][0];

        mockPrisma.scheduleSlot.findMany.mockClear();

        await repository.getWeeklyScheduleByDateRange(
          'group-1',
          new Date('2024-01-01'),
          new Date('2024-01-07'),
        );

        const oldMethodCall = mockPrisma.scheduleSlot.findMany.mock.calls[0][0];

        // Both should include the same relations
        expect(newMethodCall.include).toEqual(oldMethodCall.include);
        expect(newMethodCall.orderBy).toEqual(oldMethodCall.orderBy);
      });
    });
  });
});