/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import { TEST_IDS } from '../../utils/testHelpers';
import { createChildControllerRoutes } from '../v1/ChildController';
import { AppError } from '../../middleware/errorHandler';

// Mock all dependencies BEFORE importing ChildController
jest.mock('../../services/ChildService');
jest.mock('../../services/ChildAssignmentService');
jest.mock('../../middleware/auth-hono', () => ({
  authenticateToken: jest.fn(),
}));

// Import the mocked classes for typing
import { ChildService } from '../../services/ChildService';
import { ChildAssignmentService } from '../../services/ChildAssignmentService';

// Define ChildVariables type inline (it's not exported from ChildController)
type ChildVariables = {
  userId: string;
  user: { id: string; email: string; name: string; timezone: string };
};

let mockAuthenticateToken: jest.Mock;

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

const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}) => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': 'Bearer valid-token',
    },
  });
};

describe('ChildController Test Suite', () => {
  let app: Hono<{ Variables: ChildVariables }>;
  let mockChildService: jest.Mocked<ChildService>;
  let mockChildAssignmentService: jest.Mocked<ChildAssignmentService>;
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

    // Mock child service methods
    mockChildService = {
      getUserFamily: jest.fn(),
      canUserModifyFamilyChildren: jest.fn(),
      createChild: jest.fn(),
      getChildrenByUser: jest.fn(),
      getChildById: jest.fn(),
      updateChild: jest.fn(),
      deleteChild: jest.fn(),
    } as any;

    // Mock child assignment service methods
    mockChildAssignmentService = {
      addChildToGroup: jest.fn(),
      removeChildFromGroup: jest.fn(),
      getChildGroupMemberships: jest.fn(),
    } as any;

    // Set up the controller with mocked dependencies using factory pattern
    const deps = {
      childService: mockChildService,
      childAssignmentService: mockChildAssignmentService,
    };

    const childApp = createChildControllerRoutes(deps);

    // Create a wrapper app that applies auth middleware before the child routes
    // This ensures the context is set before routes are executed
    app = new OpenAPIHono<{ Variables: ChildVariables }>();
    app.use('*', mockAuthenticateToken as any);
    app.route('/', childApp);
  });

  describe('POST / - Create child', () => {
    it('should create child successfully', async () => {
      const childData = {
        name: 'Test Child',
        age: 8,
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      };

      const mockChild = {
        id: TEST_IDS.CHILD,
        name: 'Test Child',
        age: 8,
        familyId: TEST_IDS.FAMILY,
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockChildService.getUserFamily.mockResolvedValue(mockFamily as any);
      mockChildService.canUserModifyFamilyChildren.mockResolvedValue(true);
      mockChildService.createChild.mockResolvedValue(mockChild as any);

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childData),
      });

      expect(response.status).toBe(201);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: TEST_IDS.CHILD,
        name: 'Test Child',
        age: 8,
        familyId: TEST_IDS.FAMILY,
      });

      expect(mockChildService.getUserFamily).toHaveBeenCalledWith(mockUserId);
      expect(mockChildService.canUserModifyFamilyChildren).toHaveBeenCalledWith(mockUserId, TEST_IDS.FAMILY);
      expect(mockChildService.createChild).toHaveBeenCalledWith({
        name: 'Test Child',
        age: 8,
        familyId: TEST_IDS.FAMILY,
      }, mockUserId);
    });

    it('should create child without age', async () => {
      const childData = {
        name: 'Test Child',
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      };

      const mockChild = {
        id: TEST_IDS.CHILD,
        name: 'Test Child',
        age: null,
        familyId: TEST_IDS.FAMILY,
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockChildService.getUserFamily.mockResolvedValue(mockFamily as any);
      mockChildService.canUserModifyFamilyChildren.mockResolvedValue(true);
      mockChildService.createChild.mockResolvedValue(mockChild as any);

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childData),
      });

      expect(response.status).toBe(201);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.name).toBe('Test Child');
    });

    it('should return 403 when user has no family', async () => {
      const childData = {
        name: 'Test Child',
        age: 8,
      };

      mockChildService.getUserFamily.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childData),
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'User must belong to a family to add children',
        code: 'NO_FAMILY',
      });

      expect(mockChildService.getUserFamily).toHaveBeenCalledWith(mockUserId);
      expect(mockChildService.createChild).not.toHaveBeenCalled();
    });

    it('should return 403 for insufficient permissions', async () => {
      const childData = {
        name: 'Test Child',
        age: 8,
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      };

      mockChildService.getUserFamily.mockResolvedValue(mockFamily as any);
      mockChildService.canUserModifyFamilyChildren.mockResolvedValue(false);

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childData),
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Insufficient permissions to add children to family',
        code: 'INSUFFICIENT_PERMISSIONS',
      });

      expect(mockChildService.canUserModifyFamilyChildren).toHaveBeenCalledWith(mockUserId, TEST_IDS.FAMILY);
      expect(mockChildService.createChild).not.toHaveBeenCalled();
    });

    it('should return 500 on service error', async () => {
      const childData = {
        name: 'Test Child',
        age: 8,
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      };

      mockChildService.getUserFamily.mockResolvedValue(mockFamily as any);
      mockChildService.canUserModifyFamilyChildren.mockResolvedValue(true);
      mockChildService.createChild.mockRejectedValue(new AppError('Database error', 500));

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(childData),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Failed to create child',
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

    it('should validate age is a number', async () => {
      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Child', age: 'not-a-number' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toMatch(/(expected|required|number)/);
    });
  });

  describe('GET / - List children', () => {
    it('should return user children successfully', async () => {
      const mockChildren = [
        {
          id: TEST_IDS.CHILD,
          name: 'Child 1',
          age: 8,
          familyId: TEST_IDS.FAMILY,
          createdAt: new Date('2025-12-13T00:00:00.000Z'),
          updatedAt: new Date('2025-12-13T00:00:00.000Z'),
          groupMemberships: [],
        },
        {
          id: TEST_IDS.CHILD_2,
          name: 'Child 2',
          age: 10,
          familyId: TEST_IDS.FAMILY,
          createdAt: new Date('2025-12-13T00:00:00.000Z'),
          updatedAt: new Date('2025-12-13T00:00:00.000Z'),
          groupMemberships: [],
        },
      ];

      mockChildService.getChildrenByUser.mockResolvedValue(mockChildren as any);

      const response = await makeAuthenticatedRequest(app, '/');

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toHaveLength(2);
      expect(jsonResponse.data[0].name).toBe('Child 1');

      expect(mockChildService.getChildrenByUser).toHaveBeenCalledWith(mockUserId);
    });

    it('should return empty array when user has no children', async () => {
      mockChildService.getChildrenByUser.mockResolvedValue([]);

      const response = await makeAuthenticatedRequest(app, '/');

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toEqual([]);
    });

    it('should return 500 on service error', async () => {
      mockChildService.getChildrenByUser.mockRejectedValue(new AppError('Database error', 500));

      const response = await makeAuthenticatedRequest(app, '/');

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Failed to retrieve children',
        code: 'RETRIEVE_FAILED',
      });
    });
  });

  describe('GET /:childId - Get specific child', () => {
    it('should return child details successfully', async () => {
      const childId = TEST_IDS.CHILD;

      const mockChild = {
        id: childId,
        name: 'Test Child',
        age: 8,
        familyId: TEST_IDS.FAMILY,
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockChildService.getChildById.mockResolvedValue(mockChild as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}`);

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: childId,
        name: 'Test Child',
        age: 8,
      });

      expect(mockChildService.getChildById).toHaveBeenCalledWith(childId, mockUserId);
    });

    it('should return 404 when child not found', async () => {
      const childId = TEST_IDS.CHILD;

      mockChildService.getChildById.mockRejectedValue(new AppError('Child not found or access denied', 404));

      const response = await makeAuthenticatedRequest(app, `/${childId}`);

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found',
        code: 'CHILD_NOT_FOUND',
      });
    });

    it('should return 500 on service error', async () => {
      const childId = TEST_IDS.CHILD;

      mockChildService.getChildById.mockRejectedValue(new AppError('Database connection failed', 500));

      const response = await makeAuthenticatedRequest(app, `/${childId}`);

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found',
        code: 'CHILD_NOT_FOUND',
      });
    });

    it('should validate childId format', async () => {
      const response = await makeAuthenticatedRequest(app, '/invalid-child-id');

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });

  describe('PUT /:childId - Update child (complete)', () => {
    it('should update child successfully', async () => {
      const childId = TEST_IDS.CHILD;
      const updateData = {
        name: 'Updated Child Name',
        age: 9,
      };

      const mockChild = {
        id: childId,
        name: 'Updated Child Name',
        age: 9,
        familyId: TEST_IDS.FAMILY,
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockChildService.updateChild.mockResolvedValue(mockChild as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: childId,
        name: 'Updated Child Name',
        age: 9,
      });

      expect(mockChildService.updateChild).toHaveBeenCalledWith(
        childId,
        mockUserId,
        updateData
      );
    });

    it('should update child name only', async () => {
      const childId = TEST_IDS.CHILD;
      const updateData = {
        name: 'Updated Child Name',
      };

      const mockChild = {
        id: childId,
        name: 'Updated Child Name',
        age: 8,
        familyId: TEST_IDS.FAMILY,
      };

      mockChildService.updateChild.mockResolvedValue(mockChild as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.name).toBe('Updated Child Name');

      expect(mockChildService.updateChild).toHaveBeenCalledWith(
        childId,
        mockUserId,
        updateData
      );
    });

    it('should update child age only', async () => {
      const childId = TEST_IDS.CHILD;
      const updateData = {
        age: 9,
      };

      const mockChild = {
        id: childId,
        name: 'Test Child',
        age: 9,
        familyId: TEST_IDS.FAMILY,
      };

      mockChildService.updateChild.mockResolvedValue(mockChild as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      expect(mockChildService.updateChild).toHaveBeenCalledWith(
        childId,
        mockUserId,
        updateData
      );
    });

    it('should return 400 when no update data provided', async () => {
      const childId = TEST_IDS.CHILD;

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      // Schema refinement requires at least one field
      expect(errorMessage).toMatch(/(At least one field|must be provided)/);
    });

    it('should return 404 when child not found', async () => {
      const childId = TEST_IDS.CHILD;
      const updateData = {
        name: 'Updated Name',
      };

      mockChildService.updateChild.mockRejectedValue(new AppError('Child not found or access denied', 404));

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found or access denied',
        code: 'UPDATE_FAILED',
      });
    });

    it('should validate update data', async () => {
      const childId = TEST_IDS.CHILD;

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age: 'not-a-number' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toMatch(/(expected|required|number)/);
    });
  });

  describe('PATCH /:childId - Update child (partial)', () => {
    it('should update child partially successfully', async () => {
      const childId = TEST_IDS.CHILD;
      const updateData = {
        name: 'Updated Child Name',
      };

      const mockChild = {
        id: childId,
        name: 'Updated Child Name',
        age: 8,
        familyId: TEST_IDS.FAMILY,
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockChildService.updateChild.mockResolvedValue(mockChild as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: childId,
        name: 'Updated Child Name',
      });

      expect(mockChildService.updateChild).toHaveBeenCalledWith(
        childId,
        mockUserId,
        updateData
      );
    });

    it('should return 400 when no update data provided', async () => {
      const childId = TEST_IDS.CHILD;

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      // Schema refinement requires at least one field
      expect(errorMessage).toMatch(/(At least one field|must be provided)/);
    });

    it('should return 404 when child not found', async () => {
      const childId = TEST_IDS.CHILD;
      const updateData = {
        name: 'Updated Name',
      };

      mockChildService.updateChild.mockRejectedValue(new AppError('Child not found or access denied', 404));

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found or access denied',
        code: 'UPDATE_FAILED',
      });
    });

    it('should validate update data', async () => {
      const childId = TEST_IDS.CHILD;

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ age: 'invalid' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toMatch(/(expected|required|number)/);
    });
  });

  describe('DELETE /:childId - Delete child', () => {
    it('should delete child successfully', async () => {
      const childId = TEST_IDS.CHILD;

      // Mock the returned Family object after child deletion
      const updatedFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [],
        children: [], // Child deleted, so empty array
        vehicles: [],
      };
      mockChildService.deleteChild.mockResolvedValue(updatedFamily as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toBeDefined();
      expect(jsonResponse.data.id).toBe(TEST_IDS.FAMILY);

      expect(mockChildService.deleteChild).toHaveBeenCalledWith(childId, mockUserId);
    });

    it('should return 404 when child not found', async () => {
      const childId = TEST_IDS.CHILD;

      mockChildService.deleteChild.mockRejectedValue(new AppError('Child not found or access denied', 404));

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found or access denied',
        code: 'DELETE_FAILED',
      });
    });

    it('should return 403 for insufficient permissions', async () => {
      const childId = TEST_IDS.CHILD;

      const error = new Error('Insufficient permissions to delete children in family');
      (error as any).statusCode = 403;
      mockChildService.deleteChild.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Insufficient permissions to delete children in family',
        code: 'DELETE_FAILED',
      });
    });

    it('should return 500 on service error', async () => {
      const childId = TEST_IDS.CHILD;

      mockChildService.deleteChild.mockRejectedValue(new AppError('Database connection failed', 500));

      const response = await makeAuthenticatedRequest(app, `/${childId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Database connection failed',
        code: 'DELETE_FAILED',
      });
    });

    it('should validate childId format', async () => {
      const response = await makeAuthenticatedRequest(app, '/invalid-child-id', {
        method: 'DELETE',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });

  describe('POST /:childId/groups/:groupId - Add child to group', () => {
    it('should add child to group successfully', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      const mockMembership = {
        id: TEST_IDS.USER,
        childId: childId,
        groupId: groupId,
        addedBy: mockUserId,
        addedAt: new Date('2025-12-13T00:00:00.000Z').toISOString(),
        child: {
          id: childId,
          name: 'Test Child',
        },
        group: {
          id: groupId,
          name: 'Test Group',
        },
      };

      mockChildAssignmentService.addChildToGroup.mockResolvedValue(mockMembership as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'POST',
      });

      expect(response.status).toBe(201);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        childId: childId,
        groupId: groupId,
      });

      expect(mockChildAssignmentService.addChildToGroup).toHaveBeenCalledWith(childId, groupId, mockUserId);
    });

    it('should return 404 when child not found', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      mockChildAssignmentService.addChildToGroup.mockRejectedValue(new AppError('Child not found or permission denied', 404));

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'POST',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found or permission denied',
        code: 'ADD_FAILED',
      });
    });

    it('should return 409 when child already in group', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      mockChildAssignmentService.addChildToGroup.mockRejectedValue(new AppError('Child already assigned to this slot', 409));

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'POST',
      });

      expect(response.status).toBe(409);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child already assigned to this slot',
        code: 'ADD_FAILED',
      });
    });

    it('should return 403 for insufficient permissions', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      const error = new Error('User must be part of a family');
      (error as any).statusCode = 403;
      mockChildAssignmentService.addChildToGroup.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'POST',
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'User must be part of a family',
        code: 'ADD_FAILED',
      });
    });

    it('should return 500 on service error', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      mockChildAssignmentService.addChildToGroup.mockRejectedValue(new AppError('Database connection failed', 500));

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'POST',
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Database connection failed',
        code: 'ADD_FAILED',
      });
    });

    it('should validate childId format', async () => {
      const groupId = TEST_IDS.GROUP;

      const response = await makeAuthenticatedRequest(app, `/invalid-child-id/groups/${groupId}`, {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });

    it('should validate groupId format', async () => {
      const childId = TEST_IDS.CHILD;

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/invalid-group-id`, {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });

  describe('DELETE /:childId/groups/:groupId - Remove child from group', () => {
    it('should remove child from group successfully', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      mockChildAssignmentService.removeChildFromGroup.mockResolvedValue({ success: true } as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: {
          message: 'Child removed from group successfully',
        },
      });

      expect(mockChildAssignmentService.removeChildFromGroup).toHaveBeenCalledWith(childId, groupId, mockUserId);
    });

    it('should return 404 when child not found', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      mockChildAssignmentService.removeChildFromGroup.mockRejectedValue(new AppError('Child not found or permission denied', 404));

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found or permission denied',
        code: 'REMOVE_FAILED',
      });
    });

    it('should return 404 when membership not found', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      mockChildAssignmentService.removeChildFromGroup.mockRejectedValue(new AppError('Child not found or permission denied', 404));

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found or permission denied',
        code: 'REMOVE_FAILED',
      });
    });

    it('should return 500 on service error', async () => {
      const childId = TEST_IDS.CHILD;
      const groupId = TEST_IDS.GROUP;

      mockChildAssignmentService.removeChildFromGroup.mockRejectedValue(new AppError('Database connection failed', 500));

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/${groupId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Database connection failed',
        code: 'REMOVE_FAILED',
      });
    });

    it('should validate childId format', async () => {
      const groupId = TEST_IDS.GROUP;

      const response = await makeAuthenticatedRequest(app, `/invalid-child-id/groups/${groupId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });

    it('should validate groupId format', async () => {
      const childId = TEST_IDS.CHILD;

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups/invalid-group-id`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });

  describe('GET /:childId/groups - Get child group memberships', () => {
    it('should return child group memberships successfully', async () => {
      const childId = TEST_IDS.CHILD;

      const mockMemberships = [
        {
          id: TEST_IDS.USER,
          childId: childId,
          groupId: TEST_IDS.GROUP,
          addedAt: new Date('2025-12-13T00:00:00.000Z').toISOString(),
          group: {
            id: TEST_IDS.GROUP,
            name: 'Group 1',
          },
        },
        {
          id: TEST_IDS.USER_2,
          childId: childId,
          groupId: TEST_IDS.GROUP_2,
          addedAt: new Date('2025-12-13T00:00:00.000Z').toISOString(),
          group: {
            id: TEST_IDS.GROUP_2,
            name: 'Group 2',
          },
        },
      ];

      mockChildAssignmentService.getChildGroupMemberships.mockResolvedValue(mockMemberships as any);

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups`);

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toHaveLength(2);
      expect(jsonResponse.data[0].group.name).toBe('Group 1');

      expect(mockChildAssignmentService.getChildGroupMemberships).toHaveBeenCalledWith(childId, mockUserId);
    });

    it('should return empty array when child has no group memberships', async () => {
      const childId = TEST_IDS.CHILD;

      mockChildAssignmentService.getChildGroupMemberships.mockResolvedValue([]);

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups`);

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toEqual([]);
    });

    it('should return 404 when child not found', async () => {
      const childId = TEST_IDS.CHILD;

      mockChildAssignmentService.getChildGroupMemberships.mockRejectedValue(new AppError('Child not found or permission denied', 404));

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups`);

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Child not found or permission denied',
        code: 'RETRIEVE_FAILED',
      });
    });

    it('should return 500 on service error', async () => {
      const childId = TEST_IDS.CHILD;

      mockChildAssignmentService.getChildGroupMemberships.mockRejectedValue(new AppError('Database connection failed', 500));

      const response = await makeAuthenticatedRequest(app, `/${childId}/groups`);

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Database connection failed',
        code: 'RETRIEVE_FAILED',
      });
    });

    it('should validate childId format', async () => {
      const response = await makeAuthenticatedRequest(app, '/invalid-child-id/groups');

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });
});
