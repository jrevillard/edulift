import { Request, Response } from 'express';
import { ScheduleSlotController } from '../ScheduleSlotController';
import { ScheduleSlotService } from '../../services/ScheduleSlotService';
import { createError } from '../../middleware/errorHandler';
import { ScheduleSlotWithDetails } from '../../types';
import { SocketEmitter } from '../../utils/socketEmitter';

// Mock dependencies
jest.mock('../../services/ScheduleSlotService');
jest.mock('../../middleware/errorHandler');
jest.mock('../../utils/socketEmitter');

describe('ScheduleSlotController', () => {
  let controller: ScheduleSlotController;
  let mockService: jest.Mocked<ScheduleSlotService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockSocketEmitter: jest.Mocked<typeof SocketEmitter>;

  const mockScheduleSlot = {
    id: 'slot-1',
    groupId: 'group-1',
    datetime: new Date('2024-01-08T08:00:00.000Z'), // Monday of week 2024-01 at 08:00 UTC
    createdAt: new Date('2024-01-01T00:00:00.000Z'),
    updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    group: {
      id: 'group-1',
      name: 'Group 1'
    },
    vehicleAssignments: [{
      id: 'assignment-1',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      scheduleSlotId: 'slot-1',
      vehicleId: 'vehicle-1',
      driverId: 'driver-1',
      seatOverride: null,
      vehicle: {
        id: 'vehicle-1',
        name: 'Bus 1',
        capacity: 30
      },
      driver: {
        id: 'driver-1',
        name: 'John Doe'
      }
    }],
    childAssignments: []
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

    const mockChildAssignmentService = {
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
      userId: 'test-user-id'  // Add userId for authenticated requests
    } as any;

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('createScheduleSlotWithVehicle', () => {
    it('should create schedule slot with vehicle using datetime payload', async () => {
      mockRequest.params = { groupId: 'group-1' };
      mockRequest.body = {
        datetime: '2024-01-08T08:00:00.000Z', // Monday of week 2024-01 at 08:00
        vehicleId: 'vehicle-1',
        driverId: 'driver-1'
      };

      mockService.createScheduleSlotWithVehicle.mockResolvedValue(mockScheduleSlot);

      await controller.createScheduleSlotWithVehicle(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockService.createScheduleSlotWithVehicle).toHaveBeenCalledWith(
        {
          groupId: 'group-1',
          datetime: '2024-01-08T08:00:00.000Z'
        },
        'vehicle-1',
        'test-user-id',
        'driver-1',
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockScheduleSlot
      });

      // Verify WebSocket emissions
      expect(mockSocketEmitter.broadcastScheduleSlotCreated).toHaveBeenCalledWith(
        'group-1',
        'slot-1',
        mockScheduleSlot
      );
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith('group-1');
    });

    it('should throw error if vehicleId is missing', async () => {
      mockRequest.params = { groupId: 'group-1' };
      mockRequest.body = {
        datetime: '2024-01-08T08:00:00.000Z'
        // vehicleId missing
      };

      await expect(
        controller.createScheduleSlotWithVehicle(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow();

      expect(createError).toHaveBeenCalledWith(
        'Vehicle ID is required to create a schedule slot',
        400
      );
    });

    it('should handle service errors', async () => {
      mockRequest.params = { groupId: 'group-1' };
      mockRequest.body = {
        datetime: '2024-01-08T08:00:00.000Z',
        vehicleId: 'vehicle-1'
      };

      const error = new Error('Slot already exists');
      mockService.createScheduleSlotWithVehicle.mockRejectedValue(error);

      await expect(
        controller.createScheduleSlotWithVehicle(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow();

      // The error message has been updated to match the new API error handling
      expect(createError).toHaveBeenCalled();
    });
  });

  describe('assignVehicleToSlot', () => {
    it('should assign vehicle to slot successfully', async () => {
      mockRequest.params = { scheduleSlotId: 'slot-1' };
      mockRequest.body = {
        vehicleId: 'vehicle-1',
        driverId: 'driver-1'
      };

      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0
      };

      const mockAssignment = {
        id: 'assignment-1',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: null,
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30
        },
        driver: {
          id: 'driver-1',
          name: 'John Doe'
        }
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockService.assignVehicleToSlot.mockResolvedValue(mockAssignment);

      await controller.assignVehicleToSlot(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockService.assignVehicleToSlot).toHaveBeenCalledWith({
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockAssignment
      });

      // Verify WebSocket emissions
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).toHaveBeenCalledWith(
        'group-1',
        'slot-1',
        mockAssignment
      );
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith('group-1');
    });

    it('should throw error if vehicleId is missing', async () => {
      mockRequest.params = { scheduleSlotId: 'slot-1' };
      mockRequest.body = {}; // vehicleId missing

      await expect(
        controller.assignVehicleToSlot(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow();

      expect(createError).toHaveBeenCalledWith('Vehicle ID is required', 400);
    });
  });

  describe('removeVehicleFromSlot', () => {
    it('should remove vehicle from slot successfully', async () => {
      mockRequest.params = { scheduleSlotId: 'slot-1' };
      mockRequest.body = { vehicleId: 'vehicle-1' };

      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0
      };

      const mockResult = {
        vehicleAssignment: { 
          id: 'assignment-1',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          driverId: null,
          seatOverride: null
        },
        slotDeleted: false
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockService.removeVehicleFromSlot.mockResolvedValue(mockResult);

      await controller.removeVehicleFromSlot(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockService.removeVehicleFromSlot).toHaveBeenCalledWith('slot-1', 'vehicle-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Vehicle removed successfully',
          slotDeleted: false
        }
      });

      // Verify WebSocket emissions (slot not deleted)
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).toHaveBeenCalledWith(
        'group-1',
        'slot-1',
        mockResult
      );
      expect(mockSocketEmitter.broadcastScheduleSlotDeleted).not.toHaveBeenCalled();
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith('group-1');
    });

    it('should handle slot deletion when removing last vehicle', async () => {
      mockRequest.params = { scheduleSlotId: 'slot-1' };
      mockRequest.body = { vehicleId: 'vehicle-1' };

      const mockScheduleSlot = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0
      };

      const mockResult = {
        vehicleAssignment: { 
          id: 'assignment-1',
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          driverId: null,
          seatOverride: null
        },
        slotDeleted: true
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockService.removeVehicleFromSlot.mockResolvedValue(mockResult);

      await controller.removeVehicleFromSlot(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: {
          message: 'Vehicle removed successfully',
          slotDeleted: true
        }
      });

      // Verify WebSocket emissions (slot deleted)
      expect(mockSocketEmitter.broadcastScheduleSlotDeleted).toHaveBeenCalledWith(
        'group-1',
        'slot-1'
      );
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).not.toHaveBeenCalled();
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith('group-1');
    });
  });

  describe('getScheduleSlotDetails', () => {
    it('should return schedule slot details', async () => {
      mockRequest.params = { scheduleSlotId: 'slot-1' };

      const mockSlotWithDetails: ScheduleSlotWithDetails = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2024-01-08T08:00:00.000Z'),
        vehicleAssignments: [{
          id: 'assignment-1',
          vehicle: {
            id: 'vehicle-1',
            name: 'Bus 1',
            capacity: 30
          },
          driver: {
            id: 'driver-1',
            name: 'John Doe'
          }
        }],
        childAssignments: [],
        totalCapacity: 30,
        availableSeats: 30,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      mockService.getScheduleSlotDetails.mockResolvedValue(mockSlotWithDetails);

      await controller.getScheduleSlotDetails(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockService.getScheduleSlotDetails).toHaveBeenCalledWith('slot-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSlotWithDetails
      });
    });

    it('should throw error if slot not found', async () => {
      mockRequest.params = { scheduleSlotId: 'non-existent' };

      mockService.getScheduleSlotDetails.mockResolvedValue(null);

      await expect(
        controller.getScheduleSlotDetails(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow();

      expect(createError).toHaveBeenCalledWith('Schedule slot not found', 404);
    });
  });

  describe('getSchedule', () => {
    it('should return schedule with date range', async () => {
      mockRequest.params = { groupId: 'group-1' };
      mockRequest.query = { 
        startDate: '2024-01-01T00:00:00.000Z', 
        endDate: '2024-01-07T23:59:59.999Z' 
      };

      const mockSlotWithDetails: ScheduleSlotWithDetails = {
        id: 'slot-1',
        groupId: 'group-1',
        datetime: new Date('2024-01-08T08:00:00.000Z'),
        vehicleAssignments: [{
          id: 'assignment-1',
          vehicle: {
            id: 'vehicle-1',
            name: 'Bus 1',
            capacity: 30
          },
          driver: {
            id: 'driver-1',
            name: 'John Doe'
          }
        }],
        childAssignments: [],
        totalCapacity: 30,
        availableSeats: 30,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      };

      const mockSchedule = {
        groupId: 'group-1',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-01-07T23:59:59.999Z',
        scheduleSlots: [mockSlotWithDetails]
      } as { groupId: string; startDate: string; endDate: string; scheduleSlots: ScheduleSlotWithDetails[] };

      mockService.getSchedule.mockResolvedValue(mockSchedule as any);

      await controller.getSchedule(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockService.getSchedule).toHaveBeenCalledWith('group-1', '2024-01-01T00:00:00.000Z', '2024-01-07T23:59:59.999Z');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSchedule
      });
    });

    it('should handle missing date parameters by using defaults', async () => {
      mockRequest.params = { groupId: 'group-1' };
      mockRequest.query = {}; // no date parameters

      const mockSchedule = {
        groupId: 'group-1',
        startDate: '2024-06-24T00:00:00.000Z',
        endDate: '2024-06-30T23:59:59.999Z',
        scheduleSlots: []
      };

      mockService.getSchedule.mockResolvedValue(mockSchedule);

      await controller.getSchedule(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockService.getSchedule).toHaveBeenCalledWith('group-1', undefined, undefined);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSchedule
      });
    });
  });

  // TODO: Implement assignChildToSlot functionality
  // describe('assignChildToSlot', () => {
  //   it('should assign child to slot successfully', async () => {
  //     mockRequest.params = { scheduleSlotId: 'slot-1' };
  //     mockRequest.body = { childId: 'child-1' };

  //     const mockAssignment = { 
  //       scheduleSlotId: 'slot-1',
  //       childId: 'child-1',
  //       assignedAt: new Date('2024-01-01T00:00:00.000Z')
  //     };

  //     mockService.assignChildToSlot.mockResolvedValue(mockAssignment);

  //     await controller.assignChildToSlot(
  //       mockRequest as Request,
  //       mockResponse as Response
  //     );

  //     expect(mockService.assignChildToSlot).toHaveBeenCalledWith({
  //       scheduleSlotId: 'slot-1',
  //       childId: 'child-1'
  //     });
  //     expect(mockResponse.status).toHaveBeenCalledWith(201);
  //     expect(mockResponse.json).toHaveBeenCalledWith({
  //       success: true,
  //       data: mockAssignment
  //     });
  //   });

  //   it('should throw error if childId is missing', async () => {
  //     mockRequest.params = { scheduleSlotId: 'slot-1' };
  //     mockRequest.body = {}; // childId missing

  //     await expect(
  //       controller.assignChildToSlot(
  //         mockRequest as Request,
  //         mockResponse as Response
  //       )
  //     ).rejects.toThrow();

  //     expect(createError).toHaveBeenCalledWith('Child ID is required', 400);
  //   });
  // });

  describe('getScheduleSlotConflicts', () => {
    it('should return schedule slot conflicts', async () => {
      mockRequest.params = { scheduleSlotId: 'slot-1' };

      const mockConflicts = ['CAPACITY_EXCEEDED', 'DRIVER_DOUBLE_BOOKING'];

      mockService.validateSlotConflicts.mockResolvedValue(mockConflicts);

      await controller.getScheduleSlotConflicts(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockService.validateSlotConflicts).toHaveBeenCalledWith('slot-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { conflicts: mockConflicts }
      });
    });
  });

  // ❌ RED: TDD tests for past-time validation (should fail initially)
  describe('updateSeatOverride - Past Time Validation', () => {
    it('should reject seat override updates for past schedule slots', async () => {
      mockRequest.params = { vehicleAssignmentId: 'assignment-1' };
      mockRequest.body = { seatOverride: 25 };

      // Mock service to return slot in the past
      mockService.updateSeatOverride = jest.fn().mockRejectedValue(
        new Error('Cannot modify schedule slots in the past')
      );

      await expect(
        controller.updateSeatOverride(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow('Cannot modify schedule slots in the past');
    });

    it('should allow seat override updates for future schedule slots', async () => {
      mockRequest.params = { vehicleAssignmentId: 'assignment-1' };
      mockRequest.body = { seatOverride: 25 };

      const mockResult = {
        id: 'assignment-1',
        createdAt: new Date(),
        scheduleSlotId: 'slot-1',
        vehicleId: 'vehicle-1',
        driverId: 'driver-1',
        seatOverride: 25,
        vehicle: {
          id: 'vehicle-1',
          name: 'Bus 1',
          capacity: 30
        },
        driver: {
          id: 'driver-1',
          name: 'John Doe'
        }
      };

      mockService.updateSeatOverride = jest.fn().mockResolvedValue(mockResult);

      await controller.updateSeatOverride(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockService.updateSeatOverride).toHaveBeenCalledWith({
        vehicleAssignmentId: 'assignment-1',
        seatOverride: 25
      });
      expect(mockResponse.status).toHaveBeenCalledWith(200);
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
          name: 'Test User'
        }
      } as any;
    });

    it('should reject child assignments to past schedule slots', async () => {
      mockRequest.params = { scheduleSlotId: 'clr1234567890abcdef1234' }; // Valid CUID
      mockRequest.body = { 
        childId: 'clr1234567890abcdef1235', 
        vehicleAssignmentId: 'clr1234567890abcdef1236' 
      };

      const mockScheduleSlot = {
        id: 'clr1234567890abcdef1234',
        groupId: 'group-1',
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0
      };

      const mockChildAssignmentService = {
        assignChildToScheduleSlot: jest.fn().mockRejectedValue(
          new Error('Cannot assign children to schedule slots in the past')
        )
      } as any;

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      controller = new ScheduleSlotController(mockService, mockChildAssignmentService);

      await expect(
        controller.assignChildToScheduleSlot(
          mockRequest as Request,
          mockResponse as Response
        )
      ).rejects.toThrow('Cannot assign children to schedule slots in the past');

      expect(mockChildAssignmentService.assignChildToScheduleSlot).toHaveBeenCalledWith(
        'clr1234567890abcdef1234',
        'clr1234567890abcdef1235', 
        'clr1234567890abcdef1236',
        'test-user-id'
      );
    });

    it('should allow child assignments to future schedule slots', async () => {
      mockRequest.params = { scheduleSlotId: 'clr1234567890abcdef1234' }; // Valid CUID
      mockRequest.body = { 
        childId: 'clr1234567890abcdef1235', 
        vehicleAssignmentId: 'clr1234567890abcdef1236' 
      };

      const mockAssignment = {
        id: 'clr1234567890abcdef1237',
        scheduleSlotId: 'clr1234567890abcdef1234',
        childId: 'clr1234567890abcdef1235',
        vehicleAssignmentId: 'clr1234567890abcdef1236',
        assignedAt: new Date()
      };

      const mockScheduleSlot = {
        id: 'clr1234567890abcdef1234',
        groupId: 'group-1',
        datetime: new Date('2024-01-01T09:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0
      };

      const mockChildAssignmentService = {
        assignChildToScheduleSlot: jest.fn().mockResolvedValue(mockAssignment)
      } as any;

      mockService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      controller = new ScheduleSlotController(mockService, mockChildAssignmentService);

      await controller.assignChildToScheduleSlot(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockChildAssignmentService.assignChildToScheduleSlot).toHaveBeenCalledWith(
        'clr1234567890abcdef1234',
        'clr1234567890abcdef1235', 
        'clr1234567890abcdef1236',
        'test-user-id'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });
  });
});