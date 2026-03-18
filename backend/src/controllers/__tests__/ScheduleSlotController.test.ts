/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { createScheduleSlotControllerRoutes, type ScheduleSlotVariables } from '../v1/ScheduleSlotController';
import { ScheduleSlotService } from '../../services/ScheduleSlotService';
import { ChildAssignmentService } from '../../services/ChildAssignmentService';
import { SocketEmitter } from '../../utils/socketEmitter';
import { TEST_IDS } from '../../utils/testHelpers';

jest.mock('../../services/ScheduleSlotService');
jest.mock('../../services/ChildAssignmentService');
jest.mock('../../utils/socketEmitter');

jest.mock('../../middleware/auth-hono');

// Mock PrismaClient
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    familyMember: {
      findFirst: jest.fn(),
    },
    groupFamilyMember: {
      findFirst: jest.fn(),
    },
    vehicle: {
      findUnique: jest.fn(),
    },
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma),
  };
});

const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};


const makeAuthenticatedRequest = async (app: Hono<any>, url: string, options: RequestInit = {}): Promise<Response> => {
  // Create a modified request that includes the authorization header
  const authOptions = {
    ...options,
    headers: {
      ...options.headers,
      Authorization: 'Bearer valid-token',
    },
  };

  const response = await app.request(url, authOptions);

  // If the response has 401 status, it might be because our mock middleware isn't working
  // In that case, we need to inspect and potentially fix the test setup
  return response;
};

