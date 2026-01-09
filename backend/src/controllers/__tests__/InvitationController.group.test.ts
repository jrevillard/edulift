/**
 * InvitationController - Group Endpoints Test Suite
 *
 * Comprehensive tests for group invitation endpoints:
 * - POST /group - Create group invitation
 * - GET /group/:code/validate - Validate group invitation
 * - POST /group/:code/accept - Accept group invitation
 * - DELETE /group/:invitationId - Cancel group invitation
 */

/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { GroupRole } from '@prisma/client';
import { TEST_IDS } from '../../utils/testHelpers';
import { createInvitationControllerRoutes } from '../v1/InvitationController';
import { UnifiedInvitationService } from '../../services/UnifiedInvitationService';
import { EmailService } from '../../services/EmailService';

// Mock all dependencies BEFORE importing controller
jest.mock('../../services/UnifiedInvitationService');
jest.mock('../../services/EmailService');
jest.mock('../../config/database');
jest.mock('../../middleware/auth-hono');

// Helper function to parse response JSON for testing
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

// Helper function to make authenticated requests for protected endpoints
const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}) => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
  });
};

describe('InvitationController - Group Endpoints Test Suite', () => {
  let app: Hono;
  let mockInvitationService: jest.Mocked<UnifiedInvitationService>;
  let mockEmailService: jest.Mocked<EmailService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';
  const mockGroupId = TEST_IDS.GROUP;
  const mockFamilyId = TEST_IDS.FAMILY;
  const mockInvitationId = TEST_IDS.INVITATION;
  const mockInviteCode = 'XYZ5678';

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock UnifiedInvitationService
    mockInvitationService = {
      createFamilyInvitation: jest.fn(),
      validateFamilyInvitation: jest.fn(),
      acceptFamilyInvitation: jest.fn(),
      cancelFamilyInvitation: jest.fn(),
      createGroupInvitation: jest.fn(),
      validateGroupInvitation: jest.fn(),
      acceptGroupInvitation: jest.fn(),
      cancelGroupInvitation: jest.fn(),
      listUserInvitations: jest.fn(),
      getGroupInvitations: jest.fn(),
      cleanupExpiredInvitations: jest.fn(),
    } as any;

    // Mock EmailService
    mockEmailService = {
      sendFamilyInvitation: jest.fn(),
      sendGroupInvitation: jest.fn(),
      sendPasswordReset: jest.fn(),
      sendEmailChangeVerification: jest.fn(),
      sendEmailChangeConfirmation: jest.fn(),
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

    // Create app with mocked dependencies using factory pattern
    const controllerRoutes = createInvitationControllerRoutes({
      invitationService: mockInvitationService,
      emailService: mockEmailService,
    });

    // Mount controller routes to the app
    app.route('/', controllerRoutes);
  });

  // ==========================================================================
  // POST /group - Create Group Invitation
  // ==========================================================================

  describe('POST /group - Success Cases', () => {
    it('should successfully create group invitation with targetFamilyId', async () => {
      const mockInvitation = {
        id: mockInvitationId,
        groupId: mockGroupId,
        targetFamilyId: mockFamilyId,
        role: GroupRole.MEMBER,
        inviteCode: mockInviteCode,
        personalMessage: 'Welcome to our group!',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: mockUserId,
        invitedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInvitationService.createGroupInvitation.mockResolvedValue(mockInvitation as any);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
            personalMessage: 'Welcome to our group!',
          }),
        }
      );

      expect(response.status).toBe(201);
      const json = await responseJson<any>(response);

      expect(json.id).toBe(mockInvitationId);
      expect(json.groupId).toBe(mockGroupId);
      expect(json.targetFamilyId).toBe(mockFamilyId);
      expect(json.role).toBe('MEMBER');
      expect(json.personalMessage).toBe('Welcome to our group!');
      expect(mockInvitationService.createGroupInvitation).toHaveBeenCalledWith(
        mockGroupId,
        {
          targetFamilyId: mockFamilyId,
          role: GroupRole.MEMBER,
          personalMessage: 'Welcome to our group!',
        },
        mockUserId
      );
    });

    it('should successfully create group invitation with email', async () => {
      const mockInvitation = {
        id: mockInvitationId,
        groupId: mockGroupId,
        email: 'user@example.com',
        role: GroupRole.ADMIN,
        inviteCode: mockInviteCode,
        personalMessage: null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: mockUserId,
        invitedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInvitationService.createGroupInvitation.mockResolvedValue(mockInvitation as any);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            email: 'user@example.com',
            role: 'ADMIN',
          }),
        }
      );

      expect(response.status).toBe(201);
      const json = await responseJson<any>(response);

      expect(json.id).toBe(mockInvitationId);
      expect(json.email).toBe('user@example.com');
      expect(json.role).toBe('ADMIN');
    });

    it('should successfully create group invitation with MEMBER role', async () => {
      const mockInvitation = {
        id: mockInvitationId,
        groupId: mockGroupId,
        targetFamilyId: mockFamilyId,
        role: GroupRole.MEMBER,
        inviteCode: mockInviteCode,
        personalMessage: null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: mockUserId,
        invitedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInvitationService.createGroupInvitation.mockResolvedValue(mockInvitation as any);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(201);
      const json = await responseJson<any>(response);
      expect(json.role).toBe('MEMBER');
    });
  });

  describe('POST /group - Error Cases', () => {
    it('should return 400 when groupId is missing', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 when role is missing', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
          }),
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 when neither targetFamilyId nor email provided', async () => {
      const error = new Error('Either targetFamilyId or email must be provided for group invitations');
      mockInvitationService.createGroupInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Either targetFamilyId or email must be provided for group invitations');
      expect(json.code).toBe('INVALID_INPUT');
    });

    it('should return 403 when user is not group admin', async () => {
      const error = new Error('Only group administrators can perform this action');
      mockInvitationService.createGroupInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(403);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Only group administrators can perform this action');
      expect(json.code).toBe('FORBIDDEN');
    });

    it('should return 404 when group not found', async () => {
      const error = new Error('Group not found');
      mockInvitationService.createGroupInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(404);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Group not found');
      expect(json.code).toBe('NOT_FOUND');
    });

    it('should return 404 when target family not found', async () => {
      const error = new Error('Target family not found');
      mockInvitationService.createGroupInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(404);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Target family not found');
      expect(json.code).toBe('NOT_FOUND');
    });

    it('should return 409 when family already member', async () => {
      const error = new Error('Family is already a member of this group');
      mockInvitationService.createGroupInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(409);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Family is already a member of this group');
      expect(json.code).toBe('CONFLICT');
    });

    it('should return 409 when pending invitation exists', async () => {
      const error = new Error('This family already has a pending invitation to this group');
      mockInvitationService.createGroupInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(409);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('This family already has a pending invitation to this group');
      expect(json.code).toBe('CONFLICT');
    });

    it('should return 500 for unexpected errors', async () => {
      mockInvitationService.createGroupInvitation.mockRejectedValue(new Error('Database error'));

      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            targetFamilyId: mockFamilyId,
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(500);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to create group invitation');
      expect(json.code).toBe('CREATE_FAILED');
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            email: 'not-an-email',
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 when email is empty string', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            email: '',
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 when email is whitespace only', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/group',
        {
          method: 'POST',
          body: JSON.stringify({
            groupId: mockGroupId,
            email: '   ',
            role: 'MEMBER',
          }),
        }
      );

      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // GET /group/:code/validate - Validate Group Invitation
  // ==========================================================================

  describe('GET /group/:code/validate - Success Cases', () => {
    it('should successfully validate group invitation', async () => {
      mockInvitationService.validateGroupInvitation.mockResolvedValue({
        valid: true,
        groupId: mockGroupId,
        groupName: 'Test Group',
        email: 'invited@example.com',
      });

      const response = await app.request(`/group/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<any>(response);

      expect(json.valid).toBe(true);
      expect(json.type).toBe('GROUP');
      expect(json.group).toBeDefined();
      expect(json.group.id).toBe(mockGroupId);
      expect(json.group.name).toBe('Test Group');
      expect(json.email).toBe('invited@example.com');
    });

    it('should validate group invitation without authentication', async () => {
      mockInvitationService.validateGroupInvitation.mockResolvedValue({
        valid: true,
        groupId: mockGroupId,
        groupName: 'Test Group',
        email: 'invited@example.com',
      });

      const response = await app.request(`/group/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<any>(response);
      expect(json.valid).toBe(true);
    });

    it('should handle validation without email', async () => {
      mockInvitationService.validateGroupInvitation.mockResolvedValue({
        valid: true,
        groupId: mockGroupId,
        groupName: 'Test Group',
      });

      const response = await app.request(`/group/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<any>(response);
      expect(json.valid).toBe(true);
      expect(json.email).toBeUndefined();
    });
  });

  describe('GET /group/:code/validate - Error Cases', () => {
    it('should return 200 with valid:false when invitation code is invalid', async () => {
      mockInvitationService.validateGroupInvitation.mockResolvedValue({
        valid: false,
        error: 'Invalid invitation code',
      });

      const response = await app.request(`/group/INVALIDCODE/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<{ valid: boolean; type: string; errorCode?: string }>(response);
      expect(json.valid).toBe(false);
      expect(json.type).toBe('GROUP');
      expect(json.errorCode).toBeUndefined();
    });

    it('should return 200 with errorCode when invitation has expired', async () => {
      mockInvitationService.validateGroupInvitation.mockResolvedValue({
        valid: false,
        error: 'Invitation has expired',
        errorCode: 'EXPIRED',
        email: 'invited@example.com',
        inviterName: 'John Doe',
        existingUser: false,
      });

      const response = await app.request(`/group/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<{ valid: boolean; type: string; errorCode?: string }>(response);
      expect(json.valid).toBe(false);
      expect(json.type).toBe('GROUP');
      expect(json.errorCode).toBe('EXPIRED');
    });

    it('should return 200 with errorCode for email mismatch', async () => {
      mockInvitationService.validateGroupInvitation.mockResolvedValue({
        valid: false,
        error: 'This invitation was sent to a different email address. Please log in with the correct account or sign up.',
        errorCode: 'EMAIL_MISMATCH',
        email: 'invited@example.com',
        inviterName: 'John Doe',
        existingUser: false,
      });

      const response = await app.request(`/group/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<{ valid: boolean; type: string; errorCode?: string }>(response);
      expect(json.valid).toBe(false);
      expect(json.type).toBe('GROUP');
      expect(json.errorCode).toBe('EMAIL_MISMATCH');
    });
  });

  // ==========================================================================
  // POST /group/:code/accept - Accept Group Invitation
  // ==========================================================================

  describe('POST /group/:code/accept - Success Cases', () => {
    it('should successfully accept group invitation', async () => {
      mockInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: true,
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInviteCode}/accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ success: boolean; message: string }>(response);

      expect(json.success).toBe(true);
      expect(json.message).toBe('Group invitation accepted successfully');
      expect(mockInvitationService.acceptGroupInvitation).toHaveBeenCalledWith(
        mockInviteCode,
        mockUserId
      );
    });
  });

  describe('POST /group/:code/accept - Error Cases', () => {
    it('should return 400 for invalid invitation code', async () => {
      mockInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: false,
        error: 'Invalid or expired invitation',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/group/INVALIDCODE/accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid or expired invitation');
      expect(json.code).toBe('ACCEPT_FAILED');
    });

    it('should return 400 when family onboarding required', async () => {
      mockInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: false,
        error: 'Family onboarding required',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInviteCode}/accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string; requiresFamilyOnboarding?: boolean }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Family onboarding required');
      expect(json.code).toBe('FAMILY_ONBOARDING_REQUIRED');
      expect(json.requiresFamilyOnboarding).toBe(true);
    });

    it('should return 400 when family already member', async () => {
      mockInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: false,
        error: 'Your family is already a member of Test Group',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInviteCode}/accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Your family is already a member of Test Group');
      expect(json.code).toBe('ACCEPT_FAILED');
    });

    it('should return 400 when user is not family admin', async () => {
      mockInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: false,
        error: 'Only your family admin can accept this invitation. Please contact John Doe.',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInviteCode}/accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Only your family admin can accept this invitation. Please contact John Doe.');
    });

    it('should return 500 for unexpected errors', async () => {
      mockInvitationService.acceptGroupInvitation.mockRejectedValue(new Error('Database error'));

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInviteCode}/accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(500);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to accept group invitation');
      expect(json.code).toBe('ACCEPT_FAILED');
    });
  });

  describe('POST /group/:code/accept - Edge Cases', () => {
    it('should return 404 for empty invite code', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        `/group//accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(404);
    });

    it('should return 400 for invite code with special characters', async () => {
      mockInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: false,
        error: 'Invalid invitation code',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/group/INV@LID$/accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
    });

    it('should return 400 for overly long invite code', async () => {
      const longCode = 'A'.repeat(1000);

      mockInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: false,
        error: 'Invalid invitation code',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${longCode}/accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
    });

    it('should return 400 for invite code with spaces only', async () => {
      mockInvitationService.acceptGroupInvitation.mockResolvedValue({
        success: false,
        error: 'Invalid invitation code',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/group/   /accept`,
        {
          method: 'POST',
        }
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
    });
  });

  // ==========================================================================
  // DELETE /group/:invitationId - Cancel Group Invitation
  // ==========================================================================

  describe('DELETE /group/:invitationId - Success Cases', () => {
    it('should successfully cancel group invitation', async () => {
      mockInvitationService.cancelGroupInvitation.mockResolvedValue(undefined);

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInvitationId}`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ message: string }>(response);

      expect(json.message).toBe('Group invitation cancelled successfully');
      expect(mockInvitationService.cancelGroupInvitation).toHaveBeenCalledWith(
        mockInvitationId,
        mockUserId
      );
    });
  });

  describe('DELETE /group/:invitationId - Error Cases', () => {
    it('should return 403 when user is not group admin', async () => {
      const error = new Error('Only group administrators can cancel invitations');
      mockInvitationService.cancelGroupInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInvitationId}`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(403);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Only group administrators can cancel invitations');
      expect(json.code).toBe('FORBIDDEN');
    });

    it('should return 404 when invitation not found', async () => {
      const error = new Error('Invitation not found');
      mockInvitationService.cancelGroupInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInvitationId}`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(404);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invitation not found');
      expect(json.code).toBe('NOT_FOUND');
    });

    it('should return 500 for unexpected errors', async () => {
      mockInvitationService.cancelGroupInvitation.mockRejectedValue(new Error('Database error'));

      const response = await makeAuthenticatedRequest(
        app,
        `/group/${mockInvitationId}`,
        {
          method: 'DELETE',
        }
      );

      expect(response.status).toBe(500);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to cancel group invitation');
      expect(json.code).toBe('CANCEL_FAILED');
    });
  });
});
