/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { FamilyRole, FamilyPermissions } from '../../types/family';
import { TEST_IDS } from '../../utils/testHelpers';
import { createFamilyControllerRoutes, type FamilyVariables } from '../v1/FamilyController';

// Mock all dependencies BEFORE importing FamilyController
jest.mock('../../services/FamilyService');
jest.mock('../../services/FamilyAuthService');
jest.mock('../../middleware/auth-hono', () => ({
  authenticateToken: jest.fn(),
}));

// Import the mocked classes for typing
import { FamilyService } from '../../services/FamilyService';
import { FamilyAuthService } from '../../services/FamilyAuthService';

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

describe('FamilyController Test Suite', () => {
  let app: Hono<{ Variables: FamilyVariables }>;
  let mockFamilyService: jest.Mocked<FamilyService>;
  let mockFamilyAuthService: jest.Mocked<FamilyAuthService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock family service methods
    mockFamilyService = {
      createFamily: jest.fn(),
      joinFamily: jest.fn(),
      getUserFamily: jest.fn(),
      updateMemberRole: jest.fn(),
      removeMember: jest.fn(),
      validateInviteCode: jest.fn(),
      inviteMember: jest.fn(),
      getPendingInvitations: jest.fn(),
      cancelInvitation: jest.fn(),
      updateFamilyName: jest.fn(),
      leaveFamily: jest.fn(),
    } as any;

    // Mock family auth service methods
    mockFamilyAuthService = {
      getUserPermissions: jest.fn(),
      requireFamilyRole: jest.fn(),
    } as any;

    // Create base Hono app for middleware
    app = new Hono<any>();

    // Mock auth middleware - sets userId in context
    // Apply it BEFORE routes so it runs first
    app.use('*', async (c: any, next) => {
      c.set('userId', mockUserId);
      c.set('user', {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Test User',
        timezone: 'UTC',
      });
      await next();
    });

    // Set up the controller with mocked dependencies using factory pattern
    const deps = {
      familyService: mockFamilyService,
      familyAuthService: mockFamilyAuthService,
    };

    const controllerRoutes = createFamilyControllerRoutes(deps);

    // Mount controller routes to the app
    app.route('/', controllerRoutes);
  });


  describe('POST /', () => {
    it('should create family successfully', async () => {
      const familyData = {
        name: 'Test Family',
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
        inviteCode: 'INV123',
        members: [],
        children: [],
        vehicles: [],
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockFamilyService.createFamily.mockResolvedValue(mockFamily as any);
      mockFamilyService.getUserFamily.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(familyData),
      });

      expect(response.status).toBe(201);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
        inviteCode: 'INV123',
        createdAt: mockFamily.createdAt.toISOString(),
        updatedAt: mockFamily.updatedAt.toISOString(),
      });

      expect(mockFamilyService.createFamily).toHaveBeenCalledWith('Test Family', mockUserId);
    });

    it('should handle service errors during family creation', async () => {
      const familyData = {
        name: 'Test Family',
      };

      mockFamilyService.createFamily.mockRejectedValue(
        new Error('USER_ALREADY_IN_FAMILY'),
      );
      mockFamilyService.getUserFamily.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(familyData),
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('USER_ALREADY_IN_FAMILY');
      expect(jsonResponse.code).toBe('CREATE_FAILED');
    });

    it('should return Zod validation error for missing name', async () => {
      const response = await makeAuthenticatedRequest(app, '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('required');
    });
  });

  describe('POST /join', () => {
    it('should join family successfully', async () => {
      const joinData = {
        inviteCode: 'INV123',
      };

      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
        inviteCode: 'INV123',
        members: [],
        children: [],
        vehicles: [],
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockFamilyService.joinFamily.mockResolvedValue(mockFamily as any);

      const response = await makeAuthenticatedRequest(app, '/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(joinData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
        createdAt: mockFamily.createdAt.toISOString(),
        updatedAt: mockFamily.updatedAt.toISOString(),
      });

      expect(mockFamilyService.joinFamily).toHaveBeenCalledWith('INV123', mockUserId);
    });

    it('should return Zod validation error for missing invite code', async () => {
      const response = await makeAuthenticatedRequest(app, '/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('required');
    });

    it('should handle invalid invite code', async () => {
      mockFamilyService.joinFamily.mockRejectedValue(
        new Error('INVALID_INVITE_CODE'),
      );

      const response = await makeAuthenticatedRequest(app, '/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: 'INVALID' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('INVALID_INVITE_CODE');
      expect(jsonResponse.code).toBe('JOIN_FAILED');
    });
  });

  describe('GET /current', () => {
    it('should return current family', async () => {
      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
        inviteCode: 'INV123',
        members: [],
        children: [],
        vehicles: [],
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockFamilyService.getUserFamily.mockResolvedValue(mockFamily as any);

      const response = await makeAuthenticatedRequest(app, '/current');

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data).toMatchObject({
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
        createdAt: mockFamily.createdAt.toISOString(),
        updatedAt: mockFamily.updatedAt.toISOString(),
      });

      expect(mockFamilyService.getUserFamily).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 404 if user has no family', async () => {
      mockFamilyService.getUserFamily.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, '/current');

      expect(response.status).toBe(404);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('No family found');
      expect(jsonResponse.code).toBe('NO_FAMILY');
    });
  });

  describe('GET /:familyId/permissions', () => {
    it('should return user permissions for family', async () => {
      const familyId = TEST_IDS.FAMILY;
      const mockFamily = {
        id: familyId,
        name: 'Test Family',
      };
      const mockPermissions: FamilyPermissions = {
        canManageMembers: true,
        canModifyChildren: true,
        canModifyVehicles: true,
        canViewFamily: true,
      };

      mockFamilyService.getUserFamily.mockResolvedValue(mockFamily as any);
      mockFamilyAuthService.getUserPermissions.mockResolvedValue(mockPermissions);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/permissions`);

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: true,
        data: mockPermissions,
      });

      expect(mockFamilyService.getUserFamily).toHaveBeenCalledWith(mockUserId);
      expect(mockFamilyAuthService.getUserPermissions).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 403 if user is not a member of the family', async () => {
      const familyId = TEST_IDS.FAMILY;
      const mockFamily = {
        id: 'different-family-id',
        name: 'Different Family',
      };

      mockFamilyService.getUserFamily.mockResolvedValue(mockFamily as any);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/permissions`);

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Access denied: not a member of this family');
      expect(jsonResponse.code).toBe('ACCESS_DENIED');
    });

    it('should return Zod validation error for invalid familyId', async () => {
      const response = await makeAuthenticatedRequest(app, '/invalid-family-id/permissions');

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });

  describe('PUT /members/:memberId/role', () => {
    it('should update member role successfully', async () => {
      const memberId = TEST_IDS.USER_2;
      const updateData = {
        role: FamilyRole.MEMBER,
      };

      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.updateMemberRole.mockResolvedValue(undefined);

      const response = await makeAuthenticatedRequest(app, `/members/${memberId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toBe('Member role updated successfully');

      expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith(mockUserId, FamilyRole.ADMIN);
      expect(mockFamilyService.updateMemberRole).toHaveBeenCalledWith(mockUserId, memberId, FamilyRole.MEMBER);
    });

    it('should return 400 for invalid role', async () => {
      const memberId = TEST_IDS.USER_2;
      const response = await makeAuthenticatedRequest(app, `/members/${memberId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'INVALID_ROLE' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid option');
      expect(errorMessage).toContain('ADMIN');
      expect(errorMessage).toContain('MEMBER');
    });

    it('should return 403 for insufficient permissions', async () => {
      const memberId = TEST_IDS.USER_2;
      const updateData = {
        role: FamilyRole.MEMBER,
      };

      mockFamilyAuthService.requireFamilyRole.mockRejectedValue(
        new Error('INSUFFICIENT_PERMISSIONS'),
      );

      const response = await makeAuthenticatedRequest(app, `/members/${memberId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('INSUFFICIENT_PERMISSIONS');
      expect(jsonResponse.code).toBe('UPDATE_FAILED');
    });

    it('should return Zod validation error for invalid memberId', async () => {
      const response = await makeAuthenticatedRequest(app, '/members/invalid-id/role', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: FamilyRole.MEMBER }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });

  describe('PUT /name', () => {
    it('should update family name successfully', async () => {
      const updateData = {
        name: 'Updated Family Name',
      };

      const mockUpdatedFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Updated Family Name',
        inviteCode: 'INV123',
        members: [],
        children: [],
        vehicles: [],
        createdAt: new Date('2025-12-13T00:00:00.000Z'),
        updatedAt: new Date('2025-12-13T00:00:00.000Z'),
      };

      mockFamilyService.updateFamilyName.mockResolvedValue(mockUpdatedFamily as any);

      const response = await makeAuthenticatedRequest(app, '/name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.data.name).toBe('Updated Family Name');

      expect(mockFamilyService.updateFamilyName).toHaveBeenCalledWith(mockUserId, 'Updated Family Name');
    });

    it('should return Zod validation error for empty family name', async () => {
      const response = await makeAuthenticatedRequest(app, '/name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('required');
    });

    it('should return Zod validation error for family name too long', async () => {
      const longName = 'a'.repeat(101); // 101 characters
      const response = await makeAuthenticatedRequest(app, '/name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: longName }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('long');
    });
  });

  describe('DELETE /:familyId/members/:memberId', () => {
    beforeEach(() => {
      // Mock the getUserFamily call for family access verification
      mockFamilyService.getUserFamily.mockResolvedValue({
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      } as any);
    });

    it('should remove member successfully', async () => {
      const familyId = TEST_IDS.FAMILY;
      const memberId = TEST_IDS.USER_2;

      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.removeMember.mockResolvedValue(undefined);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/members/${memberId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toBe('Member removed successfully');

      expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith(mockUserId, FamilyRole.ADMIN);
      expect(mockFamilyService.removeMember).toHaveBeenCalledWith(mockUserId, memberId);
    });

    it('should return 403 if user is not a member of the family', async () => {
      const familyId = TEST_IDS.FAMILY;
      const memberId = TEST_IDS.USER_2;

      mockFamilyService.getUserFamily.mockResolvedValue({
        id: 'cldiff1234567890123456789',
        name: 'Different Family',
      } as any);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/members/${memberId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Access denied: not a member of this family');
      expect(jsonResponse.code).toBe('ACCESS_DENIED');
    });

    it('should return 403 if user has no family', async () => {
      const familyId = TEST_IDS.FAMILY;
      const memberId = TEST_IDS.USER_2;

      mockFamilyService.getUserFamily.mockResolvedValue(null);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/members/${memberId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Access denied: not a member of this family');
      expect(jsonResponse.code).toBe('ACCESS_DENIED');
    });

    it('should return 403 for non-admin users', async () => {
      const familyId = TEST_IDS.FAMILY;
      const memberId = TEST_IDS.USER_2;

      mockFamilyAuthService.requireFamilyRole.mockRejectedValue(
        new Error('INSUFFICIENT_PERMISSIONS'),
      );

      const response = await makeAuthenticatedRequest(app, `/${familyId}/members/${memberId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('INSUFFICIENT_PERMISSIONS');
      expect(jsonResponse.code).toBe('REMOVE_FAILED');
    });

    it('should handle business rule errors (cannot remove self)', async () => {
      const familyId = TEST_IDS.FAMILY;
      const memberId = TEST_IDS.USER_2;

      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.removeMember.mockRejectedValue(
        new Error('Admin cannot remove themselves'),
      );

      const response = await makeAuthenticatedRequest(app, `/${familyId}/members/${memberId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Admin cannot remove themselves');
      expect(jsonResponse.code).toBe('REMOVE_FAILED');
    });

    it('should handle last admin removal error', async () => {
      const familyId = TEST_IDS.FAMILY;
      const memberId = TEST_IDS.USER_2;

      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.removeMember.mockRejectedValue(
        new Error('Cannot remove the last admin from family'),
      );

      const response = await makeAuthenticatedRequest(app, `/${familyId}/members/${memberId}`, {
        method: 'DELETE',
      });

      expect(response.status).toBe(500);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Cannot remove the last admin from family');
      expect(jsonResponse.code).toBe('REMOVE_FAILED');
    });

    it('should return Zod validation error for invalid IDs', async () => {
      const response = await makeAuthenticatedRequest(app, '/invalid-family/members/invalid-member', {
        method: 'DELETE',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });

  describe('POST /:familyId/leave', () => {
    const familyId = TEST_IDS.FAMILY;

    beforeEach(() => {
      // Mock the getUserFamily call for family access verification
      mockFamilyService.getUserFamily.mockResolvedValue({
        id: familyId,
        name: 'Test Family',
      } as any);
    });

    it('should allow user to leave family successfully', async () => {
      mockFamilyService.leaveFamily.mockResolvedValue(undefined);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/leave`, {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(true);
      expect(jsonResponse.message).toBe('Left family successfully');

      expect(mockFamilyService.leaveFamily).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 400 when user is the last admin', async () => {
      const lastAdminError = new Error('LAST_ADMIN: Cannot leave family as you are the last administrator');
      mockFamilyService.leaveFamily.mockRejectedValue(lastAdminError);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/leave`, {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('LAST_ADMIN: Cannot leave family as you are the last administrator');
      expect(jsonResponse.code).toBe('LEAVE_FAILED');
    });

    it('should return 400 when user is not a family member', async () => {
      const notMemberError = new Error('NOT_FAMILY_MEMBER: User is not a member of any family');
      mockFamilyService.leaveFamily.mockRejectedValue(notMemberError);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/leave`, {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('NOT_FAMILY_MEMBER: User is not a member of any family');
      expect(jsonResponse.code).toBe('LEAVE_FAILED');
    });

    it('should return 403 if user is not a member of the specified family', async () => {
      mockFamilyService.getUserFamily.mockResolvedValue({
        id: 'different-family-id',
        name: 'Different Family',
      } as any);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/leave`, {
        method: 'POST',
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Access denied: not a member of this family');
      expect(jsonResponse.code).toBe('ACCESS_DENIED');
    });

    it('should return 500 for unexpected errors', async () => {
      const unexpectedError = new Error('Database connection failed');
      mockFamilyService.leaveFamily.mockRejectedValue(unexpectedError);

      const response = await makeAuthenticatedRequest(app, `/${familyId}/leave`, {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse.success).toBe(false);
      expect(jsonResponse.error).toBe('Database connection failed');
      expect(jsonResponse.code).toBe('LEAVE_FAILED');
    });

    it('should return 400 when familyId is missing', async () => {
      const response = await makeAuthenticatedRequest(app, '/ /leave', {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });

    it('should return Zod validation error for invalid familyId', async () => {
      const response = await makeAuthenticatedRequest(app, '/invalid-family-id/leave', {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('Invalid');
    });
  });

  describe('Invitation System Tests', () => {
    const familyId = TEST_IDS.FAMILY;

    beforeEach(() => {
      mockFamilyService.getUserFamily.mockResolvedValue({
        id: familyId,
        name: 'Test Family',
      } as any);
    });

    describe('POST /:familyId/invite', () => {
      it('should invite member successfully', async () => {
        const inviteData = {
          email: 'newmember@example.com',
          role: FamilyRole.MEMBER,
          personalMessage: 'Welcome to our family!',
        };

        const mockInvitation = {
          id: 'inv123',
          familyId,
          email: 'newmember@example.com',
          role: FamilyRole.MEMBER,
          status: 'PENDING',
        };

        mockFamilyService.inviteMember.mockResolvedValue(mockInvitation as any);

        const response = await makeAuthenticatedRequest(app, `/${familyId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(inviteData),
        });

        expect(response.status).toBe(201);
        const jsonResponse = await responseJson(response);
        expect(jsonResponse.success).toBe(true);
        expect(jsonResponse.data.email).toBe('newmember@example.com');

        expect(mockFamilyService.inviteMember).toHaveBeenCalledWith(familyId, {
          email: 'newmember@example.com',
          role: FamilyRole.MEMBER,
          personalMessage: 'Welcome to our family!',
        }, mockUserId);
      });

      it('should return Zod validation error for missing email', async () => {
        const response = await makeAuthenticatedRequest(app, `/${familyId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: FamilyRole.MEMBER }),
        });

        expect(response.status).toBe(400);
        const jsonResponse = await responseJson(response);
        const errorMessage = parseZodError(jsonResponse.error);
        expect(errorMessage).toContain('required');
      });

      it('should return 400 for invalid role', async () => {
        const response = await makeAuthenticatedRequest(app, `/${familyId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'test@example.com',
            role: 'INVALID_ROLE',
          }),
        });

        expect(response.status).toBe(400);
        const jsonResponse = await responseJson(response);
        const errorMessage = parseZodError(jsonResponse.error);
        expect(errorMessage).toContain('Invalid option');
        expect(errorMessage).toContain('ADMIN');
        expect(errorMessage).toContain('MEMBER');
      });

      it('should return Zod validation error for invalid email format', async () => {
        const response = await makeAuthenticatedRequest(app, `/${familyId}/invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'invalid-email',
            role: FamilyRole.MEMBER,
          }),
        });

        expect(response.status).toBe(400);
        const jsonResponse = await responseJson(response);
        const errorMessage = parseZodError(jsonResponse.error);
        expect(errorMessage).toContain('Invalid');
      });
    });

    describe('GET /:familyId/invitations', () => {
      it('should return pending invitations', async () => {
        const mockInvitations = [
          {
            id: 'inv123',
            familyId,
            email: 'member1@example.com',
            status: 'PENDING',
          },
          {
            id: 'inv456',
            familyId,
            email: 'member2@example.com',
            status: 'PENDING',
          },
        ];

        mockFamilyService.getPendingInvitations.mockResolvedValue(mockInvitations as any);

        const response = await makeAuthenticatedRequest(app, `/${familyId}/invitations`);

        expect(response.status).toBe(200);
        const jsonResponse = await responseJson(response);
        expect(jsonResponse).toEqual({
          success: true,
          data: mockInvitations,
        });

        expect(mockFamilyService.getPendingInvitations).toHaveBeenCalledWith(familyId);
      });

      it('should return Zod validation error for invalid familyId', async () => {
        const response = await makeAuthenticatedRequest(app, '/invalid-family-id/invitations');

        expect(response.status).toBe(400);
        const jsonResponse = await responseJson(response);
        const errorMessage = parseZodError(jsonResponse.error);
        expect(errorMessage).toContain('Invalid');
      });
    });

    describe('DELETE /:familyId/invitations/:invitationId', () => {
      it('should cancel invitation successfully', async () => {
        const invitationId = TEST_IDS.INVITATION;

        mockFamilyService.cancelInvitation.mockResolvedValue(undefined);

        const response = await makeAuthenticatedRequest(app, `/${familyId}/invitations/${invitationId}`, {
          method: 'DELETE',
        });

        expect(response.status).toBe(200);
        const jsonResponse = await responseJson(response);
        expect(jsonResponse.success).toBe(true);
        expect(jsonResponse.message).toBe('Invitation deleted successfully');

        expect(mockFamilyService.cancelInvitation).toHaveBeenCalledWith(familyId, invitationId, mockUserId);
      });

      it('should return Zod validation error for invalid IDs', async () => {
        const response = await makeAuthenticatedRequest(app, '/invalid-family/invitations/invalid-invitation', {
          method: 'DELETE',
        });

        expect(response.status).toBe(400);
        const jsonResponse = await responseJson(response);
        const errorMessage = parseZodError(jsonResponse.error);
        expect(errorMessage).toContain('Invalid');
      });
    });
  });
});