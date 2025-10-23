import { ChildService, CreateChildData, UpdateChildData } from '../ChildService';
import { SocketEmitter, setGlobalSocketHandler } from '../../utils/socketEmitter';
import { AppError } from '../../middleware/errorHandler';

// Mock the SocketEmitter
jest.mock('../../utils/socketEmitter', () => ({
  SocketEmitter: {
    broadcastChildUpdate: jest.fn(),
  },
  setGlobalSocketHandler: jest.fn(),
  getGlobalSocketHandler: jest.fn(),
}));

const mockSocketEmitter = SocketEmitter as jest.Mocked<typeof SocketEmitter>;

describe('ChildService WebSocket Events', () => {
  let childService: ChildService;
  let mockPrisma: any;
  let mockSocketHandler: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock socket handler
    mockSocketHandler = {
      broadcastToGroup: jest.fn(),
      broadcastToUser: jest.fn(),
    };

    // Setup mock Prisma
    mockPrisma = {
      child: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      familyMember: {
        findFirst: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    // Initialize service
    childService = new ChildService(mockPrisma);

    // Setup global socket handler
    setGlobalSocketHandler(mockSocketHandler);
  });

  afterEach(() => {
    setGlobalSocketHandler(null);
  });

  describe('Child Creation', () => {
    it('should emit CHILD_ADDED event when child is created successfully', async () => {
      const childData: CreateChildData = {
        name: 'Alice Smith',
        age: 8,
        familyId: 'family-123',
      };

      const mockCreatedChild = {
        id: 'child-456',
        name: 'Alice Smith',
        age: 8,
        familyId: 'family-123',
      };

      mockPrisma.child.create.mockResolvedValue(mockCreatedChild);

      const result = await childService.createChild(childData);

      expect(result).toEqual(mockCreatedChild);
      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalledWith(
        'system', // userId for child creation
        'family-123', // familyId
        'added', // event type
        expect.objectContaining({
          child: mockCreatedChild,
          familyId: 'family-123',
        }),
      );
    });

    it('should handle undefined age correctly and emit event', async () => {
      const childData: CreateChildData = {
        name: 'Bob Johnson',
        familyId: 'family-789',
        // age is undefined
      };

      const mockCreatedChild = {
        id: 'child-999',
        name: 'Bob Johnson',
        age: null,
        familyId: 'family-789',
      };

      mockPrisma.child.create.mockResolvedValue(mockCreatedChild);

      await childService.createChild(childData);

      expect(mockPrisma.child.create).toHaveBeenCalledWith({
        data: {
          name: 'Bob Johnson',
          age: null, // undefined converted to null
          familyId: 'family-789',
        },
      });

      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalledWith(
        'system',
        'family-789',
        'added',
        expect.objectContaining({
          child: mockCreatedChild,
          familyId: 'family-789',
        }),
      );
    });

    it('should not emit event when child creation fails', async () => {
      const childData: CreateChildData = {
        name: 'Failed Child',
        familyId: 'family-123',
      };

      mockPrisma.child.create.mockRejectedValue(new Error('Database error'));

      await expect(childService.createChild(childData)).rejects.toThrow(AppError);
      expect(mockSocketEmitter.broadcastChildUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Child Updates', () => {
    it('should emit CHILD_UPDATED event when child is updated successfully', async () => {
      const childId = 'child-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const updateData: UpdateChildData = {
        name: 'Updated Alice',
        age: 9,
      };

      const mockUserFamily = { id: familyId, name: 'Test Family' };
      const mockExistingChild = {
        id: childId,
        name: 'Alice Smith',
        age: 8,
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockUpdatedChild = {
        id: childId,
        name: 'Updated Alice',
        age: 9,
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock getUserFamily
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId,
        family: mockUserFamily,
      });

      // Mock canUserModifyFamilyChildren
      jest.spyOn(childService, 'canUserModifyFamilyChildren').mockResolvedValue(true);

      // Mock getChildById
      jest.spyOn(childService, 'getChildById').mockResolvedValue(mockExistingChild);

      // Mock update
      mockPrisma.child.update.mockResolvedValue(mockUpdatedChild);

      const result = await childService.updateChild(childId, userId, updateData);

      expect(result).toEqual(mockUpdatedChild);
      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalledWith(
        userId,
        familyId,
        'updated',
        expect.objectContaining({
          child: mockUpdatedChild,
          familyId,
          previousData: mockExistingChild,
        }),
      );
    });

    it('should handle partial updates and emit correct event', async () => {
      const childId = 'child-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const updateData: UpdateChildData = {
        name: 'Only Name Updated',
        // age is undefined - should not be included in update
      };

      const mockUserFamily = { id: familyId, name: 'Test Family' };
      const mockExistingChild = {
        id: childId,
        name: 'Old Name',
        age: 8,
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockUpdatedChild = {
        id: childId,
        name: 'Only Name Updated',
        age: 8, // unchanged
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId,
        family: mockUserFamily,
      });
      jest.spyOn(childService, 'canUserModifyFamilyChildren').mockResolvedValue(true);
      jest.spyOn(childService, 'getChildById').mockResolvedValue(mockExistingChild);
      mockPrisma.child.update.mockResolvedValue(mockUpdatedChild);

      await childService.updateChild(childId, userId, updateData);

      expect(mockPrisma.child.update).toHaveBeenCalledWith({
        where: { id: childId },
        data: {
          name: 'Only Name Updated',
          // age should not be in the data object
        },
      });

      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalledWith(
        userId,
        familyId,
        'updated',
        expect.objectContaining({
          child: mockUpdatedChild,
          familyId,
          previousData: mockExistingChild,
        }),
      );
    });

    it('should not emit event when user lacks permission to update child', async () => {
      const childId = 'child-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const updateData: UpdateChildData = {
        name: 'Unauthorized Update',
      };

      const mockUserFamily = { id: familyId, name: 'Test Family' };

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId,
        family: mockUserFamily,
      });

      // User lacks permission
      jest.spyOn(childService, 'canUserModifyFamilyChildren').mockResolvedValue(false);

      await expect(childService.updateChild(childId, userId, updateData)).rejects.toThrow(
        'Insufficient permissions to modify children in family',
      );

      expect(mockSocketEmitter.broadcastChildUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Child Deletion', () => {
    it('should emit CHILD_DELETED event when child is deleted successfully', async () => {
      const childId = 'child-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const mockUserFamily = { id: familyId, name: 'Test Family' };
      const mockExistingChild = {
        id: childId,
        name: 'Alice Smith',
        age: 8,
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId,
        family: mockUserFamily,
      });
      jest.spyOn(childService, 'canUserModifyFamilyChildren').mockResolvedValue(true);
      jest.spyOn(childService, 'getChildById').mockResolvedValue(mockExistingChild);
      mockPrisma.child.delete.mockResolvedValue(mockExistingChild);

      const result = await childService.deleteChild(childId, userId);

      expect(result).toEqual({ success: true });
      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalledWith(
        userId,
        familyId,
        'deleted',
        expect.objectContaining({
          childId,
          familyId,
          deletedChild: mockExistingChild,
        }),
      );
    });

    it('should not emit event when child deletion fails', async () => {
      const childId = 'child-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const mockUserFamily = { id: familyId, name: 'Test Family' };
      const mockExistingChild = {
        id: childId,
        name: 'Alice Smith',
        age: 8,
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId,
        family: mockUserFamily,
      });
      jest.spyOn(childService, 'canUserModifyFamilyChildren').mockResolvedValue(true);
      jest.spyOn(childService, 'getChildById').mockResolvedValue(mockExistingChild);
      mockPrisma.child.delete.mockRejectedValue(new Error('Database error'));

      await expect(childService.deleteChild(childId, userId)).rejects.toThrow(AppError);
      expect(mockSocketEmitter.broadcastChildUpdate).not.toHaveBeenCalled();
    });

    it('should not emit event when child is not found', async () => {
      const childId = 'nonexistent-child';
      const userId = 'user-456';
      const familyId = 'family-789';

      const mockUserFamily = { id: familyId, name: 'Test Family' };

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId,
        family: mockUserFamily,
      });
      jest.spyOn(childService, 'canUserModifyFamilyChildren').mockResolvedValue(true);
      jest.spyOn(childService, 'getChildById').mockResolvedValue(null as any); // Child not found

      await expect(childService.deleteChild(childId, userId)).rejects.toThrow(
        'Child not found or access denied',
      );

      expect(mockSocketEmitter.broadcastChildUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Event Data Structure Validation', () => {
    it('should include all required fields in CHILD_ADDED event', async () => {
      const childData: CreateChildData = {
        name: 'Test Child',
        age: 5,
        familyId: 'family-123',
      };

      const mockCreatedChild = {
        id: 'child-456',
        name: 'Test Child',
        age: 5,
        familyId: 'family-123',
      };

      mockPrisma.child.create.mockResolvedValue(mockCreatedChild);

      await childService.createChild(childData);

      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalledWith(
        'system',
        'family-123',
        'added',
        {
          child: mockCreatedChild,
          familyId: 'family-123',
        },
      );
    });

    it('should include all required fields in CHILD_UPDATED event', async () => {
      const childId = 'child-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const updateData = { name: 'Updated Name' };
      const mockUserFamily = { id: familyId, name: 'Test Family' };
      const mockExistingChild = { 
        id: childId, 
        name: 'Old Name', 
        age: 8, 
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockUpdatedChild = { 
        id: childId, 
        name: 'Updated Name', 
        age: 8, 
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId,
        family: mockUserFamily,
      });
      jest.spyOn(childService, 'canUserModifyFamilyChildren').mockResolvedValue(true);
      jest.spyOn(childService, 'getChildById').mockResolvedValue(mockExistingChild);
      mockPrisma.child.update.mockResolvedValue(mockUpdatedChild);

      await childService.updateChild(childId, userId, updateData);

      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalledWith(
        userId,
        familyId,
        'updated',
        {
          child: mockUpdatedChild,
          familyId,
          previousData: mockExistingChild,
        },
      );
    });

    it('should include all required fields in CHILD_DELETED event', async () => {
      const childId = 'child-123';
      const userId = 'user-456';
      const familyId = 'family-789';

      const mockUserFamily = { id: familyId, name: 'Test Family' };
      const mockExistingChild = { 
        id: childId, 
        name: 'Test Child', 
        age: 8, 
        familyId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Setup mocks
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        userId,
        family: mockUserFamily,
      });
      jest.spyOn(childService, 'canUserModifyFamilyChildren').mockResolvedValue(true);
      jest.spyOn(childService, 'getChildById').mockResolvedValue(mockExistingChild);
      mockPrisma.child.delete.mockResolvedValue(mockExistingChild);

      await childService.deleteChild(childId, userId);

      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalledWith(
        userId,
        familyId,
        'deleted',
        {
          childId,
          familyId,
          deletedChild: mockExistingChild,
        },
      );
    });
  });

  describe('Error Handling with Socket Events', () => {
    it('should handle missing socket handler gracefully during child creation', async () => {
      setGlobalSocketHandler(null);

      const childData: CreateChildData = {
        name: 'Test Child',
        familyId: 'family-123',
      };

      const mockCreatedChild = {
        id: 'child-456',
        name: 'Test Child',
        age: null,
        familyId: 'family-123',
      };

      mockPrisma.child.create.mockResolvedValue(mockCreatedChild);

      // Should not throw error even without socket handler
      const result = await childService.createChild(childData);
      expect(result).toEqual(mockCreatedChild);

      // SocketEmitter should still be called (it handles null socket handler internally)
      expect(mockSocketEmitter.broadcastChildUpdate).toHaveBeenCalled();
    });

    it('should handle user without family gracefully', async () => {
      const childId = 'child-123';
      const userId = 'user-456';
      const updateData = { name: 'Updated Name' };

      // User has no family
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      await expect(childService.updateChild(childId, userId, updateData)).rejects.toThrow(
        'User must belong to a family to modify children',
      );

      expect(mockSocketEmitter.broadcastChildUpdate).not.toHaveBeenCalled();
    });
  });
});