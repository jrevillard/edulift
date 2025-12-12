import { Request, Response } from 'express';
import { GroupController } from '../GroupController';
import { GroupService } from '../../services/GroupService';
import { AppError } from '../../middleware/errorHandler';


// Mock the GroupService
jest.mock('../../services/GroupService');

interface AuthenticatedRequest extends Request {
  userId: string;
}

describe('GroupController', () => {
  let groupController: GroupController;
  let mockGroupService: jest.Mocked<GroupService>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockGroupService = new GroupService({} as any) as jest.Mocked<GroupService>;
    const mockSchedulingService = {} as any;
    groupController = new GroupController(mockGroupService, mockSchedulingService);

    mockRequest = {
      userId: TEST_IDS.USER,
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create a new group successfully', async () => {
      const groupData = { name: 'Test Group' };
      const createdGroup = {
        id: TEST_IDS.GROUP,
        name: 'Test Group',
        adminId: TEST_IDS.USER,
        inviteCode: 'ABC123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRequest.body = groupData;
      
      // Mock getUserFamily to return a family
      mockGroupService.getUserFamily = jest.fn().mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        family: { id: TEST_IDS.FAMILY, name: 'Test Family' },
      });
      
      mockGroupService.createGroup = jest.fn().mockResolvedValue(createdGroup);

      await groupController.createGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.createGroup).toHaveBeenCalledWith({
        name: groupData.name,
        familyId: TEST_IDS.FAMILY,
        createdBy: TEST_IDS.USER,
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdGroup,
      });
    });

    it('should handle errors when creating group', async () => {
      const groupData = { name: 'Test Group' };
      mockRequest.body = groupData;
      
      // Mock getUserFamily to return a family
      mockGroupService.getUserFamily = jest.fn().mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        family: { id: TEST_IDS.FAMILY, name: 'Test Family' },
      });
      
        mockGroupService.createGroup = jest.fn().mockRejectedValue(new AppError('Failed to create group', 500));

      await expect(groupController.createGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      )).rejects.toThrow('Failed to create group');
    });
  });

  describe('getUserGroups', () => {
    it('should get user groups successfully', async () => {
      const userGroups = [
        {
          userId: TEST_IDS.USER,
          groupId: TEST_IDS.GROUP,
          role: 'ADMIN' as const,
          joinedAt: new Date(),
          group: {
            id: TEST_IDS.GROUP,
            name: 'Test Group',
            admin: {
              id: TEST_IDS.USER,
              name: 'Test User',
              email: 'test@example.com',
            },
            _count: { members: 1 },
          },
        },
      ];

      mockGroupService.getUserGroups = jest.fn().mockResolvedValue(userGroups);

      await groupController.getUserGroups(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.getUserGroups).toHaveBeenCalledWith(TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: userGroups,
      });
    });
  });

  describe('joinGroup', () => {
    it('should join group successfully', async () => {
      const joinData = { inviteCode: 'ABC123' };
      const membership = {
        userId: TEST_IDS.USER,
        groupId: TEST_IDS.GROUP,
        role: 'PARENT' as const,
        joinedAt: new Date(),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          admin: {
            id: 'user-2',
            name: 'Admin User',
            email: 'admin@example.com',
          },
          _count: { members: 2 },
        },
      };

      mockRequest.body = joinData;
      mockGroupService.joinGroupByInviteCode = jest.fn().mockResolvedValue(membership);

      await groupController.joinGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.joinGroupByInviteCode).toHaveBeenCalledWith('ABC123', TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: membership,
      });
    });
  });

  describe('getGroupFamilies', () => {
    it('should get group families successfully', async () => {
      const groupId = TEST_IDS.GROUP;
      const groupMembers = [
        {
          userId: TEST_IDS.USER,
          groupId: TEST_IDS.GROUP,
          role: 'ADMIN',
          joinedAt: new Date(),
          user: {
            id: TEST_IDS.USER,
            name: 'Admin User',
            email: 'admin@example.com',
            createdAt: new Date(),
          },
        },
      ];

      mockRequest.params = { groupId };
      mockGroupService.getGroupFamilies = jest.fn().mockResolvedValue(groupMembers);

      await groupController.getGroupFamilies(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.getGroupFamilies).toHaveBeenCalledWith(groupId, TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: groupMembers,
      });
    });
  });

  describe('updateFamilyRole', () => {
    it('should update family role successfully', async () => {
      const groupId = TEST_IDS.GROUP;
      const familyId = 'family-2';
      const roleData = { role: 'ADMIN' };

      const updatedMembership = {
        familyId: 'family-2',
        groupId: TEST_IDS.GROUP,
        role: 'ADMIN' as const,
        family: {
          id: 'family-2',
          name: 'Test Family',
        },
      };

      const mockGroupFamilies = [
        {
          id: 'family-2',
          name: 'Test Family',
          role: 'ADMIN',
          admins: [
            { id: TEST_IDS.USER, name: 'Admin User', email: 'admin@test.com' },
          ],
          memberCount: 5,
          isPending: false,
        },
      ];

      mockRequest.params = { groupId, familyId };
      mockRequest.body = roleData;
      mockGroupService.updateFamilyRole = jest.fn().mockResolvedValue(updatedMembership);
      mockGroupService.getGroupFamilies = jest.fn().mockResolvedValue(mockGroupFamilies);

      await groupController.updateFamilyRole(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.updateFamilyRole).toHaveBeenCalledWith(
        groupId,
        familyId,
        'ADMIN',
        TEST_IDS.USER,
      );
      expect(mockGroupService.getGroupFamilies).toHaveBeenCalledWith(
        groupId,
        TEST_IDS.USER,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockGroupFamilies[0],
      });
    });
  });

  describe('removeFamilyFromGroup', () => {
    it('should remove family successfully', async () => {
      const groupId = TEST_IDS.GROUP;
      const familyId = 'family-2';

      mockRequest.params = { groupId, familyId };
      mockGroupService.removeFamilyFromGroup = jest.fn().mockResolvedValue({ success: true });

      await groupController.removeFamilyFromGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.removeFamilyFromGroup).toHaveBeenCalledWith(groupId, familyId, TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Family removed from group successfully' },
      });
    });
  });

  describe('updateGroup', () => {
    it('should update group name successfully', async () => {
      const groupId = TEST_IDS.GROUP;
      const updateData = { name: 'Updated Group Name' };
      const updatedGroup = {
        id: groupId,
        name: 'Updated Group Name',
        description: null,
        inviteCode: 'ABC123',
        ownerFamily: { id: TEST_IDS.FAMILY, name: 'Test Family' },
        updatedAt: new Date(),
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup = jest.fn().mockResolvedValue(updatedGroup);

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(groupId, TEST_IDS.USER, updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup,
      });
    });

    it('should update group description successfully', async () => {
      const groupId = TEST_IDS.GROUP;
      const updateData = { description: 'Updated description' };
      const updatedGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Updated description',
        inviteCode: 'ABC123',
        ownerFamily: { id: TEST_IDS.FAMILY, name: 'Test Family' },
        updatedAt: new Date(),
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup = jest.fn().mockResolvedValue(updatedGroup);

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(groupId, TEST_IDS.USER, updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup,
      });
    });

    it('should update both name and description successfully', async () => {
      const groupId = TEST_IDS.GROUP;
      const updateData = { name: 'New Name', description: 'New description' };
      const updatedGroup = {
        id: groupId,
        name: 'New Name',
        description: 'New description',
        inviteCode: 'ABC123',
        ownerFamily: { id: TEST_IDS.FAMILY, name: 'Test Family' },
        updatedAt: new Date(),
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup = jest.fn().mockResolvedValue(updatedGroup);

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(groupId, TEST_IDS.USER, updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup,
      });
    });

    it('should return 400 when no update data provided', async () => {
      const groupId = TEST_IDS.GROUP;

      mockRequest.params = { groupId };
      mockRequest.body = {};

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No update data provided',
      });
      expect(mockGroupService.updateGroup).not.toHaveBeenCalled();
    });

    // Validation tests are moved to middleware validation tests.
    // Controller now assumes data is pre-validated by middleware.
    it('should handle empty update data', async () => {
      const groupId = TEST_IDS.GROUP;

      mockRequest.params = { groupId };
      mockRequest.body = { name: '', description: null }; // will be filtered as empty

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'No update data provided',
        }),
      );
      expect(mockGroupService.updateGroup).not.toHaveBeenCalled();
    });
  });

  describe('deleteGroup', () => {
    it('should delete group successfully', async () => {
      const groupId = TEST_IDS.GROUP;

      mockRequest.params = { groupId };
      mockGroupService.deleteGroup = jest.fn().mockResolvedValue({ success: true });

      await groupController.deleteGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.deleteGroup).toHaveBeenCalledWith(groupId, TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { success: true },
      });
    });
  });

  describe('inviteFamilyToGroup', () => {
    it('should invite family to group successfully', async () => {
      const groupId = TEST_IDS.GROUP;
      const inviteData = {
        familyId: TEST_IDS.FAMILY,
        role: 'MEMBER',
        personalMessage: 'Welcome to our group!',
      };
      const mockResult = {
        invitationId: 'invitation-123',
        familyId: TEST_IDS.FAMILY,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        status: 'PENDING',
      };

      mockRequest.params = { groupId };
      mockRequest.body = inviteData;
      mockGroupService.inviteFamilyById = jest.fn().mockResolvedValue(mockResult);

      await groupController.inviteFamilyToGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.inviteFamilyById).toHaveBeenCalledWith(
        groupId,
        {
          familyId: TEST_IDS.FAMILY,
          role: 'MEMBER',
          personalMessage: 'Welcome to our group!',
        },
        TEST_IDS.USER,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should invite family to group without platform parameter', async () => {
      const groupId = TEST_IDS.GROUP;
      const inviteData = {
        familyId: TEST_IDS.FAMILY,
        role: 'ADMIN',
      };
      const mockResult = { invitationId: 'invitation-123' };

      mockRequest.params = { groupId };
      mockRequest.body = inviteData;
      mockGroupService.inviteFamilyById = jest.fn().mockResolvedValue(mockResult);

      await groupController.inviteFamilyToGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.inviteFamilyById).toHaveBeenCalledWith(
        groupId,
        {
          familyId: TEST_IDS.FAMILY,
          role: 'ADMIN',
        },
        TEST_IDS.USER,
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    // Validation test moved to middleware validation tests.
    // Missing required fields validation should be handled by validation middleware.
  });
});