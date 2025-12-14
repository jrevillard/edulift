import request from 'supertest';
import express from 'express';
import { FamilyController } from '../FamilyController';
import { FamilyService } from '../../services/FamilyService';
import { FamilyAuthService } from '../../services/FamilyAuthService';
import { FamilyRole } from '../../types/family';
import { createLogger } from '../../utils/logger';
import { TEST_IDS } from '../../utils/testHelpers';

const familyLogger = createLogger('FamilyController');

// Mock services
const mockFamilyService = {
  getUserFamily: jest.fn(),
  inviteMember: jest.fn(),
} as unknown as FamilyService;

const mockFamilyAuthService = {
  requireFamilyRole: jest.fn(),
} as unknown as FamilyAuthService;


describe('FamilyController - inviteMember', () => {
  let familyController: FamilyController;
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    familyController = new FamilyController(mockFamilyService, mockFamilyAuthService, familyLogger);
    
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      // Mock authenticated user
      (req as any).user = { id: TEST_IDS.USER };
      next();
    });
    app.post('/families/:familyId/invite', (req, res) => 
      familyController.inviteMember(req as any, res),
    );
  });

  it('should successfully invite a family member', async () => {
    const inviteData = {
      email: 'newmember@example.com',
      role: 'MEMBER',
      personalMessage: 'Welcome to our family!',
    };

    const mockFamily = {
      id: TEST_IDS.FAMILY,
      name: 'Test Family',
      inviteCode: 'ABC123',
    };

    const mockInvitationResult = {
      id: 'invitation-123',
      familyId: TEST_IDS.FAMILY,
      email: 'newmember@example.com',
      role: 'MEMBER',
      personalMessage: 'Welcome to our family!',
      invitedBy: TEST_IDS.USER,
      createdBy: TEST_IDS.USER,
      acceptedBy: null,
      status: 'PENDING',
      inviteCode: 'ABC123',
      expiresAt: '2024-12-31T23:59:59.000Z',
      acceptedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      invitedByUser: {
        id: TEST_IDS.USER,
        name: 'Test User',
        email: 'testuser@example.com',
      },
    };

    // Setup mocks
    (mockFamilyService.getUserFamily as jest.Mock).mockResolvedValue(mockFamily);
    (mockFamilyAuthService.requireFamilyRole as jest.Mock).mockResolvedValue(undefined);
    (mockFamilyService.inviteMember as jest.Mock).mockResolvedValue(mockInvitationResult);

    const response = await request(app)
      .post(`/families/${TEST_IDS.FAMILY}/invite`)
      .send(inviteData);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      success: true,
      data: { ...mockInvitationResult, message: 'Invitation sent successfully' },
    });

    // Verify service calls
    expect(mockFamilyService.getUserFamily).toHaveBeenCalledWith(TEST_IDS.USER);
    expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith(TEST_IDS.USER, FamilyRole.ADMIN);
    expect(mockFamilyService.inviteMember).toHaveBeenCalledWith(TEST_IDS.FAMILY, {
      email: 'newmember@example.com',
      role: 'MEMBER',
      personalMessage: 'Welcome to our family!',
    }, TEST_IDS.USER);
  });

  it('should return 400 if email is missing', async () => {
    const response = await request(app)
      .post(`/families/${TEST_IDS.FAMILY}/invite`)
      .send({ role: 'MEMBER' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: 'Email is required',
    });
  });

  it('should return 400 if role is invalid', async () => {
    const response = await request(app)
      .post(`/families/${TEST_IDS.FAMILY}/invite`)
      .send({ 
        email: 'test@example.com',
        role: 'INVALID_ROLE', 
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      success: false,
      error: 'Invalid role',
    });
  });

  it('should return 403 if user is not member of the family', async () => {
    // Setup mocks - user not in family
    (mockFamilyService.getUserFamily as jest.Mock).mockResolvedValue(null);

    const response = await request(app)
      .post(`/families/${TEST_IDS.FAMILY}/invite`)
      .send({ 
        email: 'test@example.com',
        role: 'MEMBER', 
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: 'Access denied: not a member of this family',
    });
  });

  it('should return 403 if user is not admin', async () => {
    const mockFamily = {
      id: TEST_IDS.FAMILY,
      name: 'Test Family',
    };

    // Setup mocks - user in family but not admin
    (mockFamilyService.getUserFamily as jest.Mock).mockResolvedValue(mockFamily);
    (mockFamilyAuthService.requireFamilyRole as jest.Mock).mockRejectedValue(
      new Error('INSUFFICIENT_PERMISSIONS'),
    );

    const response = await request(app)
      .post(`/families/${TEST_IDS.FAMILY}/invite`)
      .send({ 
        email: 'test@example.com',
        role: 'MEMBER', 
      });

    expect(response.status).toBe(403);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('INSUFFICIENT_PERMISSIONS');
  });

  it('should default role to MEMBER if not provided', async () => {
    const mockFamily = {
      id: TEST_IDS.FAMILY,
      name: 'Test Family',
      inviteCode: 'ABC123',
    };

    const mockInvitationResult = {
      id: 'clinvit1234567890123456789',
      familyId: TEST_IDS.FAMILY,
      email: 'test@example.com',
      role: 'MEMBER',
      personalMessage: undefined,
      invitedBy: TEST_IDS.USER,
      createdBy: TEST_IDS.USER,
      acceptedBy: null,
      status: 'PENDING',
      inviteCode: 'ABC123',
      expiresAt: '2024-12-31T23:59:59.000Z',
      acceptedAt: null,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      invitedByUser: {
        id: TEST_IDS.USER,
        name: 'Test User',
        email: 'testuser@example.com',
      },
    };

    // Setup mocks
    (mockFamilyService.getUserFamily as jest.Mock).mockResolvedValue(mockFamily);
    (mockFamilyAuthService.requireFamilyRole as jest.Mock).mockResolvedValue(undefined);
    (mockFamilyService.inviteMember as jest.Mock).mockResolvedValue(mockInvitationResult);

    const response = await request(app)
      .post(`/families/${TEST_IDS.FAMILY}/invite`)
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(201);
    expect(mockFamilyService.inviteMember).toHaveBeenCalledWith(TEST_IDS.FAMILY, {
      email: 'test@example.com',
      role: FamilyRole.MEMBER,
      personalMessage: undefined,
    }, TEST_IDS.USER);
  });
});