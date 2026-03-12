import { ScheduleSlotService } from '../ScheduleSlotService';
import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';
import { NotificationService } from '../NotificationService';
import { ScheduleSlotValidationService } from '../ScheduleSlotValidationService';
import { CreateScheduleSlotData, AssignVehicleToSlotData } from '../../types';
import { PrismaClient } from '@prisma/client';
import { TEST_IDS } from '../../utils/testHelpers';

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
    id: TEST_IDS.SLOT,
    groupId: TEST_IDS.GROUP,
    datetime: new Date('2050-01-08T08:00:00.000Z'), // Use future date to avoid "Cannot create trips in the past" error
    group: {
      id: TEST_IDS.GROUP,
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
        groupId: TEST_IDS.GROUP,
        datetime: '2050-01-08T08:00:00.000Z',
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_IDS.USER,
        email: 'test@test.com',
        name: 'Test User',
        timezone: 'Europe/Paris',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockRepository.create.mockResolvedValue(mockScheduleSlot);
      mockRepository.assignVehicleToSlot.mockResolvedValue({
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: TEST_IDS.DRIVER,
          name: 'John Doe',
        },
      });
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);

      const result = await scheduleSlotService.createScheduleSlotWithVehicle(
        slotData,
        TEST_IDS.VEHICLE,
        TEST_IDS.USER, // Pass userId instead of timezone
        TEST_IDS.DRIVER,
      );

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: TEST_IDS.USER },
        select: { timezone: true },
      });
      expect(mockValidationService.validateScheduleTime).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        new Date('2050-01-08T08:00:00.000Z'),
        'Europe/Paris', // Timezone from user DB
      );
      expect(mockRepository.create).toHaveBeenCalledWith(slotData);
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        TEST_IDS.VEHICLE,
        TEST_IDS.DRIVER,
        undefined,
      );
      expect(mockRepository.findById).toHaveBeenCalledWith(TEST_IDS.SLOT);
      expect(result).toEqual(mockScheduleSlot);
    });
  });

  describe('assignVehicleToSlot', () => {
    it('should assign vehicle to slot successfully', async () => {
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
      };

      const mockVehicleAssignment = {
        id: 'cltestassign1234567890123',
        createdAt: new Date(),
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
        seatOverride: null,
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: TEST_IDS.DRIVER,
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
        TEST_IDS.VEHICLE,
        TEST_IDS.SLOT,
      );
      expect(mockValidationService.validateDriverAvailability).toHaveBeenCalledWith(
        TEST_IDS.DRIVER,
        TEST_IDS.SLOT,
      );
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        TEST_IDS.VEHICLE,
        TEST_IDS.DRIVER,
        undefined,
      );
      expect(mockValidationService.validateSlotIntegrity).toHaveBeenCalledWith(TEST_IDS.SLOT);
      expect(mockNotificationService.notifyScheduleSlotChange).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        'VEHICLE_ASSIGNED',
      );
      expect(result).toEqual(mockVehicleAssignment);
    });

    it('should handle validation errors', async () => {
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
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
      const mockScheduleSlotFromRepo = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date(),
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        vehicleAssignments: [{
          id: 'cltestassign1234567890123',
          createdAt: new Date(),
          scheduleSlotId: TEST_IDS.SLOT,
          vehicleId: TEST_IDS.VEHICLE,
          driverId: null,
          seatOverride: null,
          vehicle: {
            id: TEST_IDS.VEHICLE,
            name: 'Test Vehicle',
            capacity: 4,
            familyId: TEST_IDS.FAMILY,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          driver: null,
        }],
        childAssignments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.removeVehicleFromSlot.mockResolvedValue({ scheduleSlot: mockScheduleSlotFromRepo, slotDeleted: false });
      mockValidationService.validateSlotIntegrity.mockResolvedValue(true);

      const result = await scheduleSlotService.removeVehicleFromSlot(TEST_IDS.SLOT, TEST_IDS.VEHICLE);

      expect(mockRepository.removeVehicleFromSlot).toHaveBeenCalledWith(TEST_IDS.SLOT, TEST_IDS.VEHICLE);
      expect(mockValidationService.validateSlotIntegrity).toHaveBeenCalledWith(TEST_IDS.SLOT);
      expect(mockNotificationService.notifyScheduleSlotChange).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        'VEHICLE_REMOVED',
      );
      expect(result.slotDeleted).toBe(false);
      expect(result.scheduleSlot).toBeDefined();
    });

    it('should remove vehicle and delete slot when it was the last vehicle', async () => {
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.removeVehicleFromSlot.mockResolvedValue({ scheduleSlot: null, slotDeleted: true });

      const result = await scheduleSlotService.removeVehicleFromSlot(TEST_IDS.SLOT, TEST_IDS.VEHICLE);

      expect(mockRepository.removeVehicleFromSlot).toHaveBeenCalledWith(TEST_IDS.SLOT, TEST_IDS.VEHICLE);
      // Should not validate slot integrity when slot is deleted
      expect(mockValidationService.validateSlotIntegrity).not.toHaveBeenCalled();
      expect(result.slotDeleted).toBe(true);
      expect(result.scheduleSlot).toBeNull();
    });
  });

  describe('getScheduleSlotDetails', () => {
    it('should return detailed schedule slot information', async () => {
      const mockSlotWithDetails = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          {
            id: 'cltestassign1234567890123',
            createdAt: new Date(),
            scheduleSlotId: TEST_IDS.SLOT,
            vehicleId: TEST_IDS.VEHICLE,
            driverId: TEST_IDS.DRIVER as string | null,
        seatOverride: null,
            vehicle: { id: TEST_IDS.VEHICLE, name: 'Bus 1', capacity: 20, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() },
            driver: { id: TEST_IDS.DRIVER, name: 'John Doe' },
          },
        ],
        childAssignments: [
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { id: TEST_IDS.CHILD, name: 'Alice', age: 8, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() }, 
          },
        ],
      };

      mockRepository.findById.mockResolvedValue(mockSlotWithDetails);

      const result = await scheduleSlotService.getScheduleSlotDetails(TEST_IDS.SLOT);

      expect(mockRepository.findById).toHaveBeenCalledWith(TEST_IDS.SLOT);
      expect(result).toBeDefined();
      expect(result!.totalCapacity).toBe(20);
      expect(result!.availableSeats).toBe(19); // 20 - 1 child
      expect(result!.vehicleAssignments).toHaveLength(1);
      expect(result!.childAssignments).toHaveLength(1);
      expect(result!.childAssignments[0].vehicleAssignmentId).toBe('cltestassign1234567890123');
    });

    it('should return all valid child assignments with vehicleAssignmentId', async () => {
      const mockSlotWithValidAssignments = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          {
            id: 'cltestassign1234567890123',
            createdAt: new Date(),
            scheduleSlotId: TEST_IDS.SLOT,
            vehicleId: TEST_IDS.VEHICLE,
            driverId: TEST_IDS.DRIVER as string | null,
        seatOverride: null,
            vehicle: { id: TEST_IDS.VEHICLE, name: 'Bus 1', capacity: 20, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() },
            driver: { id: TEST_IDS.DRIVER, name: 'John Doe' },
          },
        ],
        childAssignments: [
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { id: TEST_IDS.CHILD, name: 'Alice', age: 8, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() }, 
          },
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD_2,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { id: TEST_IDS.CHILD_2, name: 'Bob', age: 10, familyId: TEST_IDS.FAMILY_2, createdAt: new Date(), updatedAt: new Date() }, 
          },
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD_3,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { id: TEST_IDS.CHILD_3, name: 'Charlie', age: 12, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() }, 
          },
        ],
      };

      mockRepository.findById.mockResolvedValue(mockSlotWithValidAssignments);

      const result = await scheduleSlotService.getScheduleSlotDetails(TEST_IDS.SLOT);

      expect(result).toBeDefined();
      expect(result!.childAssignments).toHaveLength(3); // All valid assignments
      expect(result!.childAssignments.every(ca => ca.vehicleAssignmentId)).toBe(true);
    });

    it('should include vehicleAssignmentId in child assignments for proper vehicle filtering', async () => {
      const mockSlotWithMultipleVehicles = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          {
            id: 'cltestassign1234567890123',
            createdAt: new Date(),
            scheduleSlotId: TEST_IDS.SLOT,
            vehicleId: TEST_IDS.VEHICLE,
            driverId: TEST_IDS.DRIVER as string | null,
        seatOverride: null,
            vehicle: { id: TEST_IDS.VEHICLE, name: 'Bus 1', capacity: 10, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() },
            driver: { id: TEST_IDS.DRIVER, name: 'John Doe' },
          },
          {
            id: 'cltestassign21234567890123',
            createdAt: new Date(),
            scheduleSlotId: TEST_IDS.SLOT,
            vehicleId: TEST_IDS.VEHICLE_2,
            driverId: 'cltestdriver212345678901234',
        seatOverride: null,
            vehicle: { id: TEST_IDS.VEHICLE_2, name: 'Bus 2', capacity: 15, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() },
            driver: { id: 'cltestdriver212345678901234', name: 'Jane Smith' },
          },
        ],
        childAssignments: [
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { id: TEST_IDS.CHILD, name: 'Alice', age: 8, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() }, 
          },
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD_2,
            vehicleAssignmentId: 'cltestassign21234567890123',
            assignedAt: new Date(),
            child: { id: TEST_IDS.CHILD_2, name: 'Bob', age: 10, familyId: TEST_IDS.FAMILY_2, createdAt: new Date(), updatedAt: new Date() }, 
          },
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD_3,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { id: TEST_IDS.CHILD_3, name: 'Charlie', age: 12, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() }, 
          },
        ],
      };

      mockRepository.findById.mockResolvedValue(mockSlotWithMultipleVehicles);

      const result = await scheduleSlotService.getScheduleSlotDetails(TEST_IDS.SLOT);

      expect(result).toBeDefined();
      expect(result!.childAssignments).toHaveLength(3);
      
      // Check vehicle assignment IDs are properly included
      const childrenInVehicle1 = result!.childAssignments.filter(ca => ca.vehicleAssignmentId === 'cltestassign1234567890123');
      const childrenInVehicle2 = result!.childAssignments.filter(ca => ca.vehicleAssignmentId === 'cltestassign21234567890123');
      
      expect(childrenInVehicle1).toHaveLength(2); // Alice and Charlie
      expect(childrenInVehicle2).toHaveLength(1); // Bob
      
      expect(childrenInVehicle1.filter(c => c.child).map(c => c.child!.name)).toEqual(['Alice', 'Charlie']);
      expect(childrenInVehicle2.filter(c => c.child).map(c => c.child!.name)).toEqual(['Bob']);
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
        id: TEST_IDS.GROUP,
        timezone: 'Europe/Paris',
      });

      mockRepository.getWeeklyScheduleByDateRange.mockResolvedValue(mockSlots);
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);

      const startDate = '2024-01-01T00:00:00.000Z';
      const endDate = '2024-01-07T23:59:59.999Z';
      const result = await scheduleSlotService.getSchedule(TEST_IDS.GROUP, startDate, endDate);

      expect(mockRepository.getWeeklyScheduleByDateRange).toHaveBeenCalledWith(TEST_IDS.GROUP, expect.any(Date), expect.any(Date));
      expect(result.startDate).toBe(startDate);
      expect(result.endDate).toBe(endDate);
      expect(result.groupId).toBe(TEST_IDS.GROUP);
      expect(result.scheduleSlots).toHaveLength(1);
    });

    it('should process slots and include vehicleAssignmentId in child assignments', async () => {
      const mockSlotWithAssignments = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          {
            id: 'cltestassign1234567890123',
            createdAt: new Date(),
            scheduleSlotId: TEST_IDS.SLOT,
            vehicleId: TEST_IDS.VEHICLE,
            driverId: TEST_IDS.DRIVER as string | null,
        seatOverride: null,
            vehicle: { id: TEST_IDS.VEHICLE, name: 'Bus 1', capacity: 20, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() },
            driver: { id: TEST_IDS.DRIVER, name: 'John Doe' },
          },
        ],
        childAssignments: [
          {
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { id: TEST_IDS.CHILD, name: 'Alice', age: 8, familyId: TEST_IDS.FAMILY, createdAt: new Date(), updatedAt: new Date() },
          },
        ],
      };

      // Mock group lookup for timezone
      (mockPrisma.group.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_IDS.GROUP,
        timezone: 'Europe/Paris',
      });

      mockRepository.getWeeklyScheduleByDateRange.mockResolvedValue([mockSlotWithAssignments]);
      mockRepository.findById.mockResolvedValue(mockSlotWithAssignments);

      const result = await scheduleSlotService.getSchedule(TEST_IDS.GROUP, '2024-01-01T00:00:00.000Z', '2024-01-07T23:59:59.999Z');

      expect(result.scheduleSlots).toHaveLength(1);
      expect(result.scheduleSlots[0].childAssignments).toHaveLength(1);
      expect(result.scheduleSlots[0].childAssignments[0].vehicleAssignmentId).toBe('cltestassign1234567890123');
      expect(result.scheduleSlots[0].childAssignments[0].child.name).toBe('Alice');
    });
  });

  describe('validateSlotConflicts', () => {
    it('should detect capacity conflicts', async () => {
      const mockSlotWithConflict = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          { 
            id: 'cltestassign1234567890123',
            createdAt: new Date(),
            scheduleSlotId: TEST_IDS.SLOT,
            vehicleId: TEST_IDS.VEHICLE,
            driverId: null,
        seatOverride: null,
            vehicle: { 
              id: TEST_IDS.VEHICLE,
              name: 'Bus 1',
              capacity: 2, 
            },
            driver: null,
          },
        ],
        childAssignments: [
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { 
              id: TEST_IDS.CHILD,
              name: 'Child 1',
              familyId: TEST_IDS.FAMILY,
            }, 
          },
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD_2,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { 
              id: TEST_IDS.CHILD_2,
              name: 'Child 2',
              familyId: TEST_IDS.FAMILY_2,
            }, 
          },
          { 
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD_3,
            vehicleAssignmentId: 'cltestassign1234567890123',
            assignedAt: new Date(),
            child: { 
              id: TEST_IDS.CHILD_3,
              name: 'Child 3',
              userId: TEST_IDS.USER_3,
            }, 
          }, // More children than capacity
        ],
      };

      mockRepository.findById.mockResolvedValue(mockSlotWithConflict);

      const conflicts = await scheduleSlotService.validateSlotConflicts(TEST_IDS.SLOT);

      expect(conflicts).toContain('CAPACITY_EXCEEDED');
    });

    it('should detect driver double booking', async () => {
      const mockSlotWithDriver = {
        ...mockScheduleSlot,
        vehicleAssignments: [
          { 
            id: 'cltestassign1234567890123',
            createdAt: new Date(),
            scheduleSlotId: TEST_IDS.SLOT,
            vehicleId: TEST_IDS.VEHICLE,
            driverId: TEST_IDS.DRIVER as string | null,
        seatOverride: null,
            vehicle: { 
              id: TEST_IDS.VEHICLE,
              name: 'Bus 1',
              capacity: 30, 
            },
            driver: { 
              id: TEST_IDS.DRIVER,
              name: 'John Doe',
            },
          },
        ],
      };

      const conflictingSlots = [
        { 
          id: TEST_IDS.SLOT,
          groupId: TEST_IDS.GROUP,
          datetime: new Date('2050-01-08T08:00:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          vehicleAssignments: [
            {
              id: 'cltestassign1234567890123',
              createdAt: new Date(),
              scheduleSlotId: TEST_IDS.SLOT,
              vehicleId: TEST_IDS.VEHICLE,
              driverId: TEST_IDS.DRIVER as string | null,
        seatOverride: null,
              vehicle: { 
                id: TEST_IDS.VEHICLE,
                name: 'Bus 1',
              },
            },
          ],
          childAssignments: [],
        },
        { 
          id: TEST_IDS.SLOT_2,
          groupId: TEST_IDS.GROUP,
          datetime: new Date('2050-01-08T08:00:00.000Z'),
          createdAt: new Date(),
          updatedAt: new Date(),
          vehicleAssignments: [
            {
              id: 'cltestassign21234567890123',
              createdAt: new Date(),
              scheduleSlotId: TEST_IDS.SLOT_2,
              vehicleId: TEST_IDS.VEHICLE_2,
              driverId: TEST_IDS.DRIVER as string | null,
        seatOverride: null,
              vehicle: { 
                id: TEST_IDS.VEHICLE_2,
                name: 'Bus 2',
              },
            },
          ],
          childAssignments: [],
        }, // Two slots with same driver
      ];

      mockRepository.findById.mockResolvedValue(mockSlotWithDriver);
      mockRepository.findConflictingSlotsForParentByDateTime.mockResolvedValue(conflictingSlots);

      const conflicts = await scheduleSlotService.validateSlotConflicts(TEST_IDS.SLOT);

      expect(conflicts).toContain('DRIVER_DOUBLE_BOOKING');
    });
  });

  describe('updateSeatOverride', () => {
    it('should update seat override successfully', async () => {
      const mockVehicleAssignment = {
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: null,
        seatOverride: 15,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: null,
      };

      const updateData = {
        vehicleAssignmentId: 'cltestassign1234567890123',
        seatOverride: 15,
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.updateSeatOverride.mockResolvedValue(mockVehicleAssignment);
      mockRepository.findVehicleAssignmentById.mockResolvedValue(mockVehicleAssignment);

      const result = await scheduleSlotService.updateSeatOverride(updateData);

      expect(mockValidationService.validateSeatOverride).toHaveBeenCalledWith(15);
      expect(mockRepository.updateSeatOverride).toHaveBeenCalledWith('cltestassign1234567890123', 15);
      expect(mockValidationService.validateSlotIntegrity).toHaveBeenCalledWith(TEST_IDS.SLOT);
      expect(result).toEqual(mockVehicleAssignment);
    });

    it('should clear seat override when undefined is passed', async () => {
      const mockVehicleAssignment = {
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: null,
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: null,
      };

      const updateData: { vehicleAssignmentId: string, seatOverride?: number } = {
        vehicleAssignmentId: 'cltestassign1234567890123',
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.updateSeatOverride.mockResolvedValue(mockVehicleAssignment);
      mockRepository.findVehicleAssignmentById.mockResolvedValue(mockVehicleAssignment);

      const result = await scheduleSlotService.updateSeatOverride(updateData);

      expect(mockValidationService.validateSeatOverride).not.toHaveBeenCalled();
      expect(mockRepository.updateSeatOverride).toHaveBeenCalledWith('cltestassign1234567890123', undefined);
      expect(result).toEqual(mockVehicleAssignment);
    });

    it('should not validate seat override if undefined', async () => {
      const mockVehicleAssignment = {
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: null,
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: null,
      };

      const updateData = {
        vehicleAssignmentId: 'cltestassign1234567890123',
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.updateSeatOverride.mockResolvedValue(mockVehicleAssignment);
      mockRepository.findVehicleAssignmentById.mockResolvedValue(mockVehicleAssignment);

      await scheduleSlotService.updateSeatOverride(updateData);

      expect(mockValidationService.validateSeatOverride).not.toHaveBeenCalled();
    });

    it('should send notification when seat override is updated', async () => {
      const mockVehicleAssignment = {
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: null,
        seatOverride: 15,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: null,
      };

      const updateData = {
        vehicleAssignmentId: 'cltestassign1234567890123',
        seatOverride: 15,
      };

      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockRepository.updateSeatOverride.mockResolvedValue(mockVehicleAssignment);
      mockRepository.findVehicleAssignmentById.mockResolvedValue(mockVehicleAssignment);

      await scheduleSlotService.updateSeatOverride(updateData);

      expect(mockNotificationService.notifyScheduleSlotChange).toHaveBeenCalledWith(TEST_IDS.SLOT, 'SEAT_OVERRIDE_UPDATED');
    });
  });

  describe('assignVehicleToSlot with seat override', () => {
    it('should pass seat override to repository when assigning vehicle', async () => {
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
        seatOverride: 15,
      };

      const mockResult = { 
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
        seatOverride: 15,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: TEST_IDS.DRIVER,
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
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith(TEST_IDS.SLOT, TEST_IDS.VEHICLE, TEST_IDS.DRIVER, 15);
      expect(result).toEqual(mockResult);
    });

    it('should not validate seat override if not provided', async () => {
      const assignmentData: AssignVehicleToSlotData = {
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
      };

      const mockResult = { 
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: TEST_IDS.DRIVER,
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
      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith(TEST_IDS.SLOT, TEST_IDS.VEHICLE, TEST_IDS.DRIVER, undefined);
    });
  });

  describe('createScheduleSlotWithVehicle with seat override', () => {
    it('should pass seat override to assignVehicleToSlot when creating slot', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: TEST_IDS.GROUP,
        datetime: '2050-01-08T08:00:00.000Z',
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_IDS.USER,
        timezone: 'Europe/Paris',
      });

      mockRepository.create.mockResolvedValue(mockScheduleSlot);
      mockRepository.assignVehicleToSlot.mockResolvedValue({
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
        seatOverride: 15,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: TEST_IDS.DRIVER,
          name: 'John Doe',
        },
      });
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockValidationService.validateScheduleTime.mockResolvedValue(undefined);

      await scheduleSlotService.createScheduleSlotWithVehicle(slotData, TEST_IDS.VEHICLE, TEST_IDS.USER, TEST_IDS.DRIVER, 15);

      expect(mockRepository.assignVehicleToSlot).toHaveBeenCalledWith(TEST_IDS.SLOT, TEST_IDS.VEHICLE, TEST_IDS.DRIVER, 15);
    });
  });

  describe('validateScheduleTime integration', () => {
    it('should call validateScheduleTime when creating a schedule slot', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: TEST_IDS.GROUP,
        datetime: '2050-01-13T07:30:00.000Z', // Monday, 07:30 UTC
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_IDS.USER,
        timezone: 'UTC',
      });

      mockRepository.create.mockResolvedValue(mockScheduleSlot);
      mockRepository.assignVehicleToSlot.mockResolvedValue({
        id: 'cltestassign1234567890123',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.DRIVER,
        seatOverride: null,
        createdAt: new Date(),
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
        },
        driver: {
          id: TEST_IDS.DRIVER,
          name: 'John Doe',
        },
      });
      mockRepository.findById.mockResolvedValue(mockScheduleSlot);
      mockValidationService.validateScheduleTime.mockResolvedValue(undefined);

      await scheduleSlotService.createScheduleSlotWithVehicle(slotData, TEST_IDS.VEHICLE, TEST_IDS.USER, TEST_IDS.DRIVER);

      expect(mockValidationService.validateScheduleTime).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        new Date('2050-01-13T07:30:00.000Z'),
        'UTC',
      );
      expect(mockRepository.create).toHaveBeenCalledWith(slotData);
    });

    it('should reject slot creation when time is not configured', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: TEST_IDS.GROUP,
        datetime: '2050-01-13T05:30:00.000Z', // Invalid time
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_IDS.USER,
        timezone: 'Europe/Paris',
      });

      mockValidationService.validateScheduleTime.mockRejectedValue(
        new Error('Time 05:30 is not configured for MONDAY in this group'),
      );

      await expect(
        scheduleSlotService.createScheduleSlotWithVehicle(slotData, TEST_IDS.VEHICLE, TEST_IDS.USER, TEST_IDS.DRIVER),
      ).rejects.toThrow('Time 05:30 is not configured for MONDAY in this group');

      expect(mockValidationService.validateScheduleTime).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        new Date('2050-01-13T05:30:00.000Z'),
        'Europe/Paris',
      );
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('should reject slot creation when group has no schedule config', async () => {
      const slotData: CreateScheduleSlotData = {
        groupId: TEST_IDS.GROUP,
        datetime: '2050-01-13T07:30:00.000Z',
      };

      // Mock user lookup
      (mockPrisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: TEST_IDS.USER,
        timezone: 'Europe/Paris',
      });

      mockValidationService.validateScheduleTime.mockRejectedValue(
        new Error('Group has no schedule configuration'),
      );

      await expect(
        scheduleSlotService.createScheduleSlotWithVehicle(slotData, TEST_IDS.VEHICLE, TEST_IDS.USER, TEST_IDS.DRIVER),
      ).rejects.toThrow('Group has no schedule configuration');

      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });
});