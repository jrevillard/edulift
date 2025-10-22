import { Request, Response } from 'express';
import { GroupController } from '../GroupController';
import { GroupService } from '../../services/GroupService';

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
      userId: 'user-1',
      body: {},
      params: {},
      query: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    jest.clearAllMocks();
  });

  describe('createGroup', () => {
    it('should create a new group successfully', async () => {
      const groupData = { name: 'Test Group' };
      const createdGroup = {
        id: 'group-1',
        name: 'Test Group',
        adminId: 'user-1',
        inviteCode: 'ABC123',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRequest.body = groupData;
      
      // Mock getUserFamily to return a family
      mockGroupService.getUserFamily = jest.fn().mockResolvedValue({
        familyId: 'family-1',
        family: { id: 'family-1', name: 'Test Family' }
      });
      
      mockGroupService.createGroup = jest.fn().mockResolvedValue(createdGroup);

      await groupController.createGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.createGroup).toHaveBeenCalledWith({
        name: groupData.name,
        familyId: 'family-1',
        createdBy: 'user-1'
      });
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdGroup
      });
    });

    it('should handle errors when creating group', async () => {
      const groupData = { name: 'Test Group' };
      mockRequest.body = groupData;
      
      // Mock getUserFamily to return a family
      mockGroupService.getUserFamily = jest.fn().mockResolvedValue({
        familyId: 'family-1',
        family: { id: 'family-1', name: 'Test Family' }
      });
      
      const { AppError } = require('../../middleware/errorHandler');
      mockGroupService.createGroup = jest.fn().mockRejectedValue(new AppError('Failed to create group', 500));

      await expect(groupController.createGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      )).rejects.toThrow('Failed to create group');
    });
  });

  describe('getUserGroups', () => {
    it('should get user groups successfully', async () => {
      const userGroups = [
        {
          userId: 'user-1',
          groupId: 'group-1',
          role: 'ADMIN' as const,
          joinedAt: new Date(),
          group: {
            id: 'group-1',
            name: 'Test Group',
            admin: {
              id: 'user-1',
              name: 'Test User',
              email: 'test@example.com'
            },
            _count: { members: 1 }
          }
        }
      ];

      mockGroupService.getUserGroups = jest.fn().mockResolvedValue(userGroups);

      await groupController.getUserGroups(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.getUserGroups).toHaveBeenCalledWith('user-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: userGroups
      });
    });
  });

  describe('joinGroup', () => {
    it('should join group successfully', async () => {
      const joinData = { inviteCode: 'ABC123' };
      const membership = {
        userId: 'user-1',
        groupId: 'group-1',
        role: 'PARENT' as const,
        joinedAt: new Date(),
        group: {
          id: 'group-1',
          name: 'Test Group',
          admin: {
            id: 'user-2',
            name: 'Admin User',
            email: 'admin@example.com'
          },
          _count: { members: 2 }
        }
      };

      mockRequest.body = joinData;
      mockGroupService.joinGroupByInviteCode = jest.fn().mockResolvedValue(membership);

      await groupController.joinGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.joinGroupByInviteCode).toHaveBeenCalledWith('ABC123', 'user-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: membership
      });
    });
  });

  describe('getGroupFamilies', () => {
    it('should get group families successfully', async () => {
      const groupId = 'group-1';
      const groupMembers = [
        {
          userId: 'user-1',
          groupId: 'group-1',
          role: 'ADMIN',
          joinedAt: new Date(),
          user: {
            id: 'user-1',
            name: 'Admin User',
            email: 'admin@example.com',
            createdAt: new Date()
          }
        }
      ];

      mockRequest.params = { groupId };
      mockGroupService.getGroupFamilies = jest.fn().mockResolvedValue(groupMembers);

      await groupController.getGroupFamilies(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.getGroupFamilies).toHaveBeenCalledWith(groupId, 'user-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: groupMembers
      });
    });
  });

  describe('updateFamilyRole', () => {
    it('should update family role successfully', async () => {
      const groupId = 'group-1';
      const familyId = 'family-2';
      const roleData = { role: 'ADMIN' };

      const updatedMembership = {
        familyId: 'family-2',
        groupId: 'group-1',
        role: 'ADMIN' as const,
        family: {
          id: 'family-2',
          name: 'Test Family'
        }
      };

      const mockGroupFamilies = [
        {
          id: 'family-2',
          name: 'Test Family',
          role: 'ADMIN',
          admins: [
            { id: 'user-1', name: 'Admin User', email: 'admin@test.com' }
          ],
          memberCount: 5,
          isPending: false
        }
      ];

      mockRequest.params = { groupId, familyId };
      mockRequest.body = roleData;
      mockGroupService.updateFamilyRole = jest.fn().mockResolvedValue(updatedMembership);
      mockGroupService.getGroupFamilies = jest.fn().mockResolvedValue(mockGroupFamilies);

      await groupController.updateFamilyRole(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.updateFamilyRole).toHaveBeenCalledWith(
        groupId,
        familyId,
        'ADMIN',
        'user-1'
      );
      expect(mockGroupService.getGroupFamilies).toHaveBeenCalledWith(
        groupId,
        'user-1'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockGroupFamilies[0]
      });
    });
  });

  describe('removeFamilyFromGroup', () => {
    it('should remove family successfully', async () => {
      const groupId = 'group-1';
      const familyId = 'family-2';

      mockRequest.params = { groupId, familyId };
      mockGroupService.removeFamilyFromGroup = jest.fn().mockResolvedValue({ success: true });

      await groupController.removeFamilyFromGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.removeFamilyFromGroup).toHaveBeenCalledWith(groupId, familyId, 'user-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Family removed from group successfully' }
      });
    });
  });

  describe('updateGroup', () => {
    it('should update group name successfully', async () => {
      const groupId = 'group-1';
      const updateData = { name: 'Updated Group Name' };
      const updatedGroup = {
        id: groupId,
        name: 'Updated Group Name',
        description: null,
        inviteCode: 'ABC123',
        ownerFamily: { id: 'family-1', name: 'Test Family' },
        updatedAt: new Date()
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup = jest.fn().mockResolvedValue(updatedGroup);

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(groupId, 'user-1', updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup
      });
    });

    it('should update group description successfully', async () => {
      const groupId = 'group-1';
      const updateData = { description: 'Updated description' };
      const updatedGroup = {
        id: groupId,
        name: 'Test Group',
        description: 'Updated description',
        inviteCode: 'ABC123',
        ownerFamily: { id: 'family-1', name: 'Test Family' },
        updatedAt: new Date()
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup = jest.fn().mockResolvedValue(updatedGroup);

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(groupId, 'user-1', updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup
      });
    });

    it('should update both name and description successfully', async () => {
      const groupId = 'group-1';
      const updateData = { name: 'New Name', description: 'New description' };
      const updatedGroup = {
        id: groupId,
        name: 'New Name',
        description: 'New description',
        inviteCode: 'ABC123',
        ownerFamily: { id: 'family-1', name: 'Test Family' },
        updatedAt: new Date()
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup = jest.fn().mockResolvedValue(updatedGroup);

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(groupId, 'user-1', updateData);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup
      });
    });

    it('should return 400 when no update data provided', async () => {
      const groupId = 'group-1';

      mockRequest.params = { groupId };
      mockRequest.body = {};

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No update data provided'
      });
      expect(mockGroupService.updateGroup).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      const groupId = 'group-1';

      mockRequest.params = { groupId };
      mockRequest.body = { name: '' }; // Invalid: empty name

      await groupController.updateGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Invalid input data'
        })
      );
      expect(mockGroupService.updateGroup).not.toHaveBeenCalled();
    });
  });

  describe('deleteGroup', () => {
    it('should delete group successfully', async () => {
      const groupId = 'group-1';

      mockRequest.params = { groupId };
      mockGroupService.deleteGroup = jest.fn().mockResolvedValue({ success: true });

      await groupController.deleteGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.deleteGroup).toHaveBeenCalledWith(groupId, 'user-1');
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { success: true }
      });
    });
  });

  describe('inviteFamilyToGroup', () => {
    it('should invite family to group successfully with platform parameter', async () => {
      const groupId = 'group-1';
      const inviteData = {
        familyId: 'family-1',
        role: 'MEMBER',
        personalMessage: 'Welcome to our group!',
        platform: 'native'
      };
      const mockResult = {
        invitationId: 'invitation-123',
        familyId: 'family-1',
        groupId: 'group-1',
        role: 'MEMBER',
        status: 'PENDING'
      };

      mockRequest.params = { groupId };
      mockRequest.body = inviteData;
      mockGroupService.inviteFamilyById = jest.fn().mockResolvedValue(mockResult);

      await groupController.inviteFamilyToGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.inviteFamilyById).toHaveBeenCalledWith(
        groupId,
        {
          familyId: 'family-1',
          role: 'MEMBER',
          personalMessage: 'Welcome to our group!'
        },
        'user-1',
        'native' // Platform parameter should be passed
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });

    it('should default to web platform when platform not provided', async () => {
      const groupId = 'group-1';
      const inviteData = {
        familyId: 'family-1',
        role: 'ADMIN'
      };
      const mockResult = { invitationId: 'invitation-123' };

      mockRequest.params = { groupId };
      mockRequest.body = inviteData;
      mockGroupService.inviteFamilyById = jest.fn().mockResolvedValue(mockResult);

      await groupController.inviteFamilyToGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockGroupService.inviteFamilyById).toHaveBeenCalledWith(
        groupId,
        {
          familyId: 'family-1',
          role: 'ADMIN'
        },
        'user-1',
        'web' // Should default to 'web'
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
    });

    it('should handle validation errors for invalid platform', async () => {
      const groupId = 'group-1';
      const inviteData = {
        familyId: 'family-1',
        role: 'MEMBER',
        platform: 'invalid' // Invalid platform
      };

      mockRequest.params = { groupId };
      mockRequest.body = inviteData;

      await groupController.inviteFamilyToGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: expect.any(Array)
      });
      expect(mockGroupService.inviteFamilyById).not.toHaveBeenCalled();
    });
  });
});