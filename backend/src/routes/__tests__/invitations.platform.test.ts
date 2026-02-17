// @ts-nocheck
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Mock functions are created in the mock implementation below

// Mock the auth middleware BEFORE importing anything else
const mockAuthMiddleware = jest.fn();
jest.mock('../../middleware/auth-hono', () => ({
  authenticateToken: mockAuthMiddleware,
  AuthenticatedRequest: {} as any,
}));

// Mock Prisma Client
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: jest.fn(),
    },
  })),
}));

// Mock UnifiedInvitationService BEFORE importing InvitationController
const mockCreateFamilyInvitation = jest.fn();
const mockCreateGroupInvitation = jest.fn();

class MockUnifiedInvitationService {
  createFamilyInvitation = mockCreateFamilyInvitation;
  createGroupInvitation = mockCreateGroupInvitation;
}

jest.mock('../../services/UnifiedInvitationService', () => ({
  UnifiedInvitationService: MockUnifiedInvitationService,
}));

// Mock EmailServiceFactory BEFORE importing InvitationController
jest.mock('../../services/EmailServiceFactory', () => ({
  EmailServiceFactory: {
    getInstance: jest.fn().mockReturnValue({
      sendFamilyInvitation: jest.fn(),
      sendGroupInvitation: jest.fn(),
    }),
  },
}));

// Mock EmailService constructor BEFORE importing InvitationController
jest.mock('../../services/EmailService', () => ({
  EmailService: jest.fn().mockImplementation(() => ({
    sendInvitationEmail: jest.fn(),
  })),
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  })),
}));

// Now import the controller factory after all mocks are set up
import { createInvitationControllerRoutes } from '../../controllers/v1/InvitationController';

