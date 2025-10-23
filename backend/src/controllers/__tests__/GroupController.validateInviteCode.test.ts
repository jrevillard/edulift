import { Request, Response } from 'express';
import { GroupController } from '../GroupController';
import { GroupService } from '../../services/GroupService';


// Mock GroupService
jest.mock('../../services/GroupService');
const MockedGroupService = GroupService as jest.MockedClass<typeof GroupService>;

describe('GroupController - validateInviteCode', () => {
  let groupController: GroupController;
  let mockGroupService: jest.Mocked<GroupService>;
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.error to avoid cluttering test output
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create mock prisma to satisfy constructor
    const mockPrisma = {} as any;
    mockGroupService = new MockedGroupService(mockPrisma) as jest.Mocked<GroupService>;
    groupController = new GroupController(mockGroupService, {} as any);
    (groupController as any).groupService = mockGroupService;

    mockReq = {
      body: {},
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore console.error
    if (consoleErrorSpy) {
      consoleErrorSpy.mockRestore();
    }
  });

  describe('POST /validate-invite', () => {
    it('should return valid response when invitation code is valid', async () => {
      const validationResult = {
        valid: true,
        group: {
          id: 'group-123',
          name: 'Test Group',
        },
        invitation: {
          id: 'invitation-123',
          expiresAt: new Date('2025-12-31'),
          role: 'MEMBER' as const,
        },
      };

      mockReq.body = { inviteCode: 'VALID123' };
      mockGroupService.validateInvitationCode.mockResolvedValue(validationResult);

      await groupController.validateInviteCode(mockReq as Request, mockRes as Response);

      expect(mockGroupService.validateInvitationCode).toHaveBeenCalledWith('VALID123');
      expect(mockRes.status).toHaveBeenCalledWith(200);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        data: validationResult,
      });
    });

    it('should return error response when invitation code is invalid', async () => {
      const validationResult = {
        valid: false,
        error: 'Invalid or expired invitation code',
      };

      mockReq.body = { inviteCode: 'INVALID123' };
      mockGroupService.validateInvitationCode.mockResolvedValue(validationResult);

      await groupController.validateInviteCode(mockReq as Request, mockRes as Response);

      expect(mockGroupService.validateInvitationCode).toHaveBeenCalledWith('INVALID123');
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid or expired invitation code',
      });
    });

    it('should return error when no invite code provided', async () => {
      mockReq.body = {};

      await groupController.validateInviteCode(mockReq as Request, mockRes as Response);

      expect(mockGroupService.validateInvitationCode).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invitation code is required',
      });
    });

    it('should handle service errors gracefully', async () => {
      mockReq.body = { inviteCode: 'ERROR123' };
      mockGroupService.validateInvitationCode.mockRejectedValue(new Error('Database error'));

      await groupController.validateInviteCode(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to validate invitation code',
      });
    });
  });
});