import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';

// Mock functions are created in the mock implementation below

// Mock the auth middleware BEFORE importing anything else
const mockAuthMiddleware = jest.fn();
jest.mock('../../middleware/auth', () => ({
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

// Mock EmailServiceFactory
jest.mock('../../services/EmailServiceFactory', () => ({
  EmailServiceFactory: {
    getInstance: jest.fn().mockReturnValue({
      sendFamilyInvitation: jest.fn(),
      sendGroupInvitation: jest.fn(),
    }),
  },
}));

// Mock UnifiedInvitationService
const mockCreateFamilyInvitation = jest.fn();
const mockCreateGroupInvitation = jest.fn();

jest.mock('../../services/UnifiedInvitationService', () => ({
  UnifiedInvitationService: jest.fn().mockImplementation(() => ({
    createFamilyInvitation: mockCreateFamilyInvitation,
    createGroupInvitation: mockCreateGroupInvitation,
  })),
}));

// Now import the router after all mocks are set up
import invitationsRouter from '../invitations';

describe('Platform Parameter Handling in Invitation Routes', () => {
  let app: express.Application;
  let authToken: string;
  let mockUserFindUnique: jest.Mock;

  const testUser = {
    id: 'test-user-id',
    email: 'test@example.com',
  };

  beforeAll(() => {
    // Set environment variable for JWT secret
    process.env.JWT_SECRET = 'test-secret';

    app = express();
    app.use(express.json());
    app.use('/invitations', invitationsRouter);

    // Create a test JWT token
    authToken = jwt.sign(
      { userId: testUser.id, email: testUser.email },
      'test-secret'
    );

    // Get reference to the mocked Prisma user findUnique
    const { PrismaClient } = require('@prisma/client');
    const mockPrisma = new PrismaClient();
    mockUserFindUnique = mockPrisma.user.findUnique;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the authentication middleware to simulate successful auth
    mockAuthMiddleware.mockImplementation((req: any, _res: any, next: any) => {
      // Simulate authenticated request
      req.userId = testUser.id;
      req.user = {
        id: testUser.id,
        email: testUser.email,
        name: 'Test User',
      };
      next();
    });
    
    // Mock Prisma user lookup for authentication
    mockUserFindUnique.mockResolvedValue({
      id: testUser.id,
      email: testUser.email,
      name: 'Test User',
    });
  });

  describe('Family Invitation Platform Parameter', () => {
    const familyInviteData = {
      familyId: 'test-family-id',
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

      const response = await request(app)
        .post('/invitations/family')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...familyInviteData,
          platform: 'native',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the service was called with the correct platform parameter
      expect(mockCreateFamilyInvitation).toHaveBeenCalledWith(
        familyInviteData.familyId,
        {
          email: familyInviteData.email,
          role: familyInviteData.role,
          personalMessage: familyInviteData.personalMessage,
        },
        testUser.id,
        'native'
      );
    });

    it('should default to web platform when not specified', async () => {
      const mockInvitation = {
        id: 'test-invitation-id',
        inviteCode: 'TEST123',
        invitationUrl: 'https://app.familytracker.com/invitation/TEST123',
      };

      mockCreateFamilyInvitation.mockResolvedValueOnce(mockInvitation);

      const response = await request(app)
        .post('/invitations/family')
        .set('Authorization', `Bearer ${authToken}`)
        .send(familyInviteData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the service was called with web as default platform
      expect(mockCreateFamilyInvitation).toHaveBeenCalledWith(
        familyInviteData.familyId,
        {
          email: familyInviteData.email,
          role: familyInviteData.role,
          personalMessage: familyInviteData.personalMessage,
        },
        testUser.id,
        'web'
      );
    });

    it('should default to web platform when invalid platform specified', async () => {
      const mockInvitation = {
        id: 'test-invitation-id',
        inviteCode: 'TEST123',
        invitationUrl: 'https://app.familytracker.com/invitation/TEST123',
      };

      mockCreateFamilyInvitation.mockResolvedValueOnce(mockInvitation);

      const response = await request(app)
        .post('/invitations/family')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...familyInviteData,
          platform: 'invalid-platform',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the service was called with web as fallback platform
      expect(mockCreateFamilyInvitation).toHaveBeenCalledWith(
        familyInviteData.familyId,
        {
          email: familyInviteData.email,
          role: familyInviteData.role,
          personalMessage: familyInviteData.personalMessage,
        },
        testUser.id,
        'web'
      );
    });
  });

  describe('Group Invitation Platform Parameter', () => {
    const groupInviteData = {
      groupId: 'test-group-id',
      targetFamilyId: 'test-target-family-id',
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

      const response = await request(app)
        .post('/invitations/group')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ...groupInviteData,
          platform: 'native',
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the service was called with the correct platform parameter
      expect(mockCreateGroupInvitation).toHaveBeenCalledWith(
        groupInviteData.groupId,
        {
          targetFamilyId: groupInviteData.targetFamilyId,
          email: groupInviteData.email,
          role: groupInviteData.role,
          personalMessage: groupInviteData.personalMessage,
        },
        testUser.id,
        'native'
      );
    });

    it('should default to web platform when not specified', async () => {
      const mockInvitation = {
        id: 'test-invitation-id',
        inviteCode: 'TEST456',
        invitationUrl: 'https://app.familytracker.com/invitation/TEST456',
      };

      mockCreateGroupInvitation.mockResolvedValueOnce(mockInvitation);

      const response = await request(app)
        .post('/invitations/group')
        .set('Authorization', `Bearer ${authToken}`)
        .send(groupInviteData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);

      // Verify the service was called with web as default platform
      expect(mockCreateGroupInvitation).toHaveBeenCalledWith(
        groupInviteData.groupId,
        {
          targetFamilyId: groupInviteData.targetFamilyId,
          email: groupInviteData.email,
          role: groupInviteData.role,
          personalMessage: groupInviteData.personalMessage,
        },
        testUser.id,
        'web'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockCreateFamilyInvitation.mockRejectedValueOnce(new Error('Service error'));

      const response = await request(app)
        .post('/invitations/family')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          familyId: 'test-family-id',
          email: 'test@example.com',
          role: 'MEMBER',
          platform: 'native',
        });

      expect(response.status).toBe(500);
    });

    it('should validate required fields regardless of platform', async () => {
      const response = await request(app)
        .post('/invitations/family')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: 'test@example.com',
          platform: 'native',
          // Missing familyId and role
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Family ID and role are required');
    });
  });
});