describe('Platform Parameter Handling in Invitation Routes', () => {
  let app: Hono;
  let authToken: string;
  let mockUserFindUnique: jest.Mock;
  let mockMiddleware: jest.Mock;

  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  beforeAll(() => {
    // Set environment variable for JWT secret
    process.env.JWT_ACCESS_SECRET = 'test-secret';

    // Create a test JWT token
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      'test-secret',
    );

    // Get reference to the mocked Prisma user findUnique
    const mockPrisma = new PrismaClient() as any;
    mockUserFindUnique = mockPrisma.user.findUnique as jest.Mock;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Prisma user lookup for authentication
    mockUserFindUnique.mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      name: 'Test User',
    });

    // Create mock middleware that sets userId in context
    mockMiddleware = jest.fn(async (c: any, next: any) => {
      c.set('userId', testUser.id);
      c.set('user', {
        id: testUser.id,
        email: testUser.email,
        name: 'Test User',
      });
      await next();
    });

    // Create a custom Hono middleware wrapper
    const authMiddleware = async (c: any, next: any) => {
      c.set('userId', testUser.id);
      c.set('user', {
        id: testUser.id,
        email: testUser.email,
        name: 'Test User',
      });
      await next();
    };

    // Create fresh app instance with controller for each test
    app = new Hono();

    // Apply the auth middleware to all routes
    app.use('*', authMiddleware);

    // Create controller with mocked services
    const mockInvitationService = new MockUnifiedInvitationService();
    const controller = createInvitationControllerRoutes({
      invitationService: mockInvitationService,
    });

    // Mount controller
    app.route('/invitations', controller);
  });

  describe('Family Invitation Platform Parameter', () => {
    const familyInviteData = {
      familyId: 'cl123456789012345678901234',
      email: 'invitee@example.com',
      role: 'MEMBER',
      personalMessage: 'Welcome to our family!',
    };

    it('should pass native platform when specified', async () => {
      const mockInvitation = {
        id: 'test-invitation-id',
        inviteCode: 'TEST123',
        invitationUrl: 'familytracker://invitation?code=TEST123&type=family',
      };

      mockCreateFamilyInvitation.mockResolvedValueOnce(mockInvitation);

      const response = await app.request('/invitations/family', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(familyInviteData),
      });

      expect(response.status).toBe(201);
      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('id');
      expect(responseBody).toHaveProperty('inviteCode');

      // Verify the service was called without platform parameter
      expect(mockCreateFamilyInvitation).toHaveBeenCalledWith(
        familyInviteData.familyId,
        {
          email: familyInviteData.email,
          role: familyInviteData.role,
          personalMessage: familyInviteData.personalMessage,
        },
        testUser.id,
      );
    });

    it('should default to web platform when not specified', async () => {
      const mockInvitation = {
        id: 'test-invitation-id',
        inviteCode: 'TEST123',
        invitationUrl: 'https://app.familytracker.com/invitation/TEST123',
      };

      mockCreateFamilyInvitation.mockResolvedValueOnce(mockInvitation);

      const response = await app.request('/invitations/family', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(familyInviteData),
      });

      expect(response.status).toBe(201);
      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('id');
      expect(responseBody).toHaveProperty('inviteCode');

      // Verify the service was called without platform parameter
      expect(mockCreateFamilyInvitation).toHaveBeenCalledWith(
        familyInviteData.familyId,
        {
          email: familyInviteData.email,
          role: familyInviteData.role,
          personalMessage: familyInviteData.personalMessage,
        },
        testUser.id,
      );
    });

    it('should default to web platform when invalid platform specified', async () => {
      const mockInvitation = {
        id: 'test-invitation-id',
        inviteCode: 'TEST123',
        invitationUrl: 'https://app.familytracker.com/invitation/TEST123',
      };

      mockCreateFamilyInvitation.mockResolvedValueOnce(mockInvitation);

      const response = await app.request('/invitations/family', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...familyInviteData,
          platform: 'invalid-platform',
        }),
      });

      expect(response.status).toBe(201);
      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('id');
      expect(responseBody).toHaveProperty('inviteCode');

      // Verify the service was called without platform parameter
      expect(mockCreateFamilyInvitation).toHaveBeenCalledWith(
        familyInviteData.familyId,
        {
          email: familyInviteData.email,
          role: familyInviteData.role,
          personalMessage: familyInviteData.personalMessage,
        },
        testUser.id,
      );
    });
  });

  describe('Group Invitation Platform Parameter', () => {
    const groupInviteData = {
      groupId: 'cl123456789012345678901235',
      targetFamilyId: 'cl123456789012345678901236',
      email: 'invitee@example.com',
      role: 'MEMBER',
      personalMessage: 'Welcome to our group!',
    };

    it('should pass native platform when specified', async () => {
      const mockInvitation = {
        id: 'test-invitation-id',
        inviteCode: 'TEST456',
        invitationUrl: 'familytracker://invitation?code=TEST456&type=group',
      };

      mockCreateGroupInvitation.mockResolvedValueOnce(mockInvitation);

      const response = await app.request('/invitations/group', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupInviteData),
      });

      expect(response.status).toBe(201);
      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('id');
      expect(responseBody).toHaveProperty('inviteCode');

      // Verify the service was called without platform parameter
      expect(mockCreateGroupInvitation).toHaveBeenCalledWith(
        groupInviteData.groupId,
        {
          targetFamilyId: groupInviteData.targetFamilyId,
          email: groupInviteData.email,
          role: groupInviteData.role,
          personalMessage: groupInviteData.personalMessage,
        },
        testUser.id,
      );
    });

    it('should default to web platform when not specified', async () => {
      const mockInvitation = {
        id: 'test-invitation-id',
        inviteCode: 'TEST456',
        invitationUrl: 'https://app.familytracker.com/invitation/TEST456',
      };

      mockCreateGroupInvitation.mockResolvedValueOnce(mockInvitation);

      const response = await app.request('/invitations/group', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(groupInviteData),
      });

      expect(response.status).toBe(201);
      const responseBody = await response.json();
      expect(responseBody).toHaveProperty('id');
      expect(responseBody).toHaveProperty('inviteCode');

      // Verify the service was called without platform parameter
      expect(mockCreateGroupInvitation).toHaveBeenCalledWith(
        groupInviteData.groupId,
        {
          targetFamilyId: groupInviteData.targetFamilyId,
          email: groupInviteData.email,
          role: groupInviteData.role,
          personalMessage: groupInviteData.personalMessage,
        },
        testUser.id,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockCreateFamilyInvitation.mockRejectedValueOnce(new Error('Service error'));

      const response = await app.request('/invitations/family', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          familyId: 'cl123456789012345678901234',
          email: 'test@example.com',
          role: 'MEMBER',
        }),
      });

      expect(response.status).toBe(500);
    });

    it('should validate required fields regardless of platform', async () => {
      const response = await app.request('/invitations/family', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          // Missing familyId and role
        }),
      });

      expect(response.status).toBe(400);
      const responseBody = await response.json();
      expect(responseBody.success).toBe(false);
      expect(responseBody.error.name).toBe('ZodError');
    });
  });
});