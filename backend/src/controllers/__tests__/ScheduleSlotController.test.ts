/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { createScheduleSlotControllerRoutes, type ScheduleSlotVariables } from '../ScheduleSlotController';
import { ScheduleSlotService } from '../../services/ScheduleSlotService';
import { ChildAssignmentService } from '../../services/ChildAssignmentService';
import { SocketEmitter } from '../../utils/socketEmitter';
import { TEST_IDS } from '../../utils/testHelpers';

jest.mock('../../services/ScheduleSlotService');
jest.mock('../../services/ChildAssignmentService');
jest.mock('../../utils/socketEmitter');

jest.mock('../../middleware/auth-hono');

const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};


const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}) => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': 'Bearer valid-token',
    },
  });
};

describe('ScheduleSlotController Test Suite', () => {
  let app: Hono<{ Variables: ScheduleSlotVariables }>;
  let mockScheduleSlotService: jest.Mocked<ScheduleSlotService>;
  let mockChildAssignmentService: jest.Mocked<ChildAssignmentService>;
  let mockSocketEmitter: jest.Mocked<typeof SocketEmitter>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';

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

    // Mock authentication middleware to set user context for protected routes
    const { authenticateToken } = require('../../middleware/auth-hono');
    authenticateToken.mockImplementation((c: any, next: any) => {
      const authHeader = c.req.header('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Access token required' }, 401);
      }

      c.set('userId', mockUserId);
      c.set('user', {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Test User',
        timezone: 'UTC',
      });
      return next();
    });

    // Mock SocketEmitter
    mockSocketEmitter = SocketEmitter as jest.Mocked<typeof SocketEmitter>;
    mockSocketEmitter.broadcastScheduleSlotCreated = jest.fn();
    mockSocketEmitter.broadcastScheduleSlotUpdate = jest.fn();
    mockSocketEmitter.broadcastScheduleSlotDeleted = jest.fn();
    mockSocketEmitter.broadcastScheduleUpdate = jest.fn();

    // Mock schedule slot service methods
    mockScheduleSlotService = {
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

    // Mock child assignment service methods
    mockChildAssignmentService = {
      addChildToGroup: jest.fn(),
      removeChildFromGroup: jest.fn(),
      assignChildToScheduleSlot: jest.fn(),
      removeChildFromScheduleSlot: jest.fn(),
      getAvailableChildrenForScheduleSlot: jest.fn(),
      getChildGroupMemberships: jest.fn(),
    } as any;

    // Set up the controller with mocked dependencies using factory pattern
    const deps = {
      scheduleSlotService: mockScheduleSlotService,
      childAssignmentService: mockChildAssignmentService,
    };

    app = createScheduleSlotControllerRoutes(deps);
  });

  describe('POST /groups/:groupId/schedule-slots', () => {
    it('should create schedule slot with vehicle using datetime payload', async () => {
      mockScheduleSlotService.createScheduleSlotWithVehicle.mockResolvedValue(mockScheduleSlot);

      const response = await makeAuthenticatedRequest(app, `/groups/${TEST_IDS.GROUP}/schedule-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datetime: '2024-01-08T08:00:00.000Z', // Monday of week 2024-01 at 08:00
          vehicleId: TEST_IDS.VEHICLE,
          driverId: TEST_IDS.USER,
        }),
      });

      expect(response.status).toBe(201);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
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

      expect(mockScheduleSlotService.createScheduleSlotWithVehicle).toHaveBeenCalledWith(
        {
          groupId: TEST_IDS.GROUP,
          datetime: '2024-01-08T08:00:00.000Z',
        },
        TEST_IDS.VEHICLE,
        mockUserId,
        TEST_IDS.USER,
        undefined,
      );

      // Verify WebSocket emissions
      expect(mockSocketEmitter.broadcastScheduleSlotCreated).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        TEST_IDS.SLOT,
        mockScheduleSlot,
      );
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith(TEST_IDS.GROUP);
    });

    it('should throw error if vehicleId is missing', async () => {
      const response = await makeAuthenticatedRequest(app, `/groups/${TEST_IDS.GROUP}/schedule-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datetime: '2024-01-08T08:00:00.000Z',
          // vehicleId missing
        }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle ID is required to create a schedule slot',
      });
    });

    it('should handle authentication required error', async () => {
      const response = await app.request(`/groups/${TEST_IDS.GROUP}/schedule-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datetime: '2024-01-08T08:00:00.000Z',
          vehicleId: TEST_IDS.VEHICLE,
        }),
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        error: 'Access token required',
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Service unavailable');
      mockScheduleSlotService.createScheduleSlotWithVehicle.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, `/groups/${TEST_IDS.GROUP}/schedule-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datetime: '2024-01-08T08:00:00.000Z',
          vehicleId: TEST_IDS.VEHICLE,
        }),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Service unavailable',
        code: 'INTERNAL_ERROR'
      });
    });

    it('should handle conflict errors for existing slots', async () => {
      const error = new Error('Schedule slot already exists for this datetime');
      mockScheduleSlotService.createScheduleSlotWithVehicle.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, `/groups/${TEST_IDS.GROUP}/schedule-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datetime: '2024-01-08T08:00:00.000Z',
          vehicleId: TEST_IDS.VEHICLE,
        }),
      });

      expect(response.status).toBe(409);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Schedule slot already exists for this datetime',
        code: 'ALREADY_EXISTS'
      });
    });
  });

  describe('POST /schedule-slots/:scheduleSlotId/vehicles', () => {
    it('should assign vehicle to slot successfully', async () => {
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

      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockScheduleSlotService.assignVehicleToSlot.mockResolvedValue(mockAssignment);

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: TEST_IDS.VEHICLE,
          driverId: TEST_IDS.USER,
        }),
      });

      expect(response.status).toBe(201);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
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

      expect(mockScheduleSlotService.assignVehicleToSlot).toHaveBeenCalledWith({
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.USER,
        seatOverride: undefined,
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
      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // vehicleId missing
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle ID is required',
      });
    });

    it('should handle schedule slot not found', async () => {
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: TEST_IDS.VEHICLE,
          driverId: TEST_IDS.USER,
        }),
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Schedule slot not found',
      });
    });
  });

  describe('DELETE /schedule-slots/:scheduleSlotId/vehicles', () => {
    it('should remove vehicle from slot successfully', async () => {
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

      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockScheduleSlotService.removeVehicleFromSlot.mockResolvedValue(mockResult);

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: TEST_IDS.VEHICLE }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: {
          message: 'Vehicle removed successfully',
          slotDeleted: false,
        },
      });

      expect(mockScheduleSlotService.removeVehicleFromSlot).toHaveBeenCalledWith(TEST_IDS.SLOT, TEST_IDS.VEHICLE);

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

      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockScheduleSlotService.removeVehicleFromSlot.mockResolvedValue(mockResult);

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: TEST_IDS.VEHICLE }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
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

    it('should throw error if vehicleId is missing', async () => {
      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // vehicleId missing
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle ID is required',
      });
    });
  });

  describe('GET /schedule-slots/:scheduleSlotId', () => {
    it('should return schedule slot details', async () => {
      const mockSlotWithDetails = {
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

      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockSlotWithDetails);

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: expect.objectContaining({
          id: TEST_IDS.SLOT,
          groupId: TEST_IDS.GROUP,
          vehicleAssignments: expect.arrayContaining([
            expect.objectContaining({
              id: 'cltestvlassignment1234567890',
              vehicle: expect.objectContaining({
                id: TEST_IDS.VEHICLE,
                name: 'Bus 1',
                capacity: 30,
              }),
              driver: expect.objectContaining({
                id: TEST_IDS.USER,
                name: 'John Doe',
              }),
            }),
          ]),
        }),
      });

      expect(mockScheduleSlotService.getScheduleSlotDetails).toHaveBeenCalledWith(TEST_IDS.SLOT);
    });

    it('should throw error if slot not found', async () => {
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/non-existent`, {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Schedule slot not found',
      });
    });
  });

  describe('GET /groups/:groupId/schedule', () => {
    it('should return schedule with date range', async () => {
      const mockSlotWithDetails = {
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
      };

      mockScheduleSlotService.getSchedule.mockResolvedValue(mockSchedule);

      const response = await makeAuthenticatedRequest(app, `/groups/${TEST_IDS.GROUP}/schedule?startDate=2024-01-01T00:00:00.000Z&endDate=2024-01-07T23:59:59.999Z`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: expect.objectContaining({
          groupId: TEST_IDS.GROUP,
          startDate: '2024-01-01T00:00:00.000Z',
          endDate: '2024-01-07T23:59:59.999Z',
          scheduleSlots: expect.arrayContaining([
            expect.objectContaining({
              id: TEST_IDS.SLOT,
            }),
          ]),
        }),
      });

      expect(mockScheduleSlotService.getSchedule).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        '2024-01-01T00:00:00.000Z',
        '2024-01-07T23:59:59.999Z'
      );
    });

    it('should handle missing date parameters by using defaults', async () => {
      const mockSchedule = {
        groupId: TEST_IDS.GROUP,
        startDate: '2024-06-24T00:00:00.000Z',
        endDate: '2024-06-30T23:59:59.999Z',
        scheduleSlots: [],
      };

      mockScheduleSlotService.getSchedule.mockResolvedValue(mockSchedule);

      const response = await makeAuthenticatedRequest(app, `/groups/${TEST_IDS.GROUP}/schedule`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: mockSchedule,
      });

      expect(mockScheduleSlotService.getSchedule).toHaveBeenCalledWith(TEST_IDS.GROUP, undefined, undefined);
    });
  });

  describe('POST /schedule-slots/:scheduleSlotId/children', () => {
    it('should assign child to slot successfully', async () => {
      const mockAssignment = {
        id: 'cltestassignment123456789012345',
        scheduleSlotId: TEST_IDS.SLOT,
        childId: TEST_IDS.CHILD,
        vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT,
        assignedAt: new Date('2024-01-01T00:00:00.000Z'),
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        child: {
          id: TEST_IDS.CHILD,
          name: 'Test Child',
          age: 8,
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          familyId: TEST_IDS.FAMILY,
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
          createdAt: new Date('2024-01-01T00:00:00.000Z'),
          seatOverride: 0,
          vehicle: {
            id: TEST_IDS.VEHICLE,
            name: 'Test Vehicle',
            capacity: 30,
            familyId: TEST_IDS.FAMILY,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-01T00:00:00.000Z'),
          },
        },
      };

      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2024-01-08T08:00:00.000Z'),
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockChildAssignmentService.assignChildToScheduleSlot.mockResolvedValue(mockAssignment);

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: TEST_IDS.CHILD,
          vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT,
        }),
      });

      expect(response.status).toBe(201);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'cltestassignment123456789012345',
          childId: TEST_IDS.CHILD,
          scheduleSlotId: TEST_IDS.SLOT,
          vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT,
          assignedAt: '2024-01-01T00:00:00.000Z',
        }),
      });

      expect(mockChildAssignmentService.assignChildToScheduleSlot).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        TEST_IDS.CHILD,
        TEST_IDS.VEHICLE_ASSIGNMENT,
        mockUserId,
      );

      // Verify WebSocket emissions
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        TEST_IDS.SLOT,
        mockAssignment,
      );
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith(TEST_IDS.GROUP);
    });

    it('should throw error if childId is missing', async () => {
      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT }), // childId missing
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child ID is required',
      });
    });

    it('should handle authentication required error', async () => {
      const response = await app.request(`/schedule-slots/${TEST_IDS.SLOT}/children`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId: TEST_IDS.CHILD,
          vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT,
        }),
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        error: 'Access token required',
      });
    });
  });

  describe('GET /schedule-slots/:scheduleSlotId/conflicts', () => {
    it('should return schedule slot conflicts', async () => {
      const mockConflicts = ['CAPACITY_EXCEEDED', 'DRIVER_DOUBLE_BOOKING'];

      mockScheduleSlotService.validateSlotConflicts.mockResolvedValue(mockConflicts);

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/conflicts`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: { conflicts: mockConflicts },
      });

      expect(mockScheduleSlotService.validateSlotConflicts).toHaveBeenCalledWith(TEST_IDS.SLOT);
    });
  });

  describe('PATCH /vehicle-assignments/:vehicleAssignmentId/seat-override', () => {
    it('should update seat override successfully', async () => {
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

      mockScheduleSlotService.updateSeatOverride.mockResolvedValue(mockResult);

      const response = await makeAuthenticatedRequest(app, `/vehicle-assignments/cltestvlassignment1234567890/seat-override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatOverride: 25 }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: expect.objectContaining({
          id: 'cltestvlassignment1234567890',
          seatOverride: 25,
          vehicle: expect.objectContaining({
            id: TEST_IDS.VEHICLE,
            name: 'Bus 1',
            capacity: 30,
          }),
          driver: expect.objectContaining({
            id: TEST_IDS.USER,
            name: 'John Doe',
          }),
        }),
      });

      expect(mockScheduleSlotService.updateSeatOverride).toHaveBeenCalledWith({
        vehicleAssignmentId: 'cltestvlassignment1234567890',
        seatOverride: 25,
      });
    });

    it('should handle service errors', async () => {
      const error = new Error('Vehicle assignment not found');
      mockScheduleSlotService.updateSeatOverride.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, `/vehicle-assignments/cltestvlassignment1234567890/seat-override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatOverride: 25 }),
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle assignment not found',
        code: 'NOT_FOUND'
      });
    });
  });

  describe('Error Handling and Validation', () => {
    it('should handle malformed JSON in request body', async () => {
      const response = await makeAuthenticatedRequest(app, `/groups/${TEST_IDS.GROUP}/schedule-slots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      expect(response.status).toBe(500); // JSON parsing errors result in 500 status
    });

    it('should handle missing required parameters', async () => {
      const response = await makeAuthenticatedRequest(app, `/schedule-slots//vehicles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: TEST_IDS.VEHICLE,
          driverId: TEST_IDS.USER,
        }),
      });

      expect(response.status).toBe(404);
    });

    it('should handle unauthorized access', async () => {
      const response = await app.request(`/schedule-slots/${TEST_IDS.SLOT}`, {
        method: 'GET',
        headers: {}, // No Authorization header
      });

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        error: 'Access token required',
      });
    });
  });
});