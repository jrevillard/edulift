import { ScheduleSlotService } from '../ScheduleSlotService';
import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';
import { NotificationService } from '../NotificationService';
import { ScheduleSlotValidationService } from '../ScheduleSlotValidationService';
import { CreateScheduleSlotData, AssignVehicleToSlotData } from '../../types';
import { PrismaClient } from '@prisma/client';

// Mock dependencies
jest.mock('../../repositories/ScheduleSlotRepository');
jest.mock('../NotificationService');
jest.mock('../ScheduleSlotValidationService');
jest.mock('@prisma/client');

describe('ScheduleSlotService', () => {
  let scheduleSlotService: ScheduleSlotService;
  let mockRepository: jest.Mocked<ScheduleSlotRepository>;
  let mockNotificationService: jest.Mocked<NotificationService>;
  let mockValidationService: jest.Mocked<ScheduleSlotValidationService>;
  let mockPrisma: jest.Mocked<PrismaClient>;

  const mockScheduleSlot = {
    id: 'slot-1',
    groupId: 'group-1',
    datetime: new Date('2050-01-08T08:00:00.000Z'), // Use future date to avoid "Cannot create trips in the past" error
    group: {
      id: 'group-1',
      name: 'Group 1',
    },
    vehicleAssignments: [],
    childAssignments: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      assignVehicleToSlot: jest.fn(),
      removeVehicleFromSlot: jest.fn(),
      assignChildToSlot: jest.fn(),
      removeChildFromSlot: jest.fn(),
      updateVehicleDriver: jest.fn(),
      getWeeklyScheduleByDateRange: jest.fn(),
      findConflictingSlotsForParentByDateTime: jest.fn(),
      updateSeatOverride: jest.fn(),
      findVehicleAssignmentById: jest.fn(),
      findByGroupAndDateTime: jest.fn(),
      findSlotsByDateTimeRange: jest.fn(),
    } as any;

    mockNotificationService = {
      notifyScheduleSlotChange: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockValidationService = {
      validateSlotTiming: jest.fn(),
      validateVehicleAssignment: jest.fn(),
      validateDriverAvailability: jest.fn(),
      validateChildAssignment: jest.fn(),
      validateSlotIntegrity: jest.fn(),
      validateSeatOverride: jest.fn(),
      validateScheduleTime: jest.fn(),
    } as any;

    mockPrisma = {
      user: {
        findUnique: jest.fn() as any,
      },
      group: {
        findUnique: jest.fn() as any,
      },
    } as any;

    scheduleSlotService = new ScheduleSlotService(
      mockRepository,
      mockNotificationService,
      mockValidationService,
      mockPrisma,
    );
  });

  describe('createScheduleSlotWithVehicle', () => {
    it('should create a schedule slot with vehicle successfully', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: 'group-1',
        datetime: '2050-01-08T08:00:00.000Z',
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        name: 'Test User',
        timezone: 'Europe/Paris',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepository.create.mockResolvedValue(mockScheduleSlot);
      mockRepository.assignVehicleToSlot.mockResolvedValue({
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: 'driver-1',
          name: 'John Doe',
        },
      });
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);

      const result = await scheduleSlotService.createScheduleSlotWithVehicle(
        slotData,
        'vehicle-1',
        'user-1', // Pass userId instead of timezone
        'driver-1',
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: { timezone: true },
      });
      expect(mockValidationService.validateScheduleTime).toHaveBeenCalledWith(
        'group-1',
        new Date('2050-01-08T08:00:00.000Z'),
        'Europe/Paris', // Timezone from user DB
      );
      expect(mockRepository.create).toHaveBeenCalledWith(slotData);
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith(
        'slot-1',
        'vehicle-1',
        'driver-1',
        undefined,
      );
      expect(mockRepository.findById).toHaveBeenCalledWith('slot-1');
      expect(result).toEqual(mockScheduleSlot);
    });
  });

  describe('assignVehicleToSlot', () => {
    it('should assign vehicle to slot successfully', async () => {
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
      };

      const mockVehicleAssignment = {
        id: 'assignment-1',
        createdAt: new Date(),
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: null,
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: 'driver-1',
          name: 'John Doe',
        },
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockValidationService.validateVehicleAssignment.mockResolvedValue(undefined);
      mockValidationService.validateDriverAvailability.mockResolvedValue(undefined);
      mockValidationService.validateSlotIntegrity.mockResolvedValue(true);
      mockRepository.assignVehicleToSlot.mockResolvedValue(mockVehicleAssignment);

      const result = await scheduleSlotService.assignVehicleToSlot(assignmentData);

      expect(mockValidationService.validateVehicleAssignment).toHaveBeenCalledWith(
        'vehicle-1',
        'slot-1',
      );
      expect(mockValidationService.validateDriverAvailability).toHaveBeenCalledWith(
        'driver-1',
        'slot-1',
      );
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith(
        'slot-1',
        'vehicle-1',
        'driver-1',
        undefined,
      );
      expect(mockValidationService.validateSlotIntegrity).toHaveBeenCalledWith('slot-1');
      expect(mockNotificationService.notifyScheduleSlotChange).toHaveBeenCalledWith(
        'slot-1',
        'VEHICLE_ASSIGNED',
      );
      expect(result).toEqual(mockVehicleAssignment);
    });

    it('should handle validation errors', async () => {
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockValidationService.validateVehicleAssignment.mockRejectedValue(
        new Error('Vehicle not available'),
      );

      await expect(scheduleSlotService.assignVehicleToSlot(assignmentData))
        .rejects.toThrow('Vehicle not available');
    });
  });

  describe('removeVehicleFromSlot', () => {
    it('should remove vehicle and keep slot when other vehicles exist', async () => {
      const mockResult = {
        vehicleAssignment: { 
          id: 'assignment-1',
          createdAt: new Date(),
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          driverId: null,
        seatOverride: null,
        },
        slotDeleted: false,
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.removeVehicleFromSlot.mockResolvedValue(mockResult);
      mockValidationService.validateSlotIntegrity.mockResolvedValue(true);

      const result = await scheduleSlotService.removeVehicleFromSlot('slot-1', 'vehicle-1');

      expect(mockRepository.removeVehicleFromSlot).toHaveBeenCalledWith('slot-1', 'vehicle-1');
      expect(mockValidationService.validateSlotIntegrity).toHaveBeenCalledWith('slot-1');
      expect(mockNotificationService.notifyScheduleSlotChange).toHaveBeenCalledWith(
        'slot-1',
        'VEHICLE_REMOVED',
      );
      expect(result).toEqual(mockResult);
    });

    it('should remove vehicle and delete slot when it was the last vehicle', async () => {
      const mockResult = {
        vehicleAssignment: { 
          id: 'assignment-1',
          createdAt: new Date(),
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          driverId: null,
        seatOverride: null,
        },
        slotDeleted: true,
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.removeVehicleFromSlot.mockResolvedValue(mockResult);

      const result = await scheduleSlotService.removeVehicleFromSlot('slot-1', 'vehicle-1');

      expect(mockRepository.removeVehicleFromSlot).toHaveBeenCalledWith('slot-1', 'vehicle-1');
      // Should not validate slot integrity when slot is deleted
      expect(mockValidationService.validateSlotIntegrity).not.toHaveBeenCalled();
      expect(result).toEqual(mockResult);
    });
  });

  describe('getScheduleSlotDetails', () => {
    it('should return detailed schedule slot information', async () => {
      const mockSlotWithDetails = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          {
            id: 'assignment-1',
            createdAt: new Date(),
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            driverId: 'driver-1' as string | null,
        seatOverride: null,
            vehicle: { id: 'vehicle-1', name: 'Bus 1', capacity: 20 },
            driver: { id: 'driver-1', name: 'John Doe' },
          },
        ],
        childAssignments: [
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-1',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { id: 'child-1', name: 'Alice', familyId: 'family-1' }, 
          },
        ],
      };

      mockRepository.findById.mockResolvedValue(mockSlotWithDetails);

      const result = await scheduleSlotService.getScheduleSlotDetails('slot-1');

      expect(mockRepository.findById).toHaveBeenCalledWith('slot-1');
      expect(result).toBeDefined();
      expect(result!.totalCapacity).toBe(20);
      expect(result!.availableSeats).toBe(19); // 20 - 1 child
      expect(result!.vehicleAssignments).toHaveLength(1);
      expect(result!.childAssignments).toHaveLength(1);
      expect(result!.childAssignments[0].vehicleAssignmentId).toBe('assignment-1');
    });

    it('should return all valid child assignments with vehicleAssignmentId', async () => {
      const mockSlotWithValidAssignments = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          {
            id: 'assignment-1',
            createdAt: new Date(),
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            driverId: 'driver-1' as string | null,
        seatOverride: null,
            vehicle: { id: 'vehicle-1', name: 'Bus 1', capacity: 20 },
            driver: { id: 'driver-1', name: 'John Doe' },
          },
        ],
        childAssignments: [
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-1',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { id: 'child-1', name: 'Alice', familyId: 'family-1' }, 
          },
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-2',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { id: 'child-2', name: 'Bob', familyId: 'family-2' }, 
          },
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-3',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { id: 'child-3', name: 'Charlie', userId: 'parent-3' }, 
          },
        ],
      };

      mockRepository.findById.mockResolvedValue(mockSlotWithValidAssignments);

      const result = await scheduleSlotService.getScheduleSlotDetails('slot-1');

      expect(result).toBeDefined();
      expect(result!.childAssignments).toHaveLength(3); // All valid assignments
      expect(result!.childAssignments.every(ca => ca.vehicleAssignmentId)).toBe(true);
    });

    it('should include vehicleAssignmentId in child assignments for proper vehicle filtering', async () => {
      const mockSlotWithMultipleVehicles = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          {
            id: 'assignment-1',
            createdAt: new Date(),
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            driverId: 'driver-1' as string | null,
        seatOverride: null,
            vehicle: { id: 'vehicle-1', name: 'Bus 1', capacity: 10 },
            driver: { id: 'driver-1', name: 'John Doe' },
          },
          {
            id: 'assignment-2',
            createdAt: new Date(),
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-2',
            driverId: 'driver-2',
        seatOverride: null,
            vehicle: { id: 'vehicle-2', name: 'Bus 2', capacity: 15 },
            driver: { id: 'driver-2', name: 'Jane Smith' },
          },
        ],
        childAssignments: [
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-1',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { id: 'child-1', name: 'Alice', familyId: 'family-1' }, 
          },
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-2',
            vehicleAssignmentId: 'assignment-2',
            assignedAt: new Date(),
            child: { id: 'child-2', name: 'Bob', familyId: 'family-2' }, 
          },
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-3',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { id: 'child-3', name: 'Charlie', userId: 'parent-3' }, 
          },
        ],
      };

      mockRepository.findById.mockResolvedValue(mockSlotWithMultipleVehicles);

      const result = await scheduleSlotService.getScheduleSlotDetails('slot-1');

      expect(result).toBeDefined();
      expect(result!.childAssignments).toHaveLength(3);
      
      // Check vehicle assignment IDs are properly included
      const childrenInVehicle1 = result!.childAssignments.filter(ca => ca.vehicleAssignmentId === 'assignment-1');
      const childrenInVehicle2 = result!.childAssignments.filter(ca => ca.vehicleAssignmentId === 'assignment-2');
      
      expect(childrenInVehicle1).toHaveLength(2); // Alice and Charlie
      expect(childrenInVehicle2).toHaveLength(1); // Bob
      
      expect(childrenInVehicle1.map(c => c.child.name)).toEqual(['Alice', 'Charlie']);
      expect(childrenInVehicle2.map(c => c.child.name)).toEqual(['Bob']);
    });

    it('should return null for non-existent slot', async () => {
      mockRepository.findById.mockResolvedValue(null);

      const result = await scheduleSlotService.getScheduleSlotDetails('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('getSchedule', () => {
    it('should return schedule with slot details', async () => {
      const mockSlots = [mockScheduleSlot];

      // Mock group lookup for timezone
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: 'group-1',
        timezone: 'Europe/Paris',
      });

      mockRepository.getWeeklyScheduleByDateRange.mockResolvedValue(mockSlots);
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);

      const startDate = '2024-01-01T00:00:00.000Z';
      const endDate = '2024-01-07T23:59:59.999Z';
      const result = await scheduleSlotService.getSchedule('group-1', startDate, endDate);

      expect(mockRepository.getWeeklyScheduleByDateRange).toHaveBeenCalledWith('group-1', expect.any(Date), expect.any(Date));
      expect(result.startDate).toBe(startDate);
      expect(result.endDate).toBe(endDate);
      expect(result.groupId).toBe('group-1');
      expect(result.scheduleSlots).toHaveLength(1);
    });

    it('should process slots and include vehicleAssignmentId in child assignments', async () => {
      const mockSlotWithAssignments = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          {
            id: 'assignment-1',
            createdAt: new Date(),
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            driverId: 'driver-1' as string | null,
        seatOverride: null,
            vehicle: { id: 'vehicle-1', name: 'Bus 1', capacity: 20 },
            driver: { id: 'driver-1', name: 'John Doe' },
          },
        ],
        childAssignments: [
          {
            scheduleSlotId: 'slot-1',
            childId: 'child-1',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { id: 'child-1', name: 'Alice', familyId: 'family-1' },
          },
        ],
      };

      // Mock group lookup for timezone
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: 'group-1',
        timezone: 'Europe/Paris',
      });

      mockRepository.getWeeklyScheduleByDateRange.mockResolvedValue([mockSlotWithAssignments]);
      mockRepository.findById.mockResolvedValue(mockSlotWithAssignments);

      const result = await scheduleSlotService.getSchedule('group-1', '2024-01-01T00:00:00.000Z', '2024-01-07T23:59:59.999Z');

      expect(result.scheduleSlots).toHaveLength(1);
      expect(result.scheduleSlots[0].childAssignments).toHaveLength(1);
      expect(result.scheduleSlots[0].childAssignments[0].vehicleAssignmentId).toBe('assignment-1');
      expect(result.scheduleSlots[0].childAssignments[0].child.name).toBe('Alice');
    });
  });

  describe('validateSlotConflicts', () => {
    it('should detect capacity conflicts', async () => {
      const mockSlotWithConflict = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          { 
            id: 'assignment-1',
            createdAt: new Date(),
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            driverId: null,
        seatOverride: null,
            vehicle: { 
              id: 'vehicle-1',
              name: 'Bus 1',
              capacity: 2, 
            },
            driver: null,
          },
        ],
        childAssignments: [
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-1',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { 
              id: 'child-1',
              name: 'Child 1',
              familyId: 'family-1',
            }, 
          },
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-2',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { 
              id: 'child-2',
              name: 'Child 2',
              familyId: 'family-2',
            }, 
          },
          { 
            scheduleSlotId: 'slot-1',
            childId: 'child-3',
            vehicleAssignmentId: 'assignment-1',
            assignedAt: new Date(),
            child: { 
              id: 'child-3',
              name: 'Child 3',
              userId: 'parent-3',
            }, 
          }, // More children than capacity
        ],
      };

      mockRepository.findById.mockResolvedValue(mockSlotWithConflict);

      const conflicts = await scheduleSlotService.validateSlotConflicts('slot-1');

      expect(conflicts).toContain('CAPACITY_EXCEEDED');
    });

    it('should detect driver double booking', async () => {
      const mockSlotWithDriver = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          { 
            id: 'assignment-1',
            createdAt: new Date(),
            scheduleSlotId: 'slot-1',
            vehicleId: 'vehicle-1',
            driverId: 'driver-1' as string | null,
        seatOverride: null,
            vehicle: { 
              id: 'vehicle-1',
              name: 'Bus 1',
              capacity: 30, 
            },
            driver: { 
              id: 'driver-1',
              name: 'John Doe',
            },
          },
        ],
      };

      const conflictingSlots = [
        { 
          id: 'slot-1',
          groupId: 'group-1',
          datetime: new Date('2050-01-08T08:00:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          vehicleAssignments: [
            {
              id: 'assignment-1',
              createdAt: new Date(),
              scheduleSlotId: 'slot-1',
              vehicleId: 'vehicle-1',
              driverId: 'driver-1' as string | null,
        seatOverride: null,
              vehicle: { 
                id: 'vehicle-1',
                name: 'Bus 1',
              },
            },
          ],
          childAssignments: [],
        },
        { 
          id: 'slot-2',
          groupId: 'group-1',
          datetime: new Date('2050-01-08T08:00:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          vehicleAssignments: [
            {
              id: 'assignment-2',
              createdAt: new Date(),
              scheduleSlotId: 'slot-2',
              vehicleId: 'vehicle-2',
              driverId: 'driver-1' as string | null,
        seatOverride: null,
              vehicle: { 
                id: 'vehicle-2',
                name: 'Bus 2',
              },
            },
          ],
          childAssignments: [],
        }, // Two slots with same driver
      ];

      mockRepository.findById.mockResolvedValue(mockSlotWithDriver);
      mockRepository.findConflictingSlotsForParentByDateTime.mockResolvedValue(conflictingSlots);

      const conflicts = await scheduleSlotService.validateSlotConflicts('slot-1');

      expect(conflicts).toContain('DRIVER_DOUBLE_BOOKING');
    });
  });

  describe('updateSeatOverride', () => {
    it('should update seat override successfully', async () => {
      const mockVehicleAssignment = {
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: null,
        seatOverride: 15,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: null,
      };

      const updateData = {
        vehicleAssignmentId: 'assignment-1',
        seatOverride: 15,
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.updateSeatOverride.mockResolvedValue(mockVehicleAssignment);
      mockRepository.findVehicleAssignmentById.mockResolvedValue(mockVehicleAssignment);

      const result = await scheduleSlotService.updateSeatOverride(updateData);

      expect(mockValidationService.validateSeatOverride).toHaveBeenCalledWith(15);
      expect(mockRepository.updateSeatOverride).toHaveBeenCalledWith('assignment-1', 15);
      expect(mockValidationService.validateSlotIntegrity).toHaveBeenCalledWith('slot-1');
      expect(result).toEqual(mockVehicleAssignment);
    });

    it('should clear seat override when undefined is passed', async () => {
      const mockVehicleAssignment = {
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: null,
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: null,
      };

      const updateData: { vehicleAssignmentId: string, seatOverride?: number } = {
        vehicleAssignmentId: 'assignment-1',
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.updateSeatOverride.mockResolvedValue(mockVehicleAssignment);
      mockRepository.findVehicleAssignmentById.mockResolvedValue(mockVehicleAssignment);

      const result = await scheduleSlotService.updateSeatOverride(updateData);

      expect(mockValidationService.validateSeatOverride).not.toHaveBeenCalled();
      expect(mockRepository.updateSeatOverride).toHaveBeenCalledWith('assignment-1', undefined);
      expect(result).toEqual(mockVehicleAssignment);
    });

    it('should not validate seat override if undefined', async () => {
      const mockVehicleAssignment = {
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: null,
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: null,
      };

      const updateData = {
        vehicleAssignmentId: 'assignment-1',
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.updateSeatOverride.mockResolvedValue(mockVehicleAssignment);
      mockRepository.findVehicleAssignmentById.mockResolvedValue(mockVehicleAssignment);

      await scheduleSlotService.updateSeatOverride(updateData);

      expect(mockValidationService.validateSeatOverride).not.toHaveBeenCalled();
    });

    it('should send notification when seat override is updated', async () => {
      const mockVehicleAssignment = {
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: null,
        seatOverride: 15,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: null,
      };

      const updateData = {
        vehicleAssignmentId: 'assignment-1',
        seatOverride: 15,
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.updateSeatOverride.mockResolvedValue(mockVehicleAssignment);
      mockRepository.findVehicleAssignmentById.mockResolvedValue(mockVehicleAssignment);

      await scheduleSlotService.updateSeatOverride(updateData);

      expect(mockNotificationService.notifyScheduleSlotChange).toHaveBeenCalledWith('slot-1', 'SEAT_OVERRIDE_UPDATED');
    });
  });

  describe('assignVehicleToSlot with seat override', () => {
    it('should pass seat override to repository when assigning vehicle', async () => {
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: 15,
      };

      const mockResult = { 
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: 15,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: 'driver-1',
          name: 'John Doe',
        },
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockValidationService.validateVehicleAssignment.mockResolvedValue(undefined);
      mockValidationService.validateDriverAvailability.mockResolvedValue(undefined);
      mockValidationService.validateSlotIntegrity.mockResolvedValue(true);
      mockRepository.assignVehicleToSlot.mockResolvedValue(mockResult);

      const result = await scheduleSlotService.assignVehicleToSlot(assignmentData);

      expect(mockValidationService.validateSeatOverride).toHaveBeenCalledWith(15);
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith('slot-1', 'vehicle-1', 'driver-1', 15);
      expect(result).toEqual(mockResult);
    });

    it('should not validate seat override if not provided', async () => {
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
      };

      const mockResult = { 
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: 'driver-1',
          name: 'John Doe',
        },
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockValidationService.validateVehicleAssignment.mockResolvedValue(undefined);
      mockValidationService.validateDriverAvailability.mockResolvedValue(undefined);
      mockValidationService.validateSlotIntegrity.mockResolvedValue(true);
      mockRepository.assignVehicleToSlot.mockResolvedValue(mockResult);

      await scheduleSlotService.assignVehicleToSlot(assignmentData);

      expect(mockValidationService.validateSeatOverride).not.toHaveBeenCalled();
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith('slot-1', 'vehicle-1', 'driver-1', undefined);
    });
  });

  describe('createScheduleSlotWithVehicle with seat override', () => {
    it('should pass seat override to assignVehicleToSlot when creating slot', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: 'group-1',
        datetime: '2050-01-08T08:00:00.000Z',
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        timezone: 'Europe/Paris',
      });

      mockRepository.create.mockResolvedValue(mockScheduleSlot);
      mockRepository.assignVehicleToSlot.mockResolvedValue({
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: 15,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: 'driver-1',
          name: 'John Doe',
        },
      });
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockValidationService.validateScheduleTime.mockResolvedValue(undefined);

      await scheduleSlotService.createScheduleSlotWithVehicle(slotData, 'vehicle-1', 'user-1', 'driver-1', 15);

      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith('slot-1', 'vehicle-1', 'driver-1', 15);
    });
  });

  describe('validateScheduleTime integration', () => {
    it('should call validateScheduleTime when creating a schedule slot', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: 'group-1',
        datetime: '2050-01-13T07:30:00.000Z', // Monday, 07:30 UTC
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        timezone: 'UTC',
      });

      mockRepository.create.mockResolvedValue(mockScheduleSlot);
      mockRepository.assignVehicleToSlot.mockResolvedValue({
        id: 'assignment-1',
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: 'driver-1',
          name: 'John Doe',
        },
      });
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockValidationService.validateScheduleTime.mockResolvedValue(undefined);

      await scheduleSlotService.createScheduleSlotWithVehicle(slotData, 'vehicle-1', 'user-1', 'driver-1');

      expect(mockValidationService.validateScheduleTime).toHaveBeenCalledWith(
        'group-1',
        new Date('2050-01-13T07:30:00.000Z'),
        'UTC',
      );
      expect(mockRepository.create).toHaveBeenCalledWith(slotData);
    });

    it('should reject slot creation when time is not configured', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: 'group-1',
        datetime: '2050-01-13T05:30:00.000Z', // Invalid time
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        timezone: 'Europe/Paris',
      });

      mockValidationService.validateScheduleTime.mockRejectedValue(
        new Error('Time 05:30 is not configured for MONDAY in this group'),
      );

      await expect(
        scheduleSlotService.createScheduleSlotWithVehicle(slotData, 'vehicle-1', 'user-1', 'driver-1'),
      ).rejects.toThrow('Time 05:30 is not configured for MONDAY in this group');

      expect(mockValidationService.validateScheduleTime).toHaveBeenCalledWith(
        'group-1',
        new Date('2050-01-13T05:30:00.000Z'),
        'Europe/Paris',
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should reject slot creation when group has no schedule config', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: 'group-1',
        datetime: '2050-01-13T07:30:00.000Z',
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: 'user-1',
        timezone: 'Europe/Paris',
      });

      mockValidationService.validateScheduleTime.mockRejectedValue(
        new Error('Group has no schedule configuration'),
      );

      await expect(
        scheduleSlotService.createScheduleSlotWithVehicle(slotData, 'vehicle-1', 'user-1', 'driver-1'),
      ).rejects.toThrow('Group has no schedule configuration');

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
});