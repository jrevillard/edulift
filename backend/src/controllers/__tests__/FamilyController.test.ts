import request from 'supertest';
import express from 'express';
import { FamilyController } from '../FamilyController';
import { FamilyRole } from '../../types/family';

// Mock services
const mockFamilyService = {
  createFamily: jest.fn(),
  joinFamily: jest.fn(),
  getUserFamily: jest.fn(),
  updateMemberRole: jest.fn(),
  removeMember: jest.fn(),
  generateNewInviteCode: jest.fn(),
  leaveFamily: jest.fn(),
} as any;

const mockFamilyAuthService = {
  getUserPermissions: jest.fn(),
  requireFamilyRole: jest.fn(),
} as any;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
};

// Mock auth middleware
const mockAuthMiddleware = (req: any, _res: any, next: () => void): void => {
  req.user = { id: 'user-123' };
  next();
};

describe('FamilyController', () => {
  let app: express.Application;
  let familyController: FamilyController;

  beforeEach(() => {
    jest.clearAllMocks();

    familyController = new FamilyController(
      mockFamilyService,
      mockFamilyAuthService,
      mockLogger,
    );

    app = express();
    app.use(express.json());
    app.use(mockAuthMiddleware);

    // Setup routes
    app.post('/families', (req, res) => familyController.createFamily(req as any, res));
    app.post('/families/join', (req, res) => familyController.joinFamily(req as any, res));
    app.get('/families/current', (req, res) => familyController.getCurrentFamily(req as any, res));
    app.put('/families/members/:memberId/role', (req, res) => familyController.updateMemberRole(req as any, res));
    app.delete('/families/:familyId/members/:memberId', (req, res) => familyController.removeMember(req as any, res));
    app.post('/families/invite-code', (req, res) => familyController.generateInviteCode(req as any, res));
    app.post('/families/:familyId/leave', (req, res) => familyController.leaveFamily(req as any, res));
  });

  describe('POST /families', () => {
    it('should create family successfully', async () => {
      const familyData = {
        name: 'Test Family',
      };

      const mockFamily = {
        id: 'family-123',
        name: 'Test Family',
        inviteCode: 'INV123',
        members: [],
        children: [],
        vehicles: [],
      };

      mockFamilyService.createFamily.mockResolvedValue(mockFamily);

      const response = await request(app)
        .post('/families')
        .send(familyData)
        .expect(201);

      expect(response.body).toEqual({
        success: true,
        data: mockFamily,
      });

      expect(mockFamilyService.createFamily).toHaveBeenCalledWith('user-123', 'Test Family');
    });

    it('should return 400 for invalid family name', async () => {
      const response = await request(app)
        .post('/families')
        .send({ name: '' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Family name is required',
      });
    });

    it('should handle service errors', async () => {
      mockFamilyService.createFamily.mockRejectedValue(
        new Error('USER_ALREADY_IN_FAMILY'),
      );

      const response = await request(app)
        .post('/families')
        .send({ name: 'Test Family' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'USER_ALREADY_IN_FAMILY',
      });
    });
  });

  describe('POST /families/join', () => {
    it('should join family successfully', async () => {
      const joinData = {
        inviteCode: 'INV123',
      };

      const mockFamily = {
        id: 'family-123',
        name: 'Test Family',
        inviteCode: 'INV123',
        members: [],
        children: [],
        vehicles: [],
      };

      mockFamilyService.joinFamily.mockResolvedValue(mockFamily);

      const response = await request(app)
        .post('/families/join')
        .send(joinData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockFamily,
      });

      expect(mockFamilyService.joinFamily).toHaveBeenCalledWith('INV123', 'user-123');
    });

    it('should return 400 for missing invite code', async () => {
      const response = await request(app)
        .post('/families/join')
        .send({})
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invite code is required',
      });
    });

    it('should handle invalid invite code', async () => {
      mockFamilyService.joinFamily.mockRejectedValue(
        new Error('INVALID_INVITE_CODE'),
      );

      const response = await request(app)
        .post('/families/join')
        .send({ inviteCode: 'INVALID' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'INVALID_INVITE_CODE',
      });
    });
  });

  describe('GET /families/current', () => {
    it('should return current family', async () => {
      const mockFamily = {
        id: 'family-123',
        name: 'Test Family',
        inviteCode: 'INV123',
        members: [],
        children: [],
        vehicles: [],
      };

      mockFamilyService.getUserFamily.mockResolvedValue(mockFamily);

      const response = await request(app)
        .get('/families/current')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockFamily,
      });

      expect(mockFamilyService.getUserFamily).toHaveBeenCalledWith('user-123');
    });

    it('should return 404 if user has no family', async () => {
      mockFamilyService.getUserFamily.mockResolvedValue(null);

      const response = await request(app)
        .get('/families/current')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        error: 'User is not part of any family',
      });
    });
  });

  describe('PUT /families/members/:memberId/role', () => {
    it('should update member role successfully', async () => {
      const updateData = {
        role: FamilyRole.MEMBER,
      };

      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.updateMemberRole.mockResolvedValue(undefined);

      const response = await request(app)
        .put('/families/members/member-456/role')
        .send(updateData)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Member role updated successfully',
      });

      expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith('user-123', FamilyRole.ADMIN);
      expect(mockFamilyService.updateMemberRole).toHaveBeenCalledWith('user-123', 'member-456', FamilyRole.MEMBER);
    });

    it('should return 400 for invalid role', async () => {
      const response = await request(app)
        .put('/families/members/member-456/role')
        .send({ role: 'INVALID_ROLE' })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Invalid role',
      });
    });

    it('should return 403 for insufficient permissions', async () => {
      mockFamilyAuthService.requireFamilyRole.mockRejectedValue(
        new Error('INSUFFICIENT_PERMISSIONS'),
      );

      const response = await request(app)
        .put('/families/members/member-456/role')
        .send({ role: FamilyRole.MEMBER })
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
      });
    });
  });

  describe('DELETE /families/:familyId/members/:memberId', () => {
    beforeEach(() => {
      // Mock the getUserFamily call for family access verification
      mockFamilyService.getUserFamily.mockResolvedValue({
        id: 'family-123',
        name: 'Test Family',
      });
    });

    it('should remove member successfully', async () => {
      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.removeMember.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/families/family-123/members/member-456')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Member removed successfully',
      });

      expect(mockFamilyService.getUserFamily).toHaveBeenCalledWith('user-123');
      expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith('user-123', FamilyRole.ADMIN);
      expect(mockFamilyService.removeMember).toHaveBeenCalledWith('user-123', 'member-456');
    });

    it('should return 403 if user is not a member of the family', async () => {
      mockFamilyService.getUserFamily.mockResolvedValue({
        id: 'different-family-123',
        name: 'Different Family',
      });

      const response = await request(app)
        .delete('/families/family-123/members/member-456')
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Access denied: not a member of this family',
      });
    });

    it('should return 403 if user has no family', async () => {
      mockFamilyService.getUserFamily.mockResolvedValue(null);

      const response = await request(app)
        .delete('/families/family-123/members/member-456')
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'Access denied: not a member of this family',
      });
    });

    it('should return 403 for non-admin users', async () => {
      mockFamilyAuthService.requireFamilyRole.mockRejectedValue(
        new Error('INSUFFICIENT_PERMISSIONS'),
      );

      const response = await request(app)
        .delete('/families/family-123/members/member-456')
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
      });
    });

    it('should handle business rule errors (cannot remove self)', async () => {
      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.removeMember.mockRejectedValue(
        new Error('Admin cannot remove themselves'),
      );

      const response = await request(app)
        .delete('/families/family-123/members/member-456')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Admin cannot remove themselves',
      });
    });

    it('should handle member not found error', async () => {
      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.removeMember.mockRejectedValue(
        new Error('Member not found in family'),
      );

      const response = await request(app)
        .delete('/families/family-123/members/member-456')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Member not found in family',
      });
    });

    it('should handle last admin removal error', async () => {
      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.removeMember.mockRejectedValue(
        new Error('Cannot remove the last admin from family'),
      );

      const response = await request(app)
        .delete('/families/family-123/members/member-456')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Cannot remove the last admin from family',
      });
    });

    it('should allow admin to remove another admin when multiple exist', async () => {
      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);
      mockFamilyService.removeMember.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/families/family-123/members/admin-member-456')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Member removed successfully',
      });

      expect(mockFamilyService.removeMember).toHaveBeenCalledWith('user-123', 'admin-member-456');
    });
  });

  describe('POST /families/invite-code', () => {
    it('should reject permanent invite code generation (deprecated functionality)', async () => {
      mockFamilyAuthService.requireFamilyRole.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/families/invite-code')
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Permanent invite codes are no longer supported. Use invitation system instead.',
      });

      expect(mockFamilyAuthService.requireFamilyRole).toHaveBeenCalledWith('user-123', FamilyRole.ADMIN);
    });

    it('should return 403 for non-admin users', async () => {
      mockFamilyAuthService.requireFamilyRole.mockRejectedValue(
        new Error('INSUFFICIENT_PERMISSIONS'),
      );

      const response = await request(app)
        .post('/families/invite-code')
        .expect(403);

      expect(response.body).toEqual({
        success: false,
        error: 'INSUFFICIENT_PERMISSIONS',
      });
    });
  });

  describe('POST /families/:familyId/leave', () => {
    const familyId = 'family-123';

    it('should allow user to leave family successfully', async () => {
      mockFamilyService.leaveFamily.mockResolvedValue(undefined);

      const response = await request(app)
        .post(`/families/${familyId}/leave`)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: {
          message: 'Successfully left the family',
        },
      });

      expect(mockFamilyService.leaveFamily).toHaveBeenCalledWith('user-123');
    });

    it('should return 400 when user is the last admin', async () => {
      const lastAdminError = new Error('LAST_ADMIN: Cannot leave family as you are the last administrator');
      mockFamilyService.leaveFamily.mockRejectedValue(lastAdminError);

      const response = await request(app)
        .post(`/families/${familyId}/leave`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'Cannot leave family as you are the last administrator. Please appoint another admin first.',
      });
    });

    it('should return 400 when user is not a family member', async () => {
      const notMemberError = new Error('NOT_FAMILY_MEMBER: User is not a member of any family');
      mockFamilyService.leaveFamily.mockRejectedValue(notMemberError);

      const response = await request(app)
        .post(`/families/${familyId}/leave`)
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        error: 'You are not a member of any family',
      });
    });

    it('should return 500 for unexpected errors', async () => {
      const unexpectedError = new Error('Database connection failed');
      mockFamilyService.leaveFamily.mockRejectedValue(unexpectedError);

      const response = await request(app)
        .post(`/families/${familyId}/leave`)
        .expect(500);

      expect(response.body).toEqual({
        success: false,
        error: 'Failed to leave family',
      });
    });
  });
});