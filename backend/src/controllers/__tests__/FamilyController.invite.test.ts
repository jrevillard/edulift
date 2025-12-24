/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { FamilyRole } from '../../types/family';
import { TEST_IDS } from '../../utils/testHelpers';
import { createFamilyControllerWithDeps, type FamilyVariables } from '../FamilyController';

// Mock all dependencies BEFORE importing FamilyController
jest.mock('../../services/FamilyService');
jest.mock('../../services/FamilyAuthService');
jest.mock('../../middleware/auth-hono', () => ({
  authenticateToken: jest.fn(),
}));

// Import the mocked classes for typing
import { FamilyService } from '../../services/FamilyService';
import { FamilyAuthService } from '../../services/FamilyAuthService';

let mockAuthenticateToken: jest.Mock;

// Helper function to parse response JSON for testing
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

// Helper function to parse Zod validation errors into readable messages
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

// Helper function to make authenticated requests for protected endpoints
const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}) => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': 'Bearer valid-token',
    },
  });
};

describe('FamilyController Invitation System Test Suite', () => {
  let app: Hono<{ Variables: FamilyVariables }>;
  let mockFamilyService: jest.Mocked<FamilyService>;
  let mockFamilyAuthService: jest.Mocked<FamilyAuthService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock authentication middleware to set user context for protected routes
    // Allow public endpoints to pass through without authentication
    mockAuthenticateToken = jest.fn((c: any, next: any) => {
      const path = c.req.path;

      // Skip authentication for public endpoints
      if (path === '/validate-invite') {
        return next();
      }

      // Require valid bearer token for protected endpoints
      const authHeader = c.req.header('authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Access token required' }, 401);
      }

      // Set authenticated user context
      c.set('userId', mockUserId);
      c.set('user', {
        id: mockUserId,
        email: mockUserEmail,
        name: 'Test User',
        timezone: 'UTC',
      });
      return next();
    });

    // Mock family service methods for invitation functionality
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

    // Mock family auth service methods for permission checking
    mockFamilyAuthService = {
      requireFamilyRole: jest.fn(),
      requireFamilyPermission: jest.fn(),
      verifyFamilyMembership: jest.fn(),
    } as any;

    // Create app with mocked dependencies
    const deps = {
      familyService: mockFamilyService,
      familyAuthService: mockFamilyAuthService,
    };

    app = createFamilyControllerWithDeps(deps);

    // Mock the auth middleware AFTER setting up the app
    const { authenticateToken } = require('../../middleware/auth-hono');
    authenticateToken.mockImplementation(mockAuthenticateToken);
  });

  describe('POST /validate-invite - Public endpoint', () => {
    it('should validate invite code successfully', async () => {
      const inviteCode = 'INV123';
      const mockFamily = {
        id: TEST_IDS.FAMILY,
        name: 'Test Family',
      };

      mockFamilyService.validateInviteCode.mockResolvedValue(mockFamily as any);

      // Use direct app.request for public endpoint (no auth required)
      const response = await app.request('/validate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode }),
      });

      const jsonResponse = await responseJson(response);
      expect(response.status).toBe(200);
      expect(jsonResponse).toEqual({
        success: true,
        data: {
          valid: true,
          family: {
            id: TEST_IDS.FAMILY,
            name: 'Test Family',
          },
        },
      });

      expect(mockFamilyService.validateInviteCode).toHaveBeenCalledWith('INV123');
    });

    it('should return error for invalid invite code', async () => {
      mockFamilyService.validateInviteCode.mockResolvedValue(null);

      const response = await app.request('/validate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: 'INVALID' }),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Invalid or expired invite code',
        data: {
          valid: false,
        },
      });
    });

    it('should return Zod validation error for missing invite code', async () => {
      const response = await app.request('/validate-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);

      const errorMessage = parseZodError(jsonResponse.error);
      expect(errorMessage).toContain('inviteCode');
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
      expect(jsonResponse).toEqual({
        success: false,
        error: 'INVALID_INVITE_CODE',
      });
    });
  });

  describe('POST /invite-code', () => {
    it('should reject permanent invite code generation (deprecated functionality)', async () => {
      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);

      const response = await makeAuthenticatedRequest(app, '/invite-code', {
        method: 'POST',
      });

      expect(response.status).toBe(400);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'Permanent invite codes are no longer supported. Use invitation system instead.',
      });

      expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith(mockUserId, FamilyRole.ADMIN);
    });

    it('should return 403 for non-admin users', async () => {
      mockFamilyAuthService.requireFamilyRole.mockRejectedValue(
        new Error('INSUFFICIENT_PERMISSIONS'),
      );

      const response = await makeAuthenticatedRequest(app, '/invite-code', {
        method: 'POST',
      });

      expect(response.status).toBe(403);
      const jsonResponse = await responseJson(response);
      expect(jsonResponse).toEqual({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
      });
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

        mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
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

        expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith(mockUserId, FamilyRole.ADMIN);
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

        mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
        mockFamilyService.cancelInvitation.mockResolvedValue(undefined);

        const response = await makeAuthenticatedRequest(app, `/${familyId}/invitations/${invitationId}`, {
          method: 'DELETE',
        });

        expect(response.status).toBe(200);
        const jsonResponse = await responseJson(response);
        expect(jsonResponse).toEqual({
          success: true,
          data: {
            message: 'Invitation cancelled successfully',
          },
        });

        expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith(mockUserId, FamilyRole.ADMIN);
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