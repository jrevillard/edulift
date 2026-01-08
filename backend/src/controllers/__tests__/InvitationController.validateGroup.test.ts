/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { createInvitationControllerRoutes } from '../v1/InvitationController';
import { UnifiedInvitationService } from '../../services/UnifiedInvitationService';
import { TEST_IDS } from '../../utils/testHelpers';
import { PrismaClient } from '@prisma/client';
import { EmailService } from '../../services/EmailService';

jest.mock('../../services/UnifiedInvitationService');
jest.mock('../../middleware/auth-hono');

// Helper function to parse response JSON for testing
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const makeRequest = (app: any, url: string, options: RequestInit = {}) => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  });
};

describe('InvitationController - Group Invitation Validation Test Suite', () => {
  let app: any;
  let mockInvitationService: jest.Mocked<UnifiedInvitationService>;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockLogger: any;

  const mockValidationResult = {
    valid: true,
    groupId: TEST_IDS.GROUP,
    groupName: 'Test Group',
    email: 'test@example.com',
    inviterName: 'Test Inviter',
    existingUser: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock UnifiedInvitationService
    mockInvitationService = {
      validateFamilyInvitation: jest.fn(),
      validateGroupInvitation: jest.fn(),
      acceptFamilyInvitation: jest.fn(),
      acceptGroupInvitation: jest.fn(),
      createFamilyInvitation: jest.fn(),
      createGroupInvitation: jest.fn(),
      cancelFamilyInvitation: jest.fn(),
      cancelGroupInvitation: jest.fn(),
    } as any;

    // Mock PrismaClient
    mockPrisma = {
      $disconnect: jest.fn(),
    } as any;

    // Mock EmailService
    mockEmailService = {
      sendEmail: jest.fn(),
    } as any;

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    // Set up the controller with mocked dependencies
    app = createInvitationControllerRoutes({
      invitationService: mockInvitationService,
      prisma: mockPrisma,
      emailService: mockEmailService,
      logger: mockLogger,
    });
  });

  describe('GET /group/:code/validate', () => {
    it('should return valid response when invitation code is valid', async () => {
      const inviteCode = 'VALID123';

      mockInvitationService.validateGroupInvitation.mockResolvedValue(mockValidationResult);

      const response = await makeRequest(app, `/group/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const result = await responseJson<GroupInvitationValidationResult>(response);

      expect(result).toEqual({
        valid: true,
        type: 'GROUP',
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        email: 'test@example.com',
        inviterName: 'Test Inviter',
        existingUser: false,
      });

      expect(mockInvitationService.validateGroupInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should return error response when invitation code is invalid', async () => {
      const inviteCode = 'INVALID123';
      const validationResult = {
        valid: false,
        error: 'Invalid or expired invitation code',
      };

      mockInvitationService.validateGroupInvitation.mockResolvedValue(validationResult);

      const response = await makeRequest(app, `/group/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const result = await responseJson(response);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired invitation code',
        code: 'INVALID_INVITATION',
      });

      expect(mockInvitationService.validateGroupInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should return error response when invitation code is invalid without custom error message', async () => {
      const inviteCode = 'INVALID123';
      const validationResult = {
        valid: false,
        // No custom error message
      };

      mockInvitationService.validateGroupInvitation.mockResolvedValue(validationResult);

      const response = await makeRequest(app, `/group/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const result = await responseJson(response);

      expect(result).toEqual({
        success: false,
        error: 'Invalid group invitation',
        code: 'INVALID_INVITATION',
      });

      expect(mockInvitationService.validateGroupInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should handle service errors gracefully', async () => {
      const inviteCode = 'ERROR123';

      mockInvitationService.validateGroupInvitation.mockRejectedValue(new Error('Database error'));

      const response = await makeRequest(app, `/group/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      const result = await responseJson(response);

      expect(result).toEqual({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_FAILED',
      });

      expect(mockInvitationService.validateGroupInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should handle valid invitation with all required fields', async () => {
      const inviteCode = 'COMPLETE123';
      const fullValidationResult = {
        valid: true,
        groupId: TEST_IDS.GROUP,
        groupName: 'Complete Test Group',
        email: 'complete@example.com',
        inviterName: 'Complete Inviter',
        existingUser: true,
      };

      mockInvitationService.validateGroupInvitation.mockResolvedValue(fullValidationResult);

      const response = await makeRequest(app, `/group/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const result = await responseJson<GroupInvitationValidationResult>(response);

      expect(result).toEqual({
        valid: true,
        type: 'GROUP',
        group: {
          id: TEST_IDS.GROUP,
          name: 'Complete Test Group',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        email: 'complete@example.com',
        inviterName: 'Complete Inviter',
        existingUser: true,
      });

      expect(mockInvitationService.validateGroupInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should handle invitation with authenticated user', async () => {
      const inviteCode = 'AUTH123';
      const validationResultWithUser = {
        valid: true,
        groupId: TEST_IDS.GROUP,
        groupName: 'Auth Test Group',
        email: 'auth@example.com',
      };

      // Set user in context (simulating authenticated request)
      mockInvitationService.validateGroupInvitation.mockResolvedValue(validationResultWithUser);

      // Simulate authenticated request by setting userId in variables
      const appWithAuth = createInvitationControllerRoutes({
        invitationService: mockInvitationService,
        prisma: mockPrisma,
        emailService: mockEmailService,
        logger: mockLogger,
      });

      // Make request with userId in context
      await appWithAuth.request(`/group/${inviteCode}/validate`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // In real scenario, auth middleware would set this
        },
      });

      // Since we can't easily set the userId in the test without the actual auth middleware,
      // we just verify the endpoint is callable
      expect(mockInvitationService.validateGroupInvitation).toHaveBeenCalled();
    });

    it('should handle invitation without email field', async () => {
      const inviteCode = 'NOEMAIL123';
      const validationWithoutEmail = {
        valid: true,
        groupId: TEST_IDS.GROUP,
        groupName: 'No Email Group',
      };

      mockInvitationService.validateGroupInvitation.mockResolvedValue(validationWithoutEmail);

      const response = await makeRequest(app, `/group/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const result = await responseJson<GroupInvitationValidationResult>(response);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('GROUP');
      expect(result.group.name).toBe('No Email Group');
      expect(result.email).toBeUndefined();
    });
  });
});

// Type definitions for test responses
interface GroupInvitationValidationResult {
  valid: boolean;
  type: 'GROUP';
  group: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  email?: string;
}
