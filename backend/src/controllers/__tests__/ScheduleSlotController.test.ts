import { Request, Response } from 'express';
import { ScheduleSlotController } from '../ScheduleSlotController';
import { ScheduleSlotService } from '../../services/ScheduleSlotService';
import { ChildAssignmentService } from '../../services/ChildAssignmentService';
import { createError } from '../../middleware/errorHandler';
import { ScheduleSlotWithDetails } from '../../types';
import { SocketEmitter } from '../../utils/socketEmitter';
import { TEST_IDS } from '../../utils/testHelpers';

// Mock dependencies
jest.mock('../../services/ScheduleSlotService');
jest.mock('../../services/ChildAssignmentService');
jest.mock('../../middleware/errorHandler');
jest.mock('../../utils/socketEmitter');

describe('ScheduleSlotController', () => {
  let controller: ScheduleSlotController;
  let mockService: jest.Mocked<ScheduleSlotService>;
  let mockChildAssignmentService: jest.Mocked<ChildAssignmentService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockSocketEmitter: jest.Mocked<typeof SocketEmitter>;
  let capturedJsonData: any = null;

  const mockScheduleSlot = {
    id: TEST_IDS.SLOT,
    groupId: TEST_IDS.GROUP,
    datetime: new Date('2024-01-08T08:00:00.000Z'),
    vehicleAssignments: [{
      id: 'cltestvlassignment1234567890',
      vehicleId: TEST_IDS.VEHICLE,
      scheduleSlotId: TEST_IDS.SLOT,
      driverId: TEST_IDS.USER,
      groupId: TEST_IDS.GROUP,
      date: '2024-01-01',
      assignedSeats: 0,
      seatOverride: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      vehicle: {
        id: TEST_IDS.VEHICLE,
        name: 'Unknown Vehicle',
        capacity: 30,
        familyId: TEST_IDS.FAMILY,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      driver: {
        id: TEST_IDS.USER,
        firstName: 'John',
        lastName: 'Doe',
        email: 'driver@example.com',
      },
    }],
    childAssignments: [],
    totalCapacity: 30,
    availableSeats: 30,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock createError to throw an error
    (createError as jest.Mock).mockImplementation((message, code) => {
      const error = new Error(message);
      (error as any).statusCode = code;
      throw error;
    });

    // Mock SocketEmitter
    mockSocketEmitter = SocketEmitter as jest.Mocked<typeof SocketEmitter>;
    mockSocketEmitter.broadcastScheduleSlotCreated = jest.fn();
    mockSocketEmitter.broadcastScheduleSlotUpdate = jest.fn();
    mockSocketEmitter.broadcastScheduleSlotDeleted = jest.fn();
    mockSocketEmitter.broadcastScheduleUpdate = jest.fn();

    mockService = {
      createScheduleSlotWithVehicle: jest.fn(),
      assignVehicleToSlot: jest.fn(),
      removeVehicleFromSlot: jest.fn(),
      updateVehicleDriver: jest.fn(),
      assignChildToSlot: jest.fn(),
      removeChildFromSlot: jest.fn(),
      getScheduleSlotDetails: jest.fn(),
      getSchedule: jest.fn(),
      validateSlotConflicts: jest.fn(),
      updateSeatOverride: jest.fn(),
    } as any;

    mockChildAssignmentService = {
      addChildToGroup: jest.fn(),
      removeChildFromGroup: jest.fn(),
      assignChildToScheduleSlot: jest.fn(),
      removeChildFromScheduleSlot: jest.fn(),
      getAvailableChildrenForScheduleSlot: jest.fn(),
      getChildGroupMemberships: jest.fn(),
    } as any;

    controller = new ScheduleSlotController(mockService, mockChildAssignmentService);

    mockRequest = {
      params: {},
      body: {},
      query: {},
      userId: 'test-user-id',  // Add userId for authenticated requests
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn((data) => {
        capturedJsonData = data;
        return data;
      }),
    };
  });

  describe('createScheduleSlotWithVehicle', () => {
    it('should create schedule slot with vehicle using datetime payload', async () => {
      mockRequest.params = { groupId: TEST_IDS.GROUP };
      mockRequest.body = {
        datetime: '2024-01-08T08:00:00.000Z', // Monday of week 2024-01 at 08:00
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.USER,
      };

      mockService.createScheduleSlotWithVehicle.mockResolvedValue(mockScheduleSlot);

      await controller.createScheduleSlotWithVehicle(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockService.createScheduleSlotWithVehicle).toHaveBeenCalledWith(
        {
          groupId: TEST_IDS.GROUP,
          datetime: '2024-01-08T08:00:00.000Z',
        },
        TEST_IDS.VEHICLE,
        'test-user-id',
        TEST_IDS.USER,
        undefined,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(capturedJsonData).toEqual({
        success: true,
        data: expect.objectContaining({
          id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        vehicleAssignments: expect.arrayContaining([
          expect.objectContaining({
            id: 'cltestvlassignment1234567890',
            vehicle: expect.objectContaining({
              id: TEST_IDS.VEHICLE,
              capacity: 30,
            }),
            driver: expect.objectContaining({
              id: TEST_IDS.USER,
            }),
          }),
        ]),
        }),
      });

      // Verify WebSocket emissions
      expect(mockSocketEmitter.broadcastScheduleSlotCreated).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        TEST_IDS.SLOT,
        mockScheduleSlot,
      );
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith(TEST_IDS.GROUP);
    });

    it('should throw error if vehicleId is missing', async () => {
      mockRequest.params = { groupId: TEST_IDS.GROUP };
      mockRequest.body = {
        datetime: '2024-01-08T08:00:00.000Z',
        // vehicleId missing
      };

      await expect(
        controller.createScheduleSlotWithVehicle(
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).rejects.toThrow();

      expect(createError).toHaveBeenCalledWith(
        'Vehicle ID is required to create a schedule slot',
        400,
      );
    });

    it('should handle service errors', async () => {
      mockRequest.params = { groupId: TEST_IDS.GROUP };
      mockRequest.body = {
        datetime: '2024-01-08T08:00:00.000Z',
        vehicleId: TEST_IDS.VEHICLE,
      };

      const error = new Error('Slot already exists');
      mockService.createScheduleSlotWithVehicle.mockRejectedValue(error);

      await expect(
        controller.createScheduleSlotWithVehicle(
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).rejects.toThrow();

      // The error message has been updated to match the new API error handling
      expect(createError).toHaveBeenCalled();
    });
  });

  describe('assignVehicleToSlot', () => {
    it('should assign vehicle to slot successfully', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT };
      mockRequest.body = {
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.USER,
      };

      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockAssignment = {
        id: 'cltestvlassignment1234567890',
        vehicleId: TEST_IDS.VEHICLE,
        scheduleSlotId: TEST_IDS.SLOT,
        driverId: TEST_IDS.USER,
        groupId: TEST_IDS.GROUP,
        date: '2024-01-01',
        assignedSeats: 0,
        seatOverride: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Unknown Vehicle',
          capacity: 30,
          familyId: TEST_IDS.FAMILY,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        driver: {
          id: TEST_IDS.USER,
          firstName: 'John',
          lastName: 'Doe',
          email: 'driver@example.com',
        },
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockService.assignVehicleToSlot.mockResolvedValue(mockAssignment);

      await controller.assignVehicleToSlot(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockService.assignVehicleToSlot).toHaveBeenCalledWith({
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.USER,
        seatOverride: undefined,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(capturedJsonData).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'cltestvlassignment1234567890',
          vehicle: expect.objectContaining({
            id: TEST_IDS.VEHICLE,
            capacity: 30,
          }),
          driver: expect.objectContaining({
            id: TEST_IDS.USER,
          }),
        }),
      });

      // Verify WebSocket emissions
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        TEST_IDS.SLOT,
        mockAssignment,
      );
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith(TEST_IDS.GROUP);
    });

    it('should throw error if vehicleId is missing', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT };
      mockRequest.body = {}; // vehicleId missing

      await expect(
        controller.assignVehicleToSlot(
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).rejects.toThrow();

      expect(createError).toHaveBeenCalledWith('Vehicle ID is required', 400);
    });
  });

  describe('removeVehicleFromSlot', () => {
    it('should remove vehicle from slot successfully', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT };
      mockRequest.body = { vehicleId: TEST_IDS.VEHICLE };

      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResult = {
        vehicleAssignment: {
          id: 'cltestvlassignment1234567890',
          scheduleSlotId: TEST_IDS.SLOT,
          vehicleId: TEST_IDS.VEHICLE,
          driverId: null,
          seatOverride: expect.any(Number),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          vehicle: {
            id: TEST_IDS.VEHICLE,
            name: 'Bus 1',
            capacity: 30,
            familyId: TEST_IDS.FAMILY,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          driver: null,
        },
        slotDeleted: false,
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockService.removeVehicleFromSlot.mockResolvedValue(mockResult);

      await controller.removeVehicleFromSlot(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockService.removeVehicleFromSlot).toHaveBeenCalledWith(TEST_IDS.SLOT, TEST_IDS.VEHICLE);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(capturedJsonData).toEqual({
        success: true,
        data: {
          message: 'Vehicle removed successfully',
          slotDeleted: false,
        },
      });

      // Verify WebSocket emissions (slot not deleted)
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        TEST_IDS.SLOT,
        mockResult,
      );
      expect(mockSocketEmitter.broadcastScheduleSlotDeleted).not.toHaveBeenCalled();
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith(TEST_IDS.GROUP);
    });

    it('should handle slot deletion when removing last vehicle', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT };
      mockRequest.body = { vehicleId: TEST_IDS.VEHICLE };

      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResult = {
        vehicleAssignment: {
          id: 'cltestvlassignment1234567890',
          scheduleSlotId: TEST_IDS.SLOT,
          vehicleId: TEST_IDS.VEHICLE,
          driverId: null,
          seatOverride: expect.any(Number),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          vehicle: {
            id: TEST_IDS.VEHICLE,
            name: 'Bus 1',
            capacity: 30,
            familyId: TEST_IDS.FAMILY,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          driver: null,
        },
        slotDeleted: true,
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockService.removeVehicleFromSlot.mockResolvedValue(mockResult);

      await controller.removeVehicleFromSlot(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(capturedJsonData).toEqual({
        success: true,
        data: {
          message: 'Vehicle removed successfully',
          slotDeleted: true,
        },
      });

      // Verify WebSocket emissions (slot deleted)
      expect(mockSocketEmitter.broadcastScheduleSlotDeleted).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        TEST_IDS.SLOT,
      );
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).not.toHaveBeenCalled();
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith(TEST_IDS.GROUP);
    });
  });

  describe('getScheduleSlotDetails', () => {
    it('should return schedule slot details', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT };

      const mockSlotWithDetails: ScheduleSlotWithDetails = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-08T08:00:00.000Z'),
        vehicleAssignments: [{
          id: 'cltestvlassignment1234567890',
          vehicle: {
            id: TEST_IDS.VEHICLE,
            name: 'Bus 1',
            capacity: 30,
            familyId: TEST_IDS.FAMILY,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          driver: {
            id: TEST_IDS.USER,
            name: 'John Doe',
          },
        }],
        childAssignments: [],
        totalCapacity: 30,
        availableSeats: 30,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockSlotWithDetails);

      await controller.getScheduleSlotDetails(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockService.getScheduleSlotDetails).toHaveBeenCalledWith(TEST_IDS.SLOT);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(capturedJsonData.success).toBe(true);
      expect(capturedJsonData.data.id).toBe(TEST_IDS.SLOT);
      expect(capturedJsonData.data.groupId).toBe(TEST_IDS.GROUP);
      expect(capturedJsonData.data.vehicleAssignments).toHaveLength(1);
      expect(capturedJsonData.data.vehicleAssignments[0].id).toBe('cltestvlassignment1234567890');
      expect(capturedJsonData.data.vehicleAssignments[0].vehicle.id).toBe(TEST_IDS.VEHICLE);
      expect(capturedJsonData.data.vehicleAssignments[0].driver.id).toBe(TEST_IDS.USER);
    });

    it('should throw error if slot not found', async () => {
      mockRequest.params = { scheduleSlotId: 'non-existent' };

      mockService.getScheduleSlotDetails.mockResolvedValue(null);

      await expect(
        controller.getScheduleSlotDetails(
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).rejects.toThrow();

      expect(createError).toHaveBeenCalledWith('Schedule slot not found', 404);
    });
  });

  describe('getSchedule', () => {
    it('should return schedule with date range', async () => {
      mockRequest.params = { groupId: TEST_IDS.GROUP };
      mockRequest.query = { 
        startDate: '2024-01-01T00:00:00.000Z', 
        endDate: '2024-01-07T23:59:59.999Z', 
      };

      const mockSlotWithDetails: ScheduleSlotWithDetails = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-08T08:00:00.000Z'),
        vehicleAssignments: [{
          id: 'cltestvlassignment1234567890',
          vehicle: {
            id: TEST_IDS.VEHICLE,
            name: 'Bus 1',
            capacity: 30,
            familyId: TEST_IDS.FAMILY,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
          driver: {
            id: TEST_IDS.USER,
            name: 'John Doe',
          },
        }],
        childAssignments: [],
        totalCapacity: 30,
        availableSeats: 30,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockSchedule = {
        groupId: TEST_IDS.GROUP,
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-07T23:59:59.999Z',
        scheduleSlots: [mockSlotWithDetails],
      } as { groupId: string; startDate: string; endDate: string; scheduleSlots: ScheduleSlotWithDetails[] };

      mockService.getSchedule.mockResolvedValue(mockSchedule as any);

      await controller.getSchedule(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockService.getSchedule).toHaveBeenCalledWith(TEST_IDS.GROUP, '2024-01-01T00:00:00.000Z', '2024-01-07T23:59:59.999Z');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(capturedJsonData.success).toBe(true);
      expect(capturedJsonData.data.groupId).toBe(mockSchedule.groupId);
      expect(capturedJsonData.data.startDate).toBe(mockSchedule.startDate);
      expect(capturedJsonData.data.endDate).toBe(mockSchedule.endDate);
      expect(capturedJsonData.data.scheduleSlots).toHaveLength(1);
      expect(capturedJsonData.data.scheduleSlots[0].id).toBe(TEST_IDS.SLOT);
    });

    it('should handle missing date parameters by using defaults', async () => {
      mockRequest.params = { groupId: TEST_IDS.GROUP };
      mockRequest.query = {}; // no date parameters

      const mockSchedule = {
        groupId: TEST_IDS.GROUP,
        startDate: '2024-06-24T00:00:00.000Z',
        endDate: '2024-06-30T23:59:59.999Z',
        scheduleSlots: [],
      };

      mockService.getSchedule.mockResolvedValue(mockSchedule);

      await controller.getSchedule(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockService.getSchedule).toHaveBeenCalledWith(TEST_IDS.GROUP, undefined, undefined);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(capturedJsonData).toEqual({
        success: true,
        data: mockSchedule,
      });
    });
  });

  describe('assignChildToSlot', () => {
    it('should assign child to slot successfully', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT };
      mockRequest.body = { childId: TEST_IDS.CHILD, vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT };

      const mockAssignment = {
        id: 'cltestassignment123456789012345',
        scheduleSlotId: TEST_IDS.SLOT,
        childId: TEST_IDS.CHILD,
        vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT,
        assignedAt: '2024-01-01T00:00:00.000Z',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        child: {
          id: TEST_IDS.CHILD,
          firstName: 'Test',
          lastName: 'Child',
          dateOfBirth: '2016-01-01T00:00:00.000Z',
          familyId: TEST_IDS.FAMILY,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        scheduleSlot: {
          id: TEST_IDS.SLOT,
          groupId: TEST_IDS.GROUP,
          datetime: new Date('2024-01-08T08:00:00.000Z'),
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
        vehicleAssignment: {
          id: TEST_IDS.VEHICLE_ASSIGNMENT,
          vehicleId: TEST_IDS.VEHICLE,
          scheduleSlotId: TEST_IDS.SLOT,
          driverId: TEST_IDS.USER,
          groupId: TEST_IDS.GROUP,
          vehicle: {
            id: TEST_IDS.VEHICLE,
            name: 'Test Vehicle',
            capacity: 30,
            familyId: TEST_IDS.FAMILY,
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        },
      };

      mockChildAssignmentService.assignChildToScheduleSlot.mockResolvedValue(mockAssignment as any);
      mockService.getScheduleSlotDetails.mockResolvedValue({
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-08T08:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
      } as any);

      await controller.assignChildToScheduleSlot(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockChildAssignmentService.assignChildToScheduleSlot).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        TEST_IDS.CHILD,
        TEST_IDS.VEHICLE_ASSIGNMENT,
        'test-user-id'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(capturedJsonData.success).toBe(true);
      expect(capturedJsonData.data.id).toBe(mockAssignment.id);
      expect(capturedJsonData.data.childId).toBe(mockAssignment.childId);
      expect(capturedJsonData.data.child.firstName).toBe(mockAssignment.child.firstName);
    });

    it('should throw error if childId is missing', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT };
      mockRequest.body = { vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT }; // childId missing

      await expect(
        controller.assignChildToScheduleSlot(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow();

      expect(createError).toHaveBeenCalledWith('Child ID is required', 400);
    });
  });

  describe('getScheduleSlotConflicts', () => {
    it('should return schedule slot conflicts', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT };

      const mockConflicts = ['CAPACITY_EXCEEDED', 'DRIVER_DOUBLE_BOOKING'];

      mockService.validateSlotConflicts.mockResolvedValue(mockConflicts);

      await controller.getScheduleSlotConflicts(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockService.validateSlotConflicts).toHaveBeenCalledWith(TEST_IDS.SLOT);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(capturedJsonData).toEqual({
        success: true,
        data: { conflicts: mockConflicts },
      });
    });
  });

  // ❌ RED: TDD tests for past-time validation (should fail initially)
  describe('updateSeatOverride - Past Time Validation', () => {
    it('should reject seat override updates for past schedule slots', async () => {
      mockRequest.params = { vehicleAssignmentId: 'cltestvlassignment1234567890' };
      mockRequest.body = { seatOverride: 25 };

      // Mock service to return slot in the past
      mockService.updateSeatOverride = jest.fn().mockRejectedValue(
        new Error('Cannot modify schedule slots in the past'),
      );

      await expect(
        controller.updateSeatOverride(
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).rejects.toThrow('Cannot modify schedule slots in the past');
    });

    it('should allow seat override updates for future schedule slots', async () => {
      mockRequest.params = { vehicleAssignmentId: 'cltestvlassignment1234567890' };
      mockRequest.body = { seatOverride: 25 };

      const mockResult = {
        id: 'cltestvlassignment1234567890',
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.USER,
        seatOverride: 25,
        createdAt: '2024-01-01T00:00:00.000Z',
        vehicle: {
          id: TEST_IDS.VEHICLE,
          name: 'Bus 1',
          capacity: 30,
          familyId: TEST_IDS.FAMILY,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        driver: {
          id: TEST_IDS.USER,
          name: 'John Doe',
        },
      };

      mockService.updateSeatOverride = jest.fn().mockResolvedValue(mockResult);

      await controller.updateSeatOverride(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockService.updateSeatOverride).toHaveBeenCalledWith({
        vehicleAssignmentId: 'cltestvlassignment1234567890',
        seatOverride: 25,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(capturedJsonData.success).toBe(true);
      expect(capturedJsonData.data.id).toBe('cltestvlassignment1234567890');
      expect(capturedJsonData.data.seatOverride).toBe(25);
      expect(capturedJsonData.data.vehicle.id).toBe(TEST_IDS.VEHICLE);
      expect(capturedJsonData.data.vehicle.name).toBe('Bus 1');
      expect(capturedJsonData.data.driver.id).toBe(TEST_IDS.USER);
    });
  });

  describe('assignChildToScheduleSlot - Past Time Validation', () => {
    beforeEach(() => {
      // Mock authenticated request
      mockRequest = {
        params: {},
        body: {},
        query: {},
        userId: 'test-user-id', // Add userId for AuthenticatedRequest
        user: {
          id: 'test-user-id',
          email: 'test@example.com',
          name: 'Test User',
        },
      } as any;
    });

    it('should reject child assignments to past schedule slots', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT }; // Valid CUID
      mockRequest.body = {
        childId: TEST_IDS.CHILD,
        vehicleAssignmentId: TEST_IDS.VEHICLE_2,
      };

      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockChildAssignmentService = {
        assignChildToScheduleSlot: jest.fn().mockRejectedValue(
          new Error('Cannot assign children to schedule slots in the past'),
        ),
      } as any;

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      controller = new ScheduleSlotController(mockService, mockChildAssignmentService);

      await expect(
        controller.assignChildToScheduleSlot(
          mockRequest as Request,
          mockResponse as Response,
        ),
      ).rejects.toThrow('Cannot assign children to schedule slots in the past');

      expect(mockChildAssignmentService.assignChildToScheduleSlot).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        TEST_IDS.CHILD,
        TEST_IDS.VEHICLE_2,
        'test-user-id',
      );
    });

    it('should allow child assignments to future schedule slots', async () => {
      mockRequest.params = { scheduleSlotId: TEST_IDS.SLOT }; // Valid CUID
      mockRequest.body = {
        childId: TEST_IDS.CHILD,
        vehicleAssignmentId: TEST_IDS.VEHICLE_2,
      };

      const mockAssignment = {
        id: TEST_IDS.TRIP,
        scheduleSlotId: TEST_IDS.SLOT,
        childId: TEST_IDS.CHILD,
        vehicleAssignmentId: TEST_IDS.VEHICLE_2,
        assignedAt: new Date().toISOString(),
      };

      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);

      // Use the existing mockChildAssignmentService from beforeEach
      const mockChildAssignmentService = (controller as any).childAssignmentService;
      mockChildAssignmentService.assignChildToScheduleSlot = jest.fn().mockResolvedValue(mockAssignment);

      await controller.assignChildToScheduleSlot(
        mockRequest as Request,
        mockResponse as Response,
      );

      expect(mockChildAssignmentService.assignChildToScheduleSlot).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        TEST_IDS.CHILD,
        TEST_IDS.VEHICLE_2,
        'test-user-id',
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(capturedJsonData).toEqual({
        success: true,
        data: expect.objectContaining({
          id: TEST_IDS.TRIP,
          childId: TEST_IDS.CHILD,
          scheduleSlotId: TEST_IDS.SLOT,
          vehicleAssignmentId: TEST_IDS.VEHICLE_2,
          assignedAt: expect.any(String),
        }),
      });
    });
  });
});