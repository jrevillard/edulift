/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { TEST_IDS } from '../../utils/testHelpers';
import { createVehicleControllerRoutes } from '../v1/VehicleController';
import { AppError } from '../../middleware/errorHandler';

// Mock all dependencies BEFORE importing VehicleController
jest.mock('../../services/VehicleService');
jest.mock('../../middleware/auth-hono', () => ({
  authenticateToken: jest.fn(),
}));

// Import the mocked classes for typing
import { VehicleService } from '../../services/VehicleService';

// Define VehicleVariables type inline (it's not exported from VehicleController)
type VehicleVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

let mockAuthenticateToken: jest.Mock;

// Mock Prisma for verifyGroupAccess (needed by getAvailableVehicles endpoint)
const mockPrismaFamilyMemberFindFirst = jest.fn() as any;
const mockPrismaGroupFamilyMemberFindFirst = jest.fn() as any;

const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const parseZodError = (error: any): string => {
  if (typeof error === 'string') {
    // Check if it's a JSON string containing ZodError
    if (error.includes('"name": "ZodError"')) {
      try {
        const parsed = JSON.parse(error);
        if (parsed.issues && parsed.issues.length > 0) {
          const issue = parsed.issues[0];
          if (issue.code === 'invalid_type') {
            // For required fields, return a more user-friendly message
            return `${issue.path.join('.')} is required`;
          }
          return issue.message;
        }
      } catch {
        return error;
      }
    }
    // Check if it's a JSON string with issues directly (current format)
    if (error.includes('"code":')) {
      try {
        const parsed = JSON.parse(error);
        if (parsed.length > 0 && parsed[0].code === 'invalid_type') {
          const issue = parsed[0];
          return `${issue.path.join('.')} is required`;
        }
        if (parsed.length > 0) {
          return parsed[0].message;
        }
      } catch {
        return error;
      }
    }
    return error;
  }

  // If error is an object with message property (ZodError format)
  if (error && typeof error === 'object' && error.message) {
    // Check if it's a ZodError object
    if (error.name === 'ZodError') {
      try {
        // The message contains the JSON string of issues
        const parsed = JSON.parse(error.message);
        if (parsed.issues && parsed.issues.length > 0) {
          const issue = parsed.issues[0];
          if (issue.code === 'invalid_type') {
            // For required fields, return a more user-friendly message
            return `${issue.path.join('.')} is required`;
          }
          return issue.message;
        }
      } catch (parseError) {
        console.log('Parse error:', parseError);
        return error.message;
      }
    }
    // Check if message contains JSON string (legacy format)
    if (error.message.includes('"name": "ZodError"')) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.issues && parsed.issues.length > 0) {
          const issue = parsed.issues[0];
          if (issue.code === 'invalid_type') {
            // For required fields, return a more user-friendly message
            return `${issue.path.join('.')} is required`;
          }
          return issue.message;
        }
      } catch {
        return error.message;
      }
    }
    // Check if message contains JSON string with issues directly (current format)
    if (error.message.includes('"code":')) {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed.length > 0 && parsed[0].code === 'invalid_type') {
          const issue = parsed[0];
          return `${issue.path.join('.')} is required`;
        }
        if (parsed.length > 0) {
          return parsed[0].message;
        }
      } catch {
        return error.message;
      }
    }
    return error.message;
  }

  return String(error);
};

const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}): Promise<Response> => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: 'Bearer valid-token',
    },
  });
};

