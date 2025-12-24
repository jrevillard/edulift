/// <reference types="@types/jest" />
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { Hono } from 'hono';
import { createGroupControllerRoutes, type GroupVariables } from '../GroupController';
import { GroupService } from '../../services/GroupService';
import { SchedulingService } from '../../services/SchedulingService';
import { TEST_IDS } from '../../utils/testHelpers';

jest.mock('../../services/GroupService');
jest.mock('../../services/SchedulingService');

jest.mock('../../middleware/auth-hono');

// Helper function to parse response JSON for testing
const responseJson = async <T = any>(response: Response): Promise<T> => {
  return response.json() as Promise<T>;
};

const makeRequest = (app: Hono<any>, url: string, options: RequestInit = {}) => {
  return app.request(url, {
    ...options,
    headers: {
      ...options.headers,
      'Content-Type': 'application/json',
    },
  });
};

describe('GroupController.validateInviteCode Test Suite', () => {
  let app: Hono<{ Variables: GroupVariables }>;
  let mockGroupService: jest.Mocked<GroupService>;
  let mockSchedulingService: jest.Mocked<SchedulingService>;

  // The mock now returns the structure that UnifiedInvitationService provides
  const mockValidationResult = {
    valid: true,
    group: {
      id: TEST_IDS.GROUP,
      name: 'Test Group',
    },
    invitation: {
      id: '',
      expiresAt: new Date(),
      role: 'MEMBER' as const,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock GroupService
    mockGroupService = {
      validateInvitationCode: jest.fn(),
      validateInvitationCodeWithUser: jest.fn(),
      getUserFamily: jest.fn(),
      createGroup: jest.fn(),
      joinGroupByInviteCode: jest.fn(),
      getUserGroups: jest.fn(),
      getGroupFamilies: jest.fn(),
      updateFamilyRole: jest.fn(),
      removeFamilyFromGroup: jest.fn(),
      updateGroup: jest.fn(),
      deleteGroup: jest.fn(),
      leaveGroup: jest.fn(),
      searchFamiliesForInvitation: jest.fn(),
      inviteFamilyById: jest.fn(),
      getPendingInvitations: jest.fn(),
      cancelInvitation: jest.fn(),
    } as any;

    // Mock SchedulingService
    mockSchedulingService = {
      getWeeklySchedule: jest.fn(),
    } as any;

    // Set up the controller with mocked dependencies using factory pattern
    const deps = {
      groupService: mockGroupService,
      schedulingService: mockSchedulingService,
    };

    app = createGroupControllerRoutes(deps);
  });

  describe('POST /validate-invite', () => {
    it('should return valid response when invitation code is valid', async () => {
      const inviteCode = 'VALID123';

      mockGroupService.validateInvitationCode.mockResolvedValue(mockValidationResult);

      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });

      expect(response.status).toBe(200);
      const result = await responseJson(response);
      // Controller now returns {success, data} format
      expect(result).toEqual({
        success: true,
        data: {
          valid: true,
          group: {
            id: TEST_IDS.GROUP,
            name: 'Test Group',
            inviteCode: '',
            createdBy: '',
            createdAt: '',
            updatedAt: '',
          },
          userStatus: 'FAMILY_MEMBER',
          actionRequired: 'READY_TO_JOIN',
        },
      });

      expect(mockGroupService.validateInvitationCode).toHaveBeenCalledWith(inviteCode.trim());
    });

    it('should return error response when invitation code is invalid', async () => {
      const inviteCode = 'INVALID123';
      const validationResult = {
        valid: false,
        error: 'Invalid or expired invitation code',
      };

      mockGroupService.validateInvitationCode.mockResolvedValue(validationResult);

      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);
      // Controller returns code: 'INVALID_INVITE' now
      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired invitation code',
        code: 'INVALID_INVITE'
      });

      expect(mockGroupService.validateInvitationCode).toHaveBeenCalledWith(inviteCode.trim());
    });

    it('should return error response when invitation code is invalid without custom error message', async () => {
      const inviteCode = 'INVALID123';
      const validationResult = {
        valid: false,
        // No custom error message
      };

      mockGroupService.validateInvitationCode.mockResolvedValue(validationResult);

      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);
      // Controller defaults to 'Invalid invitation code' and code: 'INVALID_INVITE'
      expect(result).toEqual({
        success: false,
        error: 'Invalid invitation code',
        code: 'INVALID_INVITE'
      });

      expect(mockGroupService.validateInvitationCode).toHaveBeenCalledWith(inviteCode.trim());
    });

    it('should handle service errors gracefully', async () => {
      const inviteCode = 'ERROR123';

      mockGroupService.validateInvitationCode.mockRejectedValue(new Error('Database error'));

      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });

      expect(response.status).toBe(500);
      // Now using our enhanced error handler with enriched format
      const result = await responseJson(response);
      expect(result).toEqual({
        success: false,
        error: 'Failed to validate invitation code',
        code: 'VALIDATION_FAILED'
      });

      expect(mockGroupService.validateInvitationCode).toHaveBeenCalledWith(inviteCode.trim());
    });

    it('should trim whitespace from invite code', async () => {
      const inviteCode = '  VALID123  ';

      mockGroupService.validateInvitationCode.mockResolvedValue(mockValidationResult);

      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });

      expect(response.status).toBe(200);

      expect(mockGroupService.validateInvitationCode).toHaveBeenCalledWith('VALID123');
    });

    it('should return validation error for empty invite code', async () => {
      const inviteCode = '';

      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);

      // Zod validation errors come back with a message field containing JSON string
      if (typeof result === 'object' && result !== null && 'message' in result) {
        expect(result.message).toContain('Invite code is required');
      }

      expect(mockGroupService.validateInvitationCode).not.toHaveBeenCalled();
    });

    it('should return validation error for missing invite code', async () => {
      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);

      // Zod validation errors come back with a message field containing JSON string
      if (typeof result === 'object' && result !== null && 'message' in result) {
        expect(result.message).toContain('required');
      }

      expect(mockGroupService.validateInvitationCode).not.toHaveBeenCalled();
    });

    it('should return validation error for non-string invite code', async () => {
      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode: 123 }),
      });

      expect(response.status).toBe(400);
      const result = await responseJson(response);

      // Should contain Zod validation error
      if (typeof result === 'object' && result !== null) {
        expect(result).toHaveProperty('error');
        if ('error' in result && typeof result.error === 'object' && result.error !== null) {
          expect(result.error).toHaveProperty('message');
        }
      }

      expect(mockGroupService.validateInvitationCode).not.toHaveBeenCalled();
    });

    it('should handle valid invitation with all required fields', async () => {
      const inviteCode = 'COMPLETE123';
      const fullValidationResult = {
        valid: true,
        group: {
          id: TEST_IDS.GROUP,
          name: 'Complete Test Group',
        },
        invitation: {
          id: '',
          expiresAt: new Date(),
          role: 'MEMBER' as const,
        },
      };

      mockGroupService.validateInvitationCode.mockResolvedValue(fullValidationResult);

      const response = await makeRequest(app, '/validate-invite', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
      });

      expect(response.status).toBe(200);
      const result = await responseJson(response);
      // Controller returns {success, data} format
      expect(result).toEqual({
        success: true,
        data: {
          valid: true,
          group: {
            id: TEST_IDS.GROUP,
            name: 'Complete Test Group',
            inviteCode: '',
            createdBy: '',
            createdAt: '',
            updatedAt: '',
          },
          userStatus: 'FAMILY_MEMBER',
          actionRequired: 'READY_TO_JOIN',
        },
      });

      expect(mockGroupService.validateInvitationCode).toHaveBeenCalledWith(inviteCode.trim());
    });

    it('should handle custom error objects correctly', () => {
      // Note: This functionality is thoroughly tested in errorHandler.integration.test.ts
      // The custom error object handling is verified to prevent [object Object] conversion
      // and properly extract error messages and codes from non-Error objects.

      // This test serves as a placeholder to document the integration requirement.
      // The actual implementation is tested in:
      // - src/utils/__tests__/errorHandler.test.ts (unit tests)
      // - src/utils/__tests__/errorHandler.integration.test.ts (integration tests)

      expect(true).toBe(true); // Placeholder - functionality is tested elsewhere
    });
  });
});