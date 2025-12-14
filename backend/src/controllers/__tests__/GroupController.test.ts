import { Request, Response } from 'express';
import { GroupController } from '../GroupController';
import { AppError } from '../../middleware/errorHandler';
import { TEST_IDS } from '../../utils/testHelpers';

// Mock services - professional approach with proper jest mock structure
const mockGroupService = {
  getUserGroups: jest.fn(),
  createGroup: jest.fn(),
  joinGroupByInviteCode: jest.fn(),
  getGroupFamilies: jest.fn(),
  updateFamilyRole: jest.fn(),
  removeFamilyFromGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  inviteFamilyById: jest.fn(),
  getUserFamily: jest.fn(),
  isFamilyAdmin: jest.fn().mockResolvedValue(true), // Mock admin check
} as any;

const mockSchedulingService = {} as any;

interface AuthenticatedRequest extends Request {
  userId: string;
}

describe('GroupController', () => {
  let groupController: GroupController;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure default successful mocks
    mockGroupService.getUserFamily.mockResolvedValue({
      familyId: TEST_IDS.FAMILY,
      family: { id: TEST_IDS.FAMILY, name: 'Test Family', createdAt: new Date(), updatedAt: new Date() },
    });

    groupController = new GroupController(mockGroupService, mockSchedulingService);

    mockRequest = {
      userId: TEST_IDS.USER,
      user: { id: TEST_IDS.USER, email: 'test@example.com', name: 'Test User' },
      body: {},
      params: {},
      query: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('createGroup', () => {
    it('should create a new group successfully', async () => {
      const groupData = { name: 'Test Group' };
      // Create a minimal mock that matches GroupResponseSchema exactly
      const createdGroup = {
        id: TEST_IDS.GROUP,
        name: 'Test Group',
        description: null,
        familyId: TEST_IDS.FAMILY,
        inviteCode: 'ABC123',
        createdAt: '2023-01-01T00:00:00.000Z', // Fixed ISO string
        updatedAt: '2023-01-01T00:00:00.000Z', // Fixed ISO string
        userRole: 'ADMIN', // Must be 'ADMIN' or 'MEMBER' per schema
        ownerFamily: {
          id: TEST_IDS.FAMILY,
          name: 'Test Family',
        },
        familyCount: 1,
        scheduleCount: 0, // Optional but include for clarity
      };

      mockRequest.body = groupData;
      mockGroupService.createGroup.mockResolvedValue(createdGroup);

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
        data: expect.objectContaining({
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          userRole: 'ADMIN', // Matches schema and service return
          inviteCode: 'ABC123',
        }),
      });
    });

    it('should handle errors when creating group', async () => {
      const groupData = { name: 'Test Group' };
      mockRequest.body = groupData;
      
      // Mock getUserFamily to return a family
      mockGroupService.getUserFamily.mockResolvedValue({
        familyId: TEST_IDS.FAMILY,
        family: { id: TEST_IDS.FAMILY, name: 'Test Family', createdAt: new Date(), updatedAt: new Date() },
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
        // Array of GroupResponseSchema objects
        {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          description: null,
          familyId: TEST_IDS.FAMILY,
          inviteCode: 'ABC123',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          userRole: 'ADMIN', // Must be 'ADMIN' or 'MEMBER'
          ownerFamily: {
            id: TEST_IDS.FAMILY,
            name: 'Test Family',
          },
          familyCount: 1,
          scheduleCount: 0,
        },
      ];

      mockGroupService.getUserGroups.mockResolvedValue(userGroups);

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
        // GroupResponseSchema structure - ce que retourne enrichGroupWithUserContext
        id: TEST_IDS.GROUP,
        name: 'Test Group',
        description: null,
        familyId: 'clfamily1234567890123456789', // Owner family du groupe
        inviteCode: 'ABC123',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        userRole: 'MEMBER', // L'utilisateur qui joint devient MEMBER
        ownerFamily: {
          id: 'clfamily1234567890123456789',
          name: 'Owner Family',
        },
        familyCount: 2,
        scheduleCount: 0,
      };

      mockRequest.body = joinData;
      mockGroupService.joinGroupByInviteCode.mockResolvedValue(membership);

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
        // GroupsSuccessResponseSchema attend un tableau de GroupResponseSchema
        // Probablement que ce controller devrait utiliser un autre schéma, mais pour l'instant...
        {
          id: TEST_IDS.GROUP,
          name: 'Test Group',
          description: null,
          familyId: TEST_IDS.FAMILY,
          inviteCode: 'ABC123',
          createdAt: '2023-01-01T00:00:00.000Z',
          updatedAt: '2023-01-01T00:00:00.000Z',
          userRole: 'ADMIN',
          ownerFamily: {
            id: TEST_IDS.FAMILY,
            name: 'Test Family',
          },
          familyCount: 1,
          scheduleCount: 0,
        },
      ];

      mockRequest.params = { groupId };
      mockGroupService.getGroupFamilies.mockResolvedValue(groupMembers);

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
      const familyId = 'clfamily1234567890123456';
      const roleData = { role: 'ADMIN' };

      const updatedMembership = {
        familyId: 'clfamily1234567890123456',
        groupId: TEST_IDS.GROUP,
        role: 'ADMIN' as const,
        family: {
          id: 'clfamily1234567890123456',
          name: 'Test Family',
        },
      };

      const mockGroupFamilies = [
        // FamilyGroupMemberSchema - format attendu par updateFamilyRole
        // Le controller cherche f.id === familyId, donc on met familyId comme id
        {
          id: 'clfamily1234567890123456', // CUID valide
          familyId: 'clfamily1234567890123456', // DOIT correspondre à familyId de test
          role: 'ADMIN', // GroupRoleEnum : 'OWNER' | 'ADMIN' | 'MEMBER'
          joinedAt: '2023-01-01T00:00:00.000Z', // ISO datetime
          family: { // optionnel mais inclus dans le test
            id: 'clfamily1234567890123456',
            name: 'Test Family',
          },
        },
      ];

      mockRequest.params = { groupId, familyId };
      mockRequest.body = roleData;
      mockGroupService.updateFamilyRole.mockResolvedValue(updatedMembership);
      mockGroupService.getGroupFamilies.mockResolvedValue(mockGroupFamilies);

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
        // GroupResponseSchema structure
        id: groupId,
        name: 'Updated Group Name',
        description: null,
        familyId: TEST_IDS.FAMILY,
        inviteCode: 'ABC123',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        userRole: 'ADMIN',
        ownerFamily: {
          id: TEST_IDS.FAMILY,
          name: 'Test Family'
        },
        familyCount: 1,
        scheduleCount: 0,
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup);

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
        // GroupResponseSchema structure
        id: groupId,
        name: 'Test Group',
        description: 'Updated description',
        familyId: TEST_IDS.FAMILY,
        inviteCode: 'ABC123',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        userRole: 'ADMIN',
        ownerFamily: {
          id: TEST_IDS.FAMILY,
          name: 'Test Family'
        },
        familyCount: 1,
        scheduleCount: 0,
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup);

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
        // GroupResponseSchema structure
        id: groupId,
        name: 'New Name',
        description: 'New description',
        familyId: TEST_IDS.FAMILY,
        inviteCode: 'ABC123',
        createdAt: '2023-01-01T00:00:00.000Z',
        updatedAt: '2023-01-01T00:00:00.000Z',
        userRole: 'ADMIN',
        ownerFamily: {
          id: TEST_IDS.FAMILY,
          name: 'Test Family'
        },
        familyCount: 1,
        scheduleCount: 0,
      };

      mockRequest.params = { groupId };
      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup);

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
      mockGroupService.deleteGroup.mockResolvedValue({
        message: 'Group deleted successfully'
      });

      await groupController.deleteGroup(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response,
      );

      expect(mockGroupService.deleteGroup).toHaveBeenCalledWith(groupId, TEST_IDS.USER);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: { message: 'Group deleted successfully' },
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
        // GroupInvitationSchema structure
        id: 'clinvit1234567890123456789', // CUID
        groupId: TEST_IDS.GROUP,
        targetFamilyId: TEST_IDS.FAMILY, // targetFamilyId, pas familyId
        role: 'MEMBER', // GroupRoleEnum ('OWNER', 'ADMIN', 'MEMBER')
        status: 'PENDING',
        personalMessage: 'Welcome to our group!',
        expiresAt: '2023-12-31T23:59:59.000Z', // ISO datetime
        createdAt: '2023-01-01T00:00:00.000Z', // ISO datetime
      };

      mockRequest.params = { groupId };
      mockRequest.body = inviteData;
      mockGroupService.inviteFamilyById.mockResolvedValue(mockResult);

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
      const mockResult = {
        // GroupInvitationSchema structure
        id: 'clinvit1234567890123456790', // CUID
        groupId: TEST_IDS.GROUP,
        targetFamilyId: TEST_IDS.FAMILY,
        role: 'ADMIN', // GroupRoleEnum ('OWNER', 'ADMIN', 'MEMBER')
        status: 'PENDING',
        expiresAt: '2023-12-31T23:59:59.000Z',
        createdAt: '2023-01-01T00:00:00.000Z',
        // Pas de personalMessage dans ce test
      };

      mockRequest.params = { groupId };
      mockRequest.body = inviteData;
      mockGroupService.inviteFamilyById.mockResolvedValue(mockResult);

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