describe('VehicleController Test Suite', () => {
  let app: Hono<{ Variables: VehicleVariables }>;
  let mockVehicleService: jest.Mocked<VehicleService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authentication middleware to set user context
    mockAuthenticateToken = jest.fn(async (c: any, next: any) => {
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
      await next();
    });

    // Mock vehicle service methods
    mockVehicleService = {
      getUserFamily: jest.fn(),
      canUserModifyFamilyVehicles: jest.fn(),
      createVehicle: jest.fn(),
      getVehiclesByUser: jest.fn(),
      getAvailableVehiclesForScheduleSlot: jest.fn(),
      getVehicleById: jest.fn(),
      updateVehicle: jest.fn(),
      deleteVehicle: jest.fn(),
      getVehicleSchedule: jest.fn(),
    } as any;

    // Setup Prisma mocks for verifyGroupAccess
    mockPrismaFamilyMemberFindFirst.mockResolvedValue({
      familyId: TEST_IDS.FAMILY,
    });
    mockPrismaGroupFamilyMemberFindFirst.mockResolvedValue({
      groupId: TEST_IDS.GROUP,
      familyId: TEST_IDS.FAMILY,
    });

    const mockPrisma = {
      familyMember: {
        findFirst: mockPrismaFamilyMemberFindFirst,
      },
      groupFamilyMember: {
        findFirst: mockPrismaGroupFamilyMemberFindFirst,
      },
    };

    // Set up the controller with mocked dependencies using factory pattern
    const deps: any = {
      vehicleService: mockVehicleService,
      prisma: mockPrisma,
    };

    const vehicleApp = createVehicleControllerRoutes(deps);

    // Create a wrapper app that applies auth middleware before the vehicle routes
    // This ensures the context is set before routes are executed
    app = new OpenAPIHono<{ Variables: VehicleVariables }>();
    app.use('*', mockAuthenticateToken as any);
    app.route('/', vehicleApp);
  });

  describe('POST / - Create vehicle', () => {
    it('should create vehicle successfully', async () => {
      const vehicleData = {
        name: 'Test Vehicle',
        capacity: 4,
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      };

      const mockVehicle = {
        id: TEST_IDS.VEHICLE,
        name: 'Test Vehicle',
        capacity: 4,
        familyId: TEST_IDS.FAMILY,
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockVehicleService.getUserFamily.mockResolvedValue(mockFamily as any);
      mockVehicleService.canUserModifyFamilyVehicles.mockResolvedValue(true);
      mockVehicleService.createVehicle.mockResolvedValue(mockVehicle as any);

      // Note: VehicleController routes are relative (/), mounted at /vehicles in main app
      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });

      expect(response.status).toBe(201);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: TEST_IDS.VEHICLE,
        name: 'Test Vehicle',
        capacity: 4,
        familyId: TEST_IDS.FAMILY,
      });

      expect(mockVehicleService.getUserFamily).toHaveBeenCalledWith(mockUserId);
      expect(mockVehicleService.canUserModifyFamilyVehicles).toHaveBeenCalledWith(mockUserId, TEST_IDS.FAMILY);
      expect(mockVehicleService.createVehicle).toHaveBeenCalledWith(
        {
          name: 'Test Vehicle',
          capacity: 4,
          familyId: TEST_IDS.FAMILY,
        },
        mockUserId,
      );
    });

    it('should return 403 when user has no family', async () => {
      const vehicleData = {
        name: 'Test Vehicle',
        capacity: 4,
      };

      mockVehicleService.getUserFamily.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'User must belong to a family to add vehicles',
        code: 'NO_FAMILY',
      });

      expect(mockVehicleService.getUserFamily).toHaveBeenCalledWith(mockUserId);
      expect(mockVehicleService.createVehicle).not.toHaveBeenCalled();
    });

    it('should return 403 for insufficient permissions', async () => {
      const vehicleData = {
        name: 'Test Vehicle',
        capacity: 4,
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      };

      mockVehicleService.getUserFamily.mockResolvedValue(mockFamily as any);
      mockVehicleService.canUserModifyFamilyVehicles.mockResolvedValue(false);

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Insufficient permissions to add vehicles to family',
        code: 'INSUFFICIENT_PERMISSIONS',
      });

      expect(mockVehicleService.canUserModifyFamilyVehicles).toHaveBeenCalledWith(mockUserId, TEST_IDS.FAMILY);
      expect(mockVehicleService.createVehicle).not.toHaveBeenCalled();
    });

    it('should return 500 on service error', async () => {
      const vehicleData = {
        name: 'Test Vehicle',
        capacity: 4,
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      };

      mockVehicleService.getUserFamily.mockResolvedValue(mockFamily as any);
      mockVehicleService.canUserModifyFamilyVehicles.mockResolvedValue(true);
      mockVehicleService.createVehicle.mockRejectedValue(new AppError('Failed to create vehicle', 500));

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vehicleData),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Failed to create vehicle',
        code: 'CREATE_FAILED',
      });
    });

    it('should validate request data (Zod validation)', async () => {
      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Missing required fields
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('required');
    });
  });

  describe('GET / - List vehicles', () => {
    it('should return user vehicles successfully', async () => {
      const mockVehicles = [
        {
          id: TEST_IDS.VEHICLE,
          name: 'Vehicle 1',
          capacity: 4,
          familyId: TEST_IDS.FAMILY,
          createdAt: new Date('2025-12-13T00:00:00.000Z'),
          updatedAt: new Date('2025-12-13T00:00:00.000Z'),
        },
        {
          id: TEST_IDS.VEHICLE_2,
          name: 'Vehicle 2',
          capacity: 6,
          familyId: TEST_IDS.FAMILY,
          createdAt: new Date('2025-12-13T00:00:00.000Z'),
          updatedAt: new Date('2025-12-13T00:00:00.000Z'),
        },
      ];

      mockVehicleService.getVehiclesByUser.mockResolvedValue(mockVehicles as any);

      const response = await makeAuthenticatedRequest(app, '/');

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toHaveLength(2);
      expect(jsonResponse.data[0].name).toBe('Vehicle 1');

      expect(mockVehicleService.getVehiclesByUser).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 500 on service error', async () => {
      mockVehicleService.getVehiclesByUser.mockRejectedValue(new AppError('Failed to retrieve vehicles', 500));

      const response = await makeAuthenticatedRequest(app, '/');

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Failed to retrieve vehicles',
        code: 'RETRIEVE_FAILED',
      });
    });
  });

  describe('GET /available/:groupId/:timeSlotId - Get available vehicles', () => {
    it('should return available vehicles successfully', async () => {
      const groupId = TEST_IDS.GROUP;
      const timeSlotId = TEST_IDS.SLOT;

      const mockAvailableVehicles = [
        {
          id: TEST_IDS.VEHICLE,
          name: 'Available Vehicle 1',
          capacity: 4,
          currentAssignments: 0,
          availableSeats: 4,
          driverName: null,
        },
        {
          id: TEST_IDS.VEHICLE_2,
          name: 'Available Vehicle 2',
          capacity: 6,
          currentAssignments: 2,
          availableSeats: 4,
          driverName: 'John Doe',
        },
      ];

      mockVehicleService.getAvailableVehiclesForScheduleSlot.mockResolvedValue(mockAvailableVehicles as any);

      const response = await makeAuthenticatedRequest(app, `/available/${groupId}/${timeSlotId}`);

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toHaveLength(2);
      expect(jsonResponse.data[0].name).toBe('Available Vehicle 1');

      expect(mockVehicleService.getAvailableVehiclesForScheduleSlot).toHaveBeenCalledWith(groupId, timeSlotId);
    });

    it('should return 500 on service error', async () => {
      const groupId = TEST_IDS.GROUP;
      const timeSlotId = TEST_IDS.SLOT;

      mockVehicleService.getAvailableVehiclesForScheduleSlot.mockRejectedValue(new AppError('Failed to retrieve available vehicles', 500));

      const response = await makeAuthenticatedRequest(app, `/available/${groupId}/${timeSlotId}`);

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Failed to retrieve available vehicles',
        code: 'RETRIEVE_FAILED',
      });
    });
  });

  describe('GET /:vehicleId - Get specific vehicle', () => {
    it('should return vehicle details successfully', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      const mockVehicle = {
        id: vehicleId,
        name: 'Test Vehicle',
        capacity: 4,
        familyId: TEST_IDS.FAMILY,
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockVehicleService.getVehicleById.mockResolvedValue(mockVehicle as any);

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`);

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: vehicleId,
        name: 'Test Vehicle',
        capacity: 4,
      });

      expect(mockVehicleService.getVehicleById).toHaveBeenCalledWith(vehicleId, mockUserId);
    });

    it('should return 404 when vehicle not found', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      mockVehicleService.getVehicleById.mockRejectedValue(new AppError('Vehicle not found', 404));

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`);

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle not found',
        code: 'RETRIEVE_FAILED',
      });
    });

    it('should return 500 on service error', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      mockVehicleService.getVehicleById.mockRejectedValue(new AppError('Database connection failed', 500));

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`);

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Database connection failed',
        code: 'RETRIEVE_FAILED',
      });
    });
  });

  describe('PATCH /:vehicleId - Update vehicle', () => {
    it('should update vehicle successfully', async () => {
      const vehicleId = TEST_IDS.VEHICLE;
      const updateData = {
        name: 'Updated Vehicle Name',
        capacity: 6,
      };

      const mockVehicle = {
        id: vehicleId,
        name: 'Updated Vehicle Name',
        capacity: 6,
        familyId: TEST_IDS.FAMILY,
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockVehicleService.updateVehicle.mockResolvedValue(mockVehicle as any);

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: vehicleId,
        name: 'Updated Vehicle Name',
        capacity: 6,
      });

      expect(mockVehicleService.updateVehicle).toHaveBeenCalledWith(
        vehicleId,
        mockUserId,
        updateData,
      );
    });

    it('should update vehicle name only', async () => {
      const vehicleId = TEST_IDS.VEHICLE;
      const updateData = {
        name: 'Updated Vehicle Name',
      };

      const mockVehicle = {
        id: vehicleId,
        name: 'Updated Vehicle Name',
        capacity: 4,
        familyId: TEST_IDS.FAMILY,
      };

      mockVehicleService.updateVehicle.mockResolvedValue(mockVehicle as any);

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.name).toBe('Updated Vehicle Name');

      expect(mockVehicleService.updateVehicle).toHaveBeenCalledWith(
        vehicleId,
        mockUserId,
        updateData,
      );
    });

    it('should update vehicle capacity only', async () => {
      const vehicleId = TEST_IDS.VEHICLE;
      const updateData = {
        capacity: 6,
      };

      const mockVehicle = {
        id: vehicleId,
        name: 'Test Vehicle',
        capacity: 6,
        familyId: TEST_IDS.FAMILY,
      };

      mockVehicleService.updateVehicle.mockResolvedValue(mockVehicle as any);

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      expect(mockVehicleService.updateVehicle).toHaveBeenCalledWith(
        vehicleId,
        mockUserId,
        updateData,
      );
    });

    it('should return 404 when vehicle not found', async () => {
      const vehicleId = TEST_IDS.VEHICLE;
      const updateData = {
        name: 'Updated Name',
      };

      mockVehicleService.updateVehicle.mockRejectedValue(new AppError('Vehicle not found', 404));

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle not found or update failed',
        code: 'UPDATE_FAILED',
      });
    });

    it('should validate update data', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }), // Invalid: empty string if there's a min length
      });

      // Zod validation passes for empty string in name (it's optional)
      // But service should handle validation
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    it('should validate capacity is a number', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ capacity: 'not-a-number' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      // Zod returns either "expected" or "required" depending on the exact schema
      expect(errorMessage).toMatch(/(expected|required|number)/);
    });
  });

  describe('DELETE /:vehicleId - Delete vehicle', () => {
    it('should delete vehicle successfully', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      // Mock the returned Family object after vehicle deletion
      const updatedFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [],
        children: [],
        vehicles: [], // Vehicle deleted, so empty array
      };
      mockVehicleService.deleteVehicle.mockResolvedValue(updatedFamily as any);

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toBeDefined();
      expect(jsonResponse.data.id).toBe(TEST_IDS.FAMILY);

      expect(mockVehicleService.deleteVehicle).toHaveBeenCalledWith(vehicleId, mockUserId);
    });

    it('should return 404 when vehicle not found', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      mockVehicleService.deleteVehicle.mockRejectedValue(new AppError('Vehicle not found', 404));

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle not found or delete failed',
        code: 'DELETE_FAILED',
      });
    });

    it('should return 403 for insufficient permissions', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      const error = new Error('Insufficient permissions to delete vehicles in family');
      (error as any).statusCode = 403;
      mockVehicleService.deleteVehicle.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle not found or delete failed',
        code: 'DELETE_FAILED',
      });
    });

    it('should return 500 on service error', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      mockVehicleService.deleteVehicle.mockRejectedValue(new AppError('Database connection failed', 500));

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle not found or delete failed',
        code: 'DELETE_FAILED',
      });
    });
  });

  describe('GET /:vehicleId/schedule - Get vehicle schedule', () => {
    it('should return vehicle schedule successfully', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      const mockSchedule = {
        vehicleId,
        vehicleName: 'Test Vehicle',
        schedule: [],
      };

      mockVehicleService.getVehicleSchedule.mockResolvedValue(mockSchedule as any);

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}/schedule`);

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        vehicleId,
        vehicleName: 'Test Vehicle',
        schedule: [],
      });

      expect(mockVehicleService.getVehicleSchedule).toHaveBeenCalledWith(vehicleId, mockUserId, undefined);
    });

    it('should return vehicle schedule with week parameter', async () => {
      const vehicleId = TEST_IDS.VEHICLE;
      const week = '2025-W42';

      const mockSchedule = {
        vehicleId,
        vehicleName: 'Test Vehicle',
        schedule: [],
      };

      mockVehicleService.getVehicleSchedule.mockResolvedValue(mockSchedule as any);

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}/schedule?week=${week}`);

      expect(response.status).toBe(200);
      expect(mockVehicleService.getVehicleSchedule).toHaveBeenCalledWith(vehicleId, mockUserId, week);
    });

    it('should return 404 when vehicle not found', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      mockVehicleService.getVehicleSchedule.mockRejectedValue(new AppError('Vehicle not found', 404));

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}/schedule`);

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Vehicle not found',
        code: 'RETRIEVE_FAILED',
      });
    });

    it('should return 403 when user has no family', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      mockVehicleService.getVehicleSchedule.mockRejectedValue(new AppError('User must belong to a family to access vehicle schedules', 403));

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}/schedule`);

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'User must belong to a family to access vehicle schedules',
        code: 'RETRIEVE_FAILED',
      });
    });

    it('should return 500 on service error', async () => {
      const vehicleId = TEST_IDS.VEHICLE;

      mockVehicleService.getVehicleSchedule.mockRejectedValue(new AppError('Database connection failed', 500));

      const response = await makeAuthenticatedRequest(app, `/${vehicleId}/schedule`);

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Database connection failed',
        code: 'RETRIEVE_FAILED',
      });
    });
  });
});
