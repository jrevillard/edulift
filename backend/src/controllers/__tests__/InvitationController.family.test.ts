/**
 * InvitationController - Family Endpoints Test Suite
 *
 * Comprehensive tests for family invitation endpoints:
 * - POST /family - Create family invitation
 * - GET /family/:code/validate - Validate family invitation
 * - POST /family/:code/accept - Accept family invitation
 * - DELETE /family/:invitationId - Cancel family invitation
 */

/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { FamilyRole } from '@prisma/client';
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
const makeAuthenticatedRequest = (app: Hono<any>, url: string, options: RequestInit = {}): Promise<Response> => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: 'Bearer valid-token',
      'Content-Type': 'application/json',
    },
  });
};

describe('InvitationController - Family Endpoints Test Suite', () => {
  let app: Hono;
  let mockInvitationService: jest.Mocked<UnifiedInvitationService>;
  let mockEmailService: jest.Mocked<EmailService>;
  const mockUserId = TEST_IDS.USER;
  const mockUserEmail = 'test@example.com';
  const mockFamilyId = TEST_IDS.FAMILY;
  const mockInvitationId = TEST_IDS.INVITATION;
  const mockInviteCode = 'ABC1234';

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
  // POST /family - Create Family Invitation
  // ==========================================================================

  describe('POST /family - Success Cases', () => {
    it('should successfully create family invitation with email', async () => {
      const mockInvitation = {
        id: mockInvitationId,
        familyId: mockFamilyId,
        email: 'invited@example.com',
        role: FamilyRole.MEMBER,
        inviteCode: mockInviteCode,
        personalMessage: 'Welcome to our family!',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: mockUserId,
        invitedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInvitationService.createFamilyInvitation.mockResolvedValue(mockInvitation as any);

      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'invited@example.com',
            role: 'MEMBER',
            personalMessage: 'Welcome to our family!',
          }),
        },
      );

      expect(response.status).toBe(201);
      const json = await responseJson<any>(response);

      expect(json.id).toBe(mockInvitationId);
      expect(json.familyId).toBe(mockFamilyId);
      expect(json.email).toBe('invited@example.com');
      expect(json.role).toBe('MEMBER');
      expect(json.personalMessage).toBe('Welcome to our family!');
      expect(mockInvitationService.createFamilyInvitation).toHaveBeenCalledWith(
        mockFamilyId,
        {
          email: 'invited@example.com',
          role: FamilyRole.MEMBER,
          personalMessage: 'Welcome to our family!',
        },
        mockUserId,
      );
    });

    it('should successfully create family invitation with ADMIN role', async () => {
      const mockInvitation = {
        id: mockInvitationId,
        familyId: mockFamilyId,
        email: 'invited@example.com',
        role: FamilyRole.ADMIN,
        inviteCode: mockInviteCode,
        personalMessage: null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: mockUserId,
        invitedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInvitationService.createFamilyInvitation.mockResolvedValue(mockInvitation as any);

      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'invited@example.com',
            role: 'ADMIN',
          }),
        },
      );

      expect(response.status).toBe(201);
      const json = await responseJson<any>(response);

      expect(json.id).toBe(mockInvitationId);
      expect(json.role).toBe('ADMIN');
    });

    it('should successfully create family invitation without personalMessage', async () => {
      const mockInvitation = {
        id: mockInvitationId,
        familyId: mockFamilyId,
        email: 'invited@example.com',
        role: FamilyRole.MEMBER,
        inviteCode: mockInviteCode,
        personalMessage: null,
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdBy: mockUserId,
        invitedBy: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockInvitationService.createFamilyInvitation.mockResolvedValue(mockInvitation as any);

      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'invited@example.com',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(201);
      const json = await responseJson<any>(response);

      expect(json.id).toBe(mockInvitationId);
      expect(mockInvitationService.createFamilyInvitation).toHaveBeenCalledWith(
        mockFamilyId,
        {
          email: 'invited@example.com',
          role: FamilyRole.MEMBER,
        },
        mockUserId,
      );
    });
  });

  describe('POST /family - Error Cases', () => {
    it('should return 400 when familyId is missing', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            email: 'invited@example.com',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 when email is missing', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 when role is missing', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'invited@example.com',
          }),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 403 when user is not family admin', async () => {
      const error = new Error('Only family administrators can send invitations');
      mockInvitationService.createFamilyInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'invited@example.com',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(403);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Only family administrators can send invitations');
      expect(json.code).toBe('FORBIDDEN');
    });

    it('should return 409 when user already a member', async () => {
      const error = new Error('User is already a member of this family');
      mockInvitationService.createFamilyInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'invited@example.com',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(409);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('User is already a member of this family');
      expect(json.code).toBe('CONFLICT');
    });

    it('should return 409 when family has reached capacity', async () => {
      const error = new Error('Family has reached maximum capacity (6 members)');
      mockInvitationService.createFamilyInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'invited@example.com',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(409);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Family has reached maximum capacity (6 members)');
      expect(json.code).toBe('CONFLICT');
    });

    it('should return 500 for unexpected errors', async () => {
      mockInvitationService.createFamilyInvitation.mockRejectedValue(new Error('Database error'));

      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'invited@example.com',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(500);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to create family invitation');
      expect(json.code).toBe('CREATE_FAILED');
    });

    it('should return 400 when email format is invalid', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: 'not-an-email',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 when email is empty string', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: '',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(400);
    });

    it('should return 400 when email is whitespace only', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/family',
        {
          method: 'POST',
          body: JSON.stringify({
            familyId: mockFamilyId,
            email: '   ',
            role: 'MEMBER',
          }),
        },
      );

      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // GET /family/:code/validate - Validate Family Invitation
  // ==========================================================================

  describe('GET /family/:code/validate - Success Cases', () => {
    it('should successfully validate family invitation', async () => {
      mockInvitationService.validateFamilyInvitation.mockResolvedValue({
        valid: true,
        familyId: mockFamilyId,
        familyName: 'Test Family',
        role: FamilyRole.MEMBER,
        email: 'invited@example.com',
        personalMessage: 'Welcome to our family!',
      });

      const response = await app.request(`/family/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<any>(response);

      expect(json.valid).toBe(true);
      expect(json.type).toBe('FAMILY');
      expect(json.family).toBeDefined();
      expect(json.family.id).toBe(mockFamilyId);
      expect(json.family.name).toBe('Test Family');
      expect(json.email).toBe('invited@example.com');
      expect(json.role).toBe(FamilyRole.MEMBER);
      expect(json.personalMessage).toBe('Welcome to our family!');
    });

    it('should validate family invitation without authentication', async () => {
      mockInvitationService.validateFamilyInvitation.mockResolvedValue({
        valid: true,
        familyId: mockFamilyId,
        familyName: 'Test Family',
        role: FamilyRole.MEMBER,
        email: 'invited@example.com',
      });

      const response = await app.request(`/family/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<any>(response);
      expect(json.valid).toBe(true);
    });

    it('should handle validation without personalMessage', async () => {
      const validationResult = {
        valid: true,
        familyId: mockFamilyId,
        familyName: 'Test Family',
        role: FamilyRole.MEMBER,
        email: 'invited@example.com',
      };
      mockInvitationService.validateFamilyInvitation.mockResolvedValue(validationResult as any);

      const response = await app.request(`/family/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<any>(response);
      expect(json.personalMessage).toBeUndefined();
    });
  });

  describe('GET /family/:code/validate - Error Cases', () => {
    it('should return 200 with valid:false when invitation code is invalid', async () => {
      mockInvitationService.validateFamilyInvitation.mockResolvedValue({
        valid: false,
        error: 'Invalid invitation code',
      });

      const response = await app.request('/family/INVALIDCODE/validate', {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<{ valid: boolean; type: string; errorCode?: string }>(response);
      expect(json.valid).toBe(false);
      expect(json.type).toBe('FAMILY');
      expect(json.errorCode).toBeUndefined();
    });

    it('should return 200 with errorCode when invitation has expired', async () => {
      mockInvitationService.validateFamilyInvitation.mockResolvedValue({
        valid: false,
        error: 'Invitation has expired',
        errorCode: 'EXPIRED',
        email: 'invited@example.com',
        inviterName: 'John Doe',
        existingUser: false,
      });

      const response = await app.request(`/family/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<{ valid: boolean; type: string; errorCode?: string }>(response);
      expect(json.valid).toBe(false);
      expect(json.type).toBe('FAMILY');
      expect(json.errorCode).toBe('EXPIRED');
    });

    it('should return 200 with errorCode for email mismatch', async () => {
      mockInvitationService.validateFamilyInvitation.mockResolvedValue({
        valid: false,
        error: 'This invitation was sent to a different email address. Please log in with the correct account or sign up.',
        errorCode: 'EMAIL_MISMATCH',
        email: 'invited@example.com',
        inviterName: 'John Doe',
        existingUser: false,
      });

      const response = await app.request(`/family/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const json = await responseJson<{ valid: boolean; type: string; errorCode?: string }>(response);
      expect(json.valid).toBe(false);
      expect(json.type).toBe('FAMILY');
      expect(json.errorCode).toBe('EMAIL_MISMATCH');
    });

    it('should return 500 for validation errors', async () => {
      mockInvitationService.validateFamilyInvitation.mockRejectedValue(new Error('Database connection failed'));

      const response = await app.request(`/family/${mockInviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Validation failed');
      expect(json.code).toBe('VALIDATION_FAILED');
    });
  });

  // ==========================================================================
  // POST /family/:code/accept - Accept Family Invitation
  // ==========================================================================

  describe('POST /family/:code/accept - Success Cases', () => {
    it('should successfully accept family invitation', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: true,
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            leaveCurrentFamily: false,
          }),
        },
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ success: boolean; message: string }>(response);

      expect(json.success).toBe(true);
      expect(json.message).toBe('Family invitation accepted successfully');
      expect(mockInvitationService.acceptFamilyInvitation).toHaveBeenCalledWith(
        mockInviteCode,
        mockUserId,
        { leaveCurrentFamily: false },
      );
    });

    it('should successfully accept invitation and leave current family', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: true,
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            leaveCurrentFamily: true,
          }),
        },
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ success: boolean; message: string }>(response);

      expect(json.success).toBe(true);
      expect(mockInvitationService.acceptFamilyInvitation).toHaveBeenCalledWith(
        mockInviteCode,
        mockUserId,
        { leaveCurrentFamily: true },
      );
    });

    it('should accept invitation with default leaveCurrentFamily=false', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: true,
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ success: boolean; message: string }>(response);
      expect(json.success).toBe(true);
    });
  });

  describe('POST /family/:code/accept - Error Cases', () => {
    it('should return 400 for invalid invitation code', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'Invalid invitation code',
      });

      const response = await makeAuthenticatedRequest(
        app,
        '/family/INVALIDCODE/accept',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invalid invitation code');
      expect(json.code).toBe('ACCEPT_FAILED');
    });

    it('should return 400 when invitation has expired', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'Invitation has expired',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invitation has expired');
    });

    it('should return 400 when user already belongs to a family', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'You already belong to a family: Smith Family',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('You already belong to a family: Smith Family');
    });

    it('should return 400 for email mismatch', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'This invitation was sent to a different email address',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('This invitation was sent to a different email address');
    });

    it('should return 400 when user is last admin', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'Cannot leave family as you are the last administrator',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({
            leaveCurrentFamily: true,
          }),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Cannot leave family as you are the last administrator');
    });

    it('should return 500 for unexpected errors', async () => {
      mockInvitationService.acceptFamilyInvitation.mockRejectedValue(new Error('Database error'));

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(500);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to accept family invitation');
      expect(json.code).toBe('ACCEPT_FAILED');
    });
  });

  describe('POST /family/:code/accept - Edge Cases', () => {
    it('should return 404 for empty invite code', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        '/family//accept',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(404);
    });

    it('should return 400 for invite code with special characters', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'Invalid invitation code',
      });

      const response = await makeAuthenticatedRequest(
        app,
        '/family/INV@LID$/accept',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
    });

    it('should return 400 for overly long invite code', async () => {
      const longCode = 'A'.repeat(1000);

      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'Invalid invitation code',
      });

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${longCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
    });

    it('should return 400 for invite code with spaces only', async () => {
      mockInvitationService.acceptFamilyInvitation.mockResolvedValue({
        success: false,
        error: 'Invalid invitation code',
      });

      const response = await makeAuthenticatedRequest(
        app,
        '/family/   /accept',
        {
          method: 'POST',
          body: JSON.stringify({}),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
    });

    it('should return 400 when leaveCurrentFamily is not a boolean', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({ leaveCurrentFamily: 'yes' }),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('should return 400 when leaveCurrentFamily is null', async () => {
      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInviteCode}/accept`,
        {
          method: 'POST',
          body: JSON.stringify({ leaveCurrentFamily: null }),
        },
      );

      expect(response.status).toBe(400);
      const json = await responseJson<{ success: boolean; error: string }>(response);
      expect(json.success).toBe(false);
    });
  });

  // ==========================================================================
  // DELETE /family/:invitationId - Cancel Family Invitation
  // ==========================================================================

  describe('DELETE /family/:invitationId - Success Cases', () => {
    it('should successfully cancel family invitation', async () => {
      mockInvitationService.cancelFamilyInvitation.mockResolvedValue(undefined);

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInvitationId}`,
        {
          method: 'DELETE',
        },
      );

      expect(response.status).toBe(200);
      const json = await responseJson<{ message: string }>(response);

      expect(json.message).toBe('Family invitation cancelled successfully');
      expect(mockInvitationService.cancelFamilyInvitation).toHaveBeenCalledWith(
        mockInvitationId,
        mockUserId,
      );
    });
  });

  describe('DELETE /family/:invitationId - Error Cases', () => {
    it('should return 403 when user is not family admin', async () => {
      const error = new Error('Only family administrators can cancel invitations');
      mockInvitationService.cancelFamilyInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInvitationId}`,
        {
          method: 'DELETE',
        },
      );

      expect(response.status).toBe(403);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Only family administrators can cancel invitations');
      expect(json.code).toBe('FORBIDDEN');
    });

    it('should return 404 when invitation not found', async () => {
      const error = new Error('Invitation not found');
      mockInvitationService.cancelFamilyInvitation.mockRejectedValue(error);

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInvitationId}`,
        {
          method: 'DELETE',
        },
      );

      expect(response.status).toBe(404);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Invitation not found');
      expect(json.code).toBe('NOT_FOUND');
    });

    it('should return 500 for unexpected errors', async () => {
      mockInvitationService.cancelFamilyInvitation.mockRejectedValue(new Error('Database error'));

      const response = await makeAuthenticatedRequest(
        app,
        `/family/${mockInvitationId}`,
        {
          method: 'DELETE',
        },
      );

      expect(response.status).toBe(500);
      const json = await responseJson<{ success: boolean; error: string; code: string }>(response);
      expect(json.success).toBe(false);
      expect(json.error).toBe('Failed to cancel family invitation');
      expect(json.code).toBe('CANCEL_FAILED');
    });
  });
});