describe('ScheduleSlotController Test Suite', () => {
  let app: Hono<{ Variables: ScheduleSlotVariables }>;
  let mockScheduleSlotService: jest.Mocked<ScheduleSlotService>;
  let mockChildAssignmentService: jest.Mocked<ChildAssignmentService>;
  let mockSocketEmitter: jest.Mocked<typeof SocketEmitter>;
  const mockUserId = TEST_IDS.USER;

  const mockScheduleSlot = {
    id: TEST_IDS.SLOT,
    groupId: TEST_IDS.GROUP,
    group: { id: TEST_IDS.GROUP, name: 'Test Group' },
    datetime: '2024-01-08T08:00:00.000Z',
    vehicleAssignments: [{
      id: 'cltestvlassignment1234567890',
      vehicleId: TEST_IDS.VEHICLE,
      scheduleSlotId: TEST_IDS.SLOT,
      driverId: TEST_IDS.USER,
      seatOverride: 0,
      createdAt: '2024-01-01T00:00:00.000Z',
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
        name: 'John Doe',
      },
      childAssignments: [],
    }],
    childAssignments: [],
    totalCapacity: 30,
    availableSeats: 30,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Prisma queries for access control
    // @ts-ignore - Mocking Prisma for testing
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const MockedPrisma = require('@prisma/client').PrismaClient;
    const mockPrisma = new MockedPrisma() as any;
    mockPrisma.familyMember.findFirst = jest.fn() as any;
    mockPrisma.familyMember.findFirst.mockResolvedValue({
      userId: mockUserId,
      familyId: TEST_IDS.FAMILY,
    });
    mockPrisma.groupFamilyMember.findFirst = jest.fn() as any;
    mockPrisma.groupFamilyMember.findFirst.mockResolvedValue({
      groupId: TEST_IDS.GROUP,
      familyId: TEST_IDS.FAMILY,
    });

    // Mock vehicle ownership check
    mockPrisma.vehicle.findUnique = jest.fn() as any;
    mockPrisma.vehicle.findUnique.mockResolvedValue({
      familyId: TEST_IDS.FAMILY,
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
      updateSeatOverrideByVehicle: jest.fn(),
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
      skipAuthChecks: true, // Enable built-in test middleware
      testUserId: mockUserId, // Pass the test user ID to match test expectations
    };

    // Create the controller app with built-in authentication middleware
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
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBeDefined();
      // Zod validation errors contain error details
      expect(jsonResponse.error).toHaveProperty('message');
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
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
        success: false,
        error: 'Authentication required',
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
        code: 'CREATE_FAILED',
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

      // Controller now returns actual error message instead of generic message
      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Schedule slot already exists for this datetime',
        code: 'CREATE_FAILED',
      });
    });
  });

  describe('POST /schedule-slots/:scheduleSlotId/vehicles', () => {
    it('should assign vehicle to slot successfully', async () => {
      // Initial schedule slot (before vehicle assignment)
      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-01T09:00:00.000Z',
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Updated schedule slot (after vehicle assignment)
      const mockScheduleSlotWithVehicle = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-01T09:00:00.000Z',
        vehicleAssignments: [
          {
            id: 'cltestvlassignment1234567890',
            vehicleId: TEST_IDS.VEHICLE,
            scheduleSlotId: TEST_IDS.SLOT,
            driverId: TEST_IDS.USER,
            seatOverride: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
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
              name: 'John Doe',
              email: 'driver@example.com',
            },
            childAssignments: [],
          },
        ],
        childAssignments: [],
        totalCapacity: 30,
        availableSeats: 30,
        createdAt: '2024-01-01T00:HH:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock first call (before assignment) and second call (after assignment)
      mockScheduleSlotService.getScheduleSlotDetails
        .mockResolvedValueOnce(mockScheduleSlot)
        .mockResolvedValueOnce(mockScheduleSlotWithVehicle);
      mockScheduleSlotService.assignVehicleToSlot.mockResolvedValue(mockScheduleSlotWithVehicle);

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
      // Expects complete ScheduleSlot structure (not just VehicleAssignment)
      expect(jsonResponse).toEqual({
        success: true,
        data: expect.objectContaining({
          id: TEST_IDS.SLOT, // ScheduleSlot ID (not VehicleAssignment ID)
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

      expect(mockScheduleSlotService.assignVehicleToSlot).toHaveBeenCalledWith({
        scheduleSlotId: TEST_IDS.SLOT,
        vehicleId: TEST_IDS.VEHICLE,
        driverId: TEST_IDS.USER,
        seatOverride: undefined,
      });

      // Verify WebSocket emissions - now broadcasts complete ScheduleSlot
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        TEST_IDS.SLOT,
        mockScheduleSlotWithVehicle,
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
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBeDefined();
      // Zod validation errors contain error details
      expect(jsonResponse.error).toHaveProperty('message');
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
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
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-01T09:00:00.000Z',
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const mockResult = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-01T09:00:00.000Z',
        vehicleAssignments: [
          {
            id: 'remaining-vehicle-assignment',
            vehicleId: 'remaining-vehicle-id',
            scheduleSlotId: TEST_IDS.SLOT,
            driverId: null,
            seatOverride: null,
            createdAt: '2024-01-01T00:00:00.000Z',
            vehicle: {
              id: 'remaining-vehicle-id',
              name: 'Remaining Bus',
              capacity: 20,
              familyId: TEST_IDS.FAMILY,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            driver: null,
            childAssignments: [],
          },
        ],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockScheduleSlotService.removeVehicleFromSlot.mockResolvedValue({
        slotDeleted: false,
        scheduleSlot: mockResult,
      });

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: TEST_IDS.VEHICLE }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toHaveProperty('id', TEST_IDS.SLOT);
      expect(jsonResponse.data).toHaveProperty('vehicleAssignments');
      expect(jsonResponse.data.vehicleAssignments).toHaveLength(1);

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
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-01T09:00:00.000Z',
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // ✅ NEW: Returns null scheduleSlot when slot is deleted (last vehicle removed)
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockScheduleSlotService.removeVehicleFromSlot.mockResolvedValue({
        slotDeleted: true,
        scheduleSlot: null,
      });

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
          message: 'Vehicle removed successfully - schedule slot deleted (last vehicle)',
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
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBeDefined();
      // Zod validation errors contain error details
      expect(jsonResponse.error).toHaveProperty('message');
      expect(jsonResponse.error).toHaveProperty('name', 'ZodError');
    });

    it('should throw error if service returns slotDeleted=false with no scheduleSlot (should never happen)', async () => {
      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-01T09:00:00.000Z',
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Simulate invalid service response - slotDeleted=false but no scheduleSlot
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockScheduleSlotService.removeVehicleFromSlot.mockResolvedValue({
        slotDeleted: false,
        scheduleSlot: null,
      });

      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: TEST_IDS.VEHICLE }),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toContain('Service returned slotDeleted=false but no scheduleSlot');
    });
  });

  describe('GET /schedule-slots/:scheduleSlotId', () => {
    it('should return schedule slot details', async () => {
      const mockSlotWithDetails = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-08T08:00:00.000Z',
        vehicleAssignments: [{
          id: 'cltestvlassignment1234567890',
          vehicleId: TEST_IDS.VEHICLE,
          scheduleSlotId: TEST_IDS.SLOT,
          driverId: TEST_IDS.USER,
          seatOverride: 0,
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
          childAssignments: [],
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
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toHaveProperty('id', TEST_IDS.SLOT);
      expect(jsonResponse.data).toHaveProperty('groupId', TEST_IDS.GROUP);
      expect(jsonResponse.data.vehicleAssignments).toBeDefined();
      expect(jsonResponse.data.vehicleAssignments.length).toBe(1);
      expect(jsonResponse.data.vehicleAssignments[0].driver).toHaveProperty('id', TEST_IDS.USER);
      expect(jsonResponse.data.vehicleAssignments[0].driver).toHaveProperty('name', 'John Doe');

      expect(mockScheduleSlotService.getScheduleSlotDetails).toHaveBeenCalledWith(TEST_IDS.SLOT);
    });

    it('should throw error if slot not found', async () => {
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(null);

      // Use a valid CUID format that will pass validation but not be found
      const nonExistentSlotId = 'cltestslot99999999999999999';
      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${nonExistentSlotId}`, {
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
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-08T08:00:00.000Z',
        vehicleAssignments: [{
          id: 'cltestvlassignment1234567890',
          vehicleId: TEST_IDS.VEHICLE,
          scheduleSlotId: TEST_IDS.SLOT,
          driverId: TEST_IDS.USER,
          seatOverride: 0,
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
          childAssignments: [],
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
        '2024-01-07T23:59:59.999Z',
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

  describe('PATCH /schedule-slots/:scheduleSlotId/vehicles/:vehicleAssignmentId', () => {
    it('should assign child to vehicle successfully', async () => {
      const mockAssignment = {
        id: `${TEST_IDS.SLOT}_${TEST_IDS.CHILD}`, // Composite ID for child assignment
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
          driver: {
            id: TEST_IDS.USER,
            name: 'Test Driver',
            email: 'driver@test.com',
          },
          childAssignments: [],
        },
      };

      // Complete ScheduleSlot with child assignment included
      const mockScheduleSlotWithChild = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-08T08:00:00.000Z',
        vehicleAssignments: [
          {
            id: TEST_IDS.VEHICLE_ASSIGNMENT,
            vehicleId: TEST_IDS.VEHICLE,
            scheduleSlotId: TEST_IDS.SLOT,
            driverId: TEST_IDS.USER,
            seatOverride: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            vehicle: {
              id: TEST_IDS.VEHICLE,
              name: 'Test Vehicle',
              capacity: 30,
              familyId: TEST_IDS.FAMILY,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            driver: {
              id: TEST_IDS.USER,
              name: 'Test Driver',
            },
            childAssignments: [],
          },
        ],
        childAssignments: [
          {
            id: `${TEST_IDS.SLOT}_${TEST_IDS.CHILD}`,
            scheduleSlotId: TEST_IDS.SLOT,
            childId: TEST_IDS.CHILD,
            vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT,
            assignedAt: '2024-01-01T00:00:00.000Z',
            child: {
              id: TEST_IDS.CHILD,
              name: 'Test Child',
              age: 8,
              familyId: TEST_IDS.FAMILY,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
          },
        ],
        totalCapacity: 30,
        availableSeats: 29,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      // Mock initial call (returns slot without new child)
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValueOnce({
        ...mockScheduleSlotWithChild,
        childAssignments: [], // Initially empty
      });
      mockChildAssignmentService.assignChildToScheduleSlot.mockResolvedValue(mockAssignment as any);
      // Mock second call (returns slot with new child)
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValueOnce(mockScheduleSlotWithChild);

      const response = await makeAuthenticatedRequest(
        app,
        `/schedule-slots/${TEST_IDS.SLOT}/vehicles/${TEST_IDS.VEHICLE_ASSIGNMENT}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addChildIds: [TEST_IDS.CHILD],
          }),
        },
      );

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // Expects ScheduleSlot structure
      expect(jsonResponse).toEqual({
        success: true,
        data: expect.objectContaining({
          id: TEST_IDS.SLOT, // ScheduleSlot ID (not composite ChildAssignment ID)
          groupId: TEST_IDS.GROUP,
          vehicleAssignments: expect.arrayContaining([
            expect.objectContaining({
              id: TEST_IDS.VEHICLE_ASSIGNMENT,
              vehicle: expect.objectContaining({
                id: TEST_IDS.VEHICLE,
                name: 'Test Vehicle',
                capacity: 30,
              }),
            }),
          ]),
          childAssignments: expect.arrayContaining([
            expect.objectContaining({
              id: `${TEST_IDS.SLOT}_${TEST_IDS.CHILD}`,
              childId: TEST_IDS.CHILD,
              vehicleAssignmentId: TEST_IDS.VEHICLE_ASSIGNMENT,
              assignedAt: '2024-01-01T00:00:00.000Z',
              child: expect.objectContaining({
                id: TEST_IDS.CHILD,
                name: 'Test Child',
                age: 8,
              }),
            }),
          ]),
        }),
      });

      expect(mockChildAssignmentService.assignChildToScheduleSlot).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        TEST_IDS.CHILD,
        TEST_IDS.VEHICLE_ASSIGNMENT,
        mockUserId,
      );

      // Verify WebSocket emissions - broadcasts complete ScheduleSlot
      expect(mockSocketEmitter.broadcastScheduleSlotUpdate).toHaveBeenCalledWith(
        TEST_IDS.GROUP,
        TEST_IDS.SLOT,
        mockScheduleSlotWithChild,
      );
      expect(mockSocketEmitter.broadcastScheduleUpdate).toHaveBeenCalledWith(TEST_IDS.GROUP);
    });

    it('should handle empty addChildIds array', async () => {
      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-08T08:00:00.000Z',
        vehicleAssignments: [
          {
            id: TEST_IDS.VEHICLE_ASSIGNMENT,
            vehicleId: TEST_IDS.VEHICLE,
            scheduleSlotId: TEST_IDS.SLOT,
            driverId: TEST_IDS.USER,
            seatOverride: 0,
            createdAt: '2024-01-01T00:00:00.000Z',
            vehicle: {
              id: TEST_IDS.VEHICLE,
              name: 'Test Vehicle',
              capacity: 30,
              familyId: TEST_IDS.FAMILY,
              createdAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
            },
            driver: {
              id: TEST_IDS.USER,
              name: 'Test Driver',
              email: 'driver@test.com',
            },
            childAssignments: [],
          },
        ],
        childAssignments: [],
        totalCapacity: 30,
        availableSeats: 30,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);

      const response = await makeAuthenticatedRequest(
        app,
        `/schedule-slots/${TEST_IDS.SLOT}/vehicles/${TEST_IDS.VEHICLE_ASSIGNMENT}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ addChildIds: [] }), // empty array
        },
      );

      // Empty array is valid, but no children are added - should still return 200
      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);

      // Verify child assignment service was NOT called
      expect(mockChildAssignmentService.assignChildToScheduleSlot).not.toHaveBeenCalled();
    });

    it('should handle authentication required error', async () => {
      const response = await app.request(
        `/schedule-slots/${TEST_IDS.SLOT}/vehicles/${TEST_IDS.VEHICLE_ASSIGNMENT}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            addChildIds: [TEST_IDS.CHILD],
          }),
        },
      );

      expect(response.status).toBe(401);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Authentication required',
      });
    });
  });

  describe('GET /schedule-slots/:scheduleSlotId/conflicts', () => {
    it('should return schedule slot conflicts', async () => {
      const mockConflicts = ['CAPACITY_EXCEEDED', 'DRIVER_DOUBLE_BOOKING'];

      // Mock getScheduleSlotDetails for access control
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
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

  describe('PATCH /schedule-slots/:scheduleSlotId/vehicles/:vehicleId/seat-override', () => {
    const validVehicleAssignmentId = 'clvh12345678901234567890ab'; // 25-char CUID

    it('should update seat override successfully', async () => {
      // ✅ Updated: Now returns complete ScheduleSlot instead of VehicleAssignment
      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-08T08:00:00.000Z',
        vehicleAssignments: [
          {
            id: validVehicleAssignmentId,
            vehicleId: TEST_IDS.VEHICLE,
            scheduleSlotId: TEST_IDS.SLOT,
            driverId: TEST_IDS.USER,
            seatOverride: 5, // Updated seat override
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
            childAssignments: [],
          },
        ],
        childAssignments: [],
        totalCapacity: 5, // seatOverride
        availableSeats: 5,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);
      mockScheduleSlotService.updateSeatOverrideByVehicle.mockResolvedValue(mockScheduleSlot);

      // ✅ Updated: New path uses scheduleSlotId and vehicleId in path
      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles/${TEST_IDS.VEHICLE}/seat-override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatOverride: 5 }),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      // ✅ Updated: Now expects ScheduleSlot structure
      expect(jsonResponse).toEqual({
        success: true,
        data: expect.objectContaining({
          id: TEST_IDS.SLOT, // ScheduleSlot ID
          groupId: TEST_IDS.GROUP,
          vehicleAssignments: expect.arrayContaining([
            expect.objectContaining({
              id: validVehicleAssignmentId,
              seatOverride: 5,
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

      // ✅ Updated: Uses new service method with scheduleSlotId and vehicleId
      expect(mockScheduleSlotService.updateSeatOverrideByVehicle).toHaveBeenCalledWith(
        TEST_IDS.SLOT,
        TEST_IDS.VEHICLE,
        5,
      );
    });

    it('should handle service errors', async () => {
      const error = new Error('Vehicle assignment not found');
      mockScheduleSlotService.updateSeatOverrideByVehicle.mockRejectedValue(error);

      // ✅ Mock schedule slot to exist (so 404 doesn't trigger before service error)
      const mockScheduleSlot = {
        id: TEST_IDS.SLOT,
        groupId: TEST_IDS.GROUP,
        group: { id: TEST_IDS.GROUP, name: 'Test Group' },
        datetime: '2024-01-08T08:00:00.000Z',
        vehicleAssignments: [],
        childAssignments: [],
        totalCapacity: 0,
        availableSeats: 0,
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockScheduleSlot);

      // ✅ Updated: New path
      const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}/vehicles/${TEST_IDS.VEHICLE}/seat-override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seatOverride: 5 }),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      // Now returns actual error message from service instead of generic message
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle assignment not found',
        code: 'UPDATE_FAILED',
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

      // JSON parsing errors result in 400 status from Zod validation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should handle missing required parameters', async () => {
      const response = await makeAuthenticatedRequest(app, '/schedule-slots//vehicles', {
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
        success: false,
        error: 'Authentication required',
      });
    });
  });

  // =========================================================================
  // Array Response Validation Tests
  // Ensuring arrays are returned as [] instead of null/undefined
  // =========================================================================

  describe('Array Response Validation', () => {
    describe('GET /groups/:groupId/schedule', () => {
      it('should return empty arrays for schedule with no slots', async () => {
        const mockEmptySchedule = {
          groupId: TEST_IDS.GROUP,
          startDate: '2025-01-06T00:00:00.000Z',
          endDate: '2025-01-12T23:59:59.999Z',
          scheduleSlots: [], // Empty array
        };

        mockScheduleSlotService.getSchedule.mockResolvedValue(mockEmptySchedule);

        const response = await makeAuthenticatedRequest(app, `/groups/${TEST_IDS.GROUP}/schedule?startDate=2025-01-06T00:00:00.000Z&endDate=2025-01-12T23:59:59.999Z`);

        expect(response.status).toBe(200);
        const jsonResponse = await responseJson(response);

        expect(jsonResponse.success).toBe(true);
        expect(jsonResponse.data.scheduleSlots).toBeDefined();
        expect(jsonResponse.data.scheduleSlots).toEqual([]);
        expect(Array.isArray(jsonResponse.data.scheduleSlots)).toBe(true);
        expect(jsonResponse.data.scheduleSlots).not.toBeNull();
        expect(jsonResponse.data.scheduleSlots).not.toBeUndefined();
      });
    });

    describe('GET /schedule-slots/:slotId', () => {
      it('should return empty arrays for slot with no vehicle assignments', async () => {
        const mockSlotWithNoVehicles = {
          id: TEST_IDS.SLOT,
          groupId: TEST_IDS.GROUP,
          group: { id: TEST_IDS.GROUP, name: 'Test Group' },
          datetime: '2025-01-06T08:00:00.000Z',
          createdAt: '2025-01-06T00:00:00.000Z',
          updatedAt: '2025-01-06T00:00:00.000Z',
          vehicleAssignments: [], // Empty array
          childAssignments: [],
          totalCapacity: 0,
          availableSeats: 999, // Unlimited if no vehicles
        };

        mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockSlotWithNoVehicles);

        const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}`);

        expect(response.status).toBe(200);
        const jsonResponse = await responseJson(response);

        expect(jsonResponse.success).toBe(true);
        expect(jsonResponse.data.vehicleAssignments).toBeDefined();
        expect(jsonResponse.data.vehicleAssignments).toEqual([]);
        expect(Array.isArray(jsonResponse.data.vehicleAssignments)).toBe(true);
        expect(jsonResponse.data.vehicleAssignments).not.toBeNull();
        expect(jsonResponse.data.vehicleAssignments).not.toBeUndefined();
      });

      it('should return empty arrays for slot with no child assignments', async () => {
        const mockSlotWithNoChildren = {
          id: TEST_IDS.SLOT,
          groupId: TEST_IDS.GROUP,
          group: { id: TEST_IDS.GROUP, name: 'Test Group' },
          datetime: '2025-01-06T08:00:00.000Z',
          createdAt: '2025-01-06T00:00:00.000Z',
          updatedAt: '2025-01-06T00:00:00.000Z',
          vehicleAssignments: [],
          childAssignments: [], // Empty array
          totalCapacity: 0,
          availableSeats: 999, // Unlimited if no vehicles
        };

        mockScheduleSlotService.getScheduleSlotDetails.mockResolvedValue(mockSlotWithNoChildren);

        const response = await makeAuthenticatedRequest(app, `/schedule-slots/${TEST_IDS.SLOT}`);

        expect(response.status).toBe(200);
        const jsonResponse = await responseJson(response);

        expect(jsonResponse.success).toBe(true);
        expect(jsonResponse.data.childAssignments).toBeDefined();
        expect(jsonResponse.data.childAssignments).toEqual([]);
        expect(Array.isArray(jsonResponse.data.childAssignments)).toBe(true);
        expect(jsonResponse.data.childAssignments).not.toBeNull();
        expect(jsonResponse.data.childAssignments).not.toBeUndefined();
      });
    });
  });
});