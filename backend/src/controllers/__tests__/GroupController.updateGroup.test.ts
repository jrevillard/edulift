import { Request, Response } from 'express';
import { GroupController } from '../GroupController';
import { GroupService } from '../../services/GroupService';
import { SchedulingService } from '../../services/SchedulingService';
import { AuthenticatedRequest } from '../../middleware/auth';
// import { createError } from '../../utils/errorHandler';


// Mock services
jest.mock('../../services/GroupService');
jest.mock('../../services/SchedulingService');

describe('GroupController.updateGroup', () => {
  let groupController: GroupController;
  let mockGroupService: jest.Mocked<GroupService>;
  let mockSchedulingService: jest.Mocked<SchedulingService>;
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockGroupService = new GroupService({} as any) as jest.Mocked<GroupService>;
    mockSchedulingService = new SchedulingService({} as any, {} as any) as jest.Mocked<SchedulingService>;
    groupController = new GroupController(mockGroupService, mockSchedulingService);

    mockRequest = {
      userId: 'user123',
      params: { groupId: 'group123' },
      body: {},
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('successful updates', () => {
    it('should update group name only', async () => {
      const updateData = { name: 'New Group Name' };
      const updatedGroup = { id: 'group123', name: 'New Group Name', description: 'Old description' };

      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        'group123',
        'user123',
        { name: 'New Group Name' },
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup,
      });
    });

    it('should update group description only', async () => {
      const updateData = { description: 'New description' };
      const updatedGroup = { id: 'group123', name: 'Old Name', description: 'New description' };

      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        'group123',
        'user123',
        { description: 'New description' },
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup,
      });
    });

    it('should update both name and description', async () => {
      const updateData = { name: 'New Name', description: 'New description' };
      const updatedGroup = { id: 'group123', name: 'New Name', description: 'New description' };

      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        'group123',
        'user123',
        { name: 'New Name', description: 'New description' },
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup,
      });
    });

    it('should clear description with empty string', async () => {
      const updateData = { description: '' };
      const updatedGroup = { id: 'group123', name: 'Old Name', description: '' };

      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        'group123',
        'user123',
        { description: '' },
      );
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedGroup,
      });
    });

    it('should trim whitespace from inputs', async () => {
      const updateData = { name: '  Trimmed Name  ', description: '  Trimmed description  ' };
      const updatedGroup = { id: 'group123', name: 'Trimmed Name', description: 'Trimmed description' };

      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        'group123',
        'user123',
        { name: 'Trimmed Name', description: 'Trimmed description' },
      );
    });
  });

  describe('validation errors', () => {
    it('should return 401 if user is not authenticated', async () => {
      delete mockRequest.userId;

      await expect(
        groupController.updateGroup(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow('Authentication required');
    });

    it('should return 400 if no update data provided', async () => {
      mockRequest.body = {};

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No update data provided',
      });
    });

    it('should return 400 if name is empty after trimming', async () => {
      mockRequest.body = { name: '   ' };

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'No update data provided',
      });
    });

    it('should reject name that is too long', async () => {
      const longName = 'a'.repeat(101);
      mockRequest.body = { name: longName };

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid input data',
        validationErrors: expect.arrayContaining([
          expect.objectContaining({
            field: 'name',
            message: 'Group name too long',
          }),
        ]),
      });
    });

    it('should reject description that is too long', async () => {
      const longDescription = 'a'.repeat(501);
      mockRequest.body = { description: longDescription };

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid input data',
        validationErrors: expect.arrayContaining([
          expect.objectContaining({
            field: 'description',
            message: 'Description too long',
          }),
        ]),
      });
    });
  });

  describe('service errors', () => {
    it('should handle group not found error', async () => {
      const updateData = { name: 'New Name' };
      mockRequest.body = updateData;
      
      const error = new Error('Group not found');
      (error as any).statusCode = 404;
      mockGroupService.updateGroup.mockRejectedValue(error);

      await expect(
        groupController.updateGroup(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow('Group not found');
    });

    it('should handle permission denied error', async () => {
      const updateData = { name: 'New Name' };
      mockRequest.body = updateData;
      
      const error = new Error('Only administrators of the owner family can update group settings');
      (error as any).statusCode = 403;
      mockGroupService.updateGroup.mockRejectedValue(error);

      await expect(
        groupController.updateGroup(mockRequest as Request, mockResponse as Response),
      ).rejects.toThrow('Only administrators of the owner family can update group settings');
    });
  });

  describe('edge cases', () => {
    it('should handle undefined description correctly', async () => {
      const updateData = { name: 'New Name', description: undefined };
      const updatedGroup = { id: 'group123', name: 'New Name', description: 'Old description' };

      mockRequest.body = updateData;
      mockGroupService.updateGroup.mockResolvedValue(updatedGroup as any);

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
        'group123',
        'user123',
        { name: 'New Name' },
      );
    });

    it('should handle null description correctly', async () => {
      const updateData = { name: 'New Name', description: null };

      mockRequest.body = updateData;

      await groupController.updateGroup(mockRequest as Request, mockResponse as Response);

      // Null description should cause a validation error since Zod expects string or undefined
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Invalid input data',
        validationErrors: expect.arrayContaining([
          expect.objectContaining({
            field: 'description',
            message: expect.any(String),
          }),
        ]),
      });
    });
  });
});