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

describe('InvitationController - Family Invitation Validation Test Suite', () => {
  let app: any;
  let mockInvitationService: jest.Mocked<UnifiedInvitationService>;
  let mockPrisma: jest.Mocked<PrismaClient>;
  let mockEmailService: jest.Mocked<EmailService>;
  let mockLogger: any;

  const mockValidationResult = {
    valid: true,
    familyId: TEST_IDS.FAMILY,
    familyName: 'Test Family',
    email: 'test@example.com',
    role: 'MEMBER' as const,
    personalMessage: 'Welcome to our family!',
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

  describe('GET /family/:code/validate', () => {
    it('should return valid response when invitation code is valid', async () => {
      const inviteCode = 'VALID123';

      mockInvitationService.validateFamilyInvitation.mockResolvedValue(mockValidationResult);

      const response = await makeRequest(app, `/family/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const result = await responseJson<FamilyInvitationValidationResult>(response);

      expect(result).toEqual({
        valid: true,
        type: 'FAMILY',
        family: {
          id: TEST_IDS.FAMILY,
          name: 'Test Family',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        email: 'test@example.com',
        role: 'MEMBER',
        personalMessage: 'Welcome to our family!',
      });

      expect(mockInvitationService.validateFamilyInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should return error response when invitation code is invalid', async () => {
      const inviteCode = 'INVALID123';
      const validationResult = {
        valid: false,
        error: 'Invalid or expired invitation code',
      };

      mockInvitationService.validateFamilyInvitation.mockResolvedValue(validationResult);

      const response = await makeRequest(app, `/family/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const result = await responseJson(response);

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired invitation code',
        code: 'INVALID_INVITATION',
      });

      expect(mockInvitationService.validateFamilyInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should return error response when invitation code is invalid without custom error message', async () => {
      const inviteCode = 'INVALID123';
      const validationResult = {
        valid: false,
        // No custom error message
      };

      mockInvitationService.validateFamilyInvitation.mockResolvedValue(validationResult);

      const response = await makeRequest(app, `/family/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(404);
      const result = await responseJson(response);

      expect(result).toEqual({
        success: false,
        error: 'Invalid family invitation',
        code: 'INVALID_INVITATION',
      });

      expect(mockInvitationService.validateFamilyInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should handle service errors gracefully', async () => {
      const inviteCode = 'ERROR123';

      mockInvitationService.validateFamilyInvitation.mockRejectedValue(new Error('Database error'));

      const response = await makeRequest(app, `/family/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(500);
      const result = await responseJson(response);

      expect(result).toEqual({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_FAILED',
      });

      expect(mockInvitationService.validateFamilyInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should handle valid invitation with all required fields', async () => {
      const inviteCode = 'COMPLETE123';
      const fullValidationResult = {
        valid: true,
        familyId: TEST_IDS.FAMILY,
        familyName: 'Complete Test Family',
        email: 'complete@example.com',
        role: 'ADMIN' as const,
        personalMessage: 'Welcome!',
      };

      mockInvitationService.validateFamilyInvitation.mockResolvedValue(fullValidationResult);

      const response = await makeRequest(app, `/family/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const result = await responseJson<FamilyInvitationValidationResult>(response);

      expect(result).toEqual({
        valid: true,
        type: 'FAMILY',
        family: {
          id: TEST_IDS.FAMILY,
          name: 'Complete Test Family',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        email: 'complete@example.com',
        role: 'ADMIN',
        personalMessage: 'Welcome!',
      });

      expect(mockInvitationService.validateFamilyInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should handle invitation with authenticated user', async () => {
      const inviteCode = 'AUTH123';
      const validationResultWithUser = {
        valid: true,
        familyId: TEST_IDS.FAMILY,
        familyName: 'Auth Test Family',
        email: 'auth@example.com',
        role: 'MEMBER' as const,
      };

      mockInvitationService.validateFamilyInvitation.mockResolvedValue(validationResultWithUser);

      const response = await makeRequest(app, `/family/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const result = await responseJson<FamilyInvitationValidationResult>(response);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('FAMILY');
      expect(result.family.name).toBe('Auth Test Family');

      expect(mockInvitationService.validateFamilyInvitation).toHaveBeenCalledWith(inviteCode, undefined);
    });

    it('should handle invitation without optional fields', async () => {
      const inviteCode = 'NOOPTIONAL123';
      const validationWithoutOptionals = {
        valid: true,
        familyId: TEST_IDS.FAMILY,
        familyName: 'No Optionals Family',
      };

      mockInvitationService.validateFamilyInvitation.mockResolvedValue(validationWithoutOptionals);

      const response = await makeRequest(app, `/family/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const result = await responseJson<FamilyInvitationValidationResult>(response);

      expect(result.valid).toBe(true);
      expect(result.type).toBe('FAMILY');
      expect(result.family.name).toBe('No Optionals Family');
      expect(result.email).toBeUndefined();
      expect(result.role).toBeUndefined();
      expect(result.personalMessage).toBeUndefined();
    });

    it('should handle invitation with null personalMessage', async () => {
      const inviteCode = 'NULLMSG123';
      const validationWithNullMessage = {
        valid: true,
        familyId: TEST_IDS.FAMILY,
        familyName: 'Null Message Family',
        email: 'nullmsg@example.com',
        role: 'MEMBER' as const,
      };

      mockInvitationService.validateFamilyInvitation.mockResolvedValue(validationWithNullMessage);

      const response = await makeRequest(app, `/family/${inviteCode}/validate`, {
        method: 'GET',
      });

      expect(response.status).toBe(200);
      const result = await responseJson<FamilyInvitationValidationResult>(response);

      expect(result.valid).toBe(true);
      expect(result.personalMessage).toBeUndefined();
    });
  });
});

// Type definitions for test responses
interface FamilyInvitationValidationResult {
  valid: boolean;
  type: 'FAMILY';
  family: {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  email?: string;
  role?: 'MEMBER' | 'ADMIN';
  personalMessage?: string | null;
}
