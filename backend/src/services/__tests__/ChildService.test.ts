import { PrismaClient } from '@prisma/client';
import { ChildService } from '../ChildService';
import { AppError } from '../../middleware/errorHandler';

// Mock PrismaClient
const mockPrisma = {
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
  groupChild: {
    findMany: jest.fn(),
  },
} as unknown as PrismaClient;

describe('ChildService', () => {
  let childService: ChildService;

  beforeEach(() => {
    childService = new ChildService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('createChild', () => {
    it('should create a child successfully', async () => {
      const childData = {
        name: 'John Doe',
        age: 8,
        familyId: 'family123',
      };

      const expectedChild = {
        id: 'child123',
        ...childData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.child.create as jest.Mock).mockResolvedValue(expectedChild);

      const result = await childService.createChild(childData);

      expect(mockPrisma.child.create).toHaveBeenCalledWith({
        data: {
          name: 'John Doe',
          age: 8,
          familyId: 'family123',
        },
      });
      expect(result).toEqual(expectedChild);
    });

    it('should create child with undefined age as null', async () => {
      const childData = {
        name: 'Jane Doe',
        familyId: 'family123',
      };

      const expectedChild = {
        id: 'child123',
        name: 'Jane Doe',
        age: null,
        familyId: 'family123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.child.create as jest.Mock).mockResolvedValue(expectedChild);

      await childService.createChild(childData);

      expect(mockPrisma.child.create).toHaveBeenCalledWith({
        data: {
          name: 'Jane Doe',
          age: null,
          familyId: 'family123',
        },
      });
    });

    it('should throw error when creation fails', async () => {
      const childData = {
        name: 'John Doe',
        familyId: 'family123',
      };

      (mockPrisma.child.create as jest.Mock).mockRejectedValue(new Error('Database error'));

      await expect(childService.createChild(childData)).rejects.toThrow(AppError);
      await expect(childService.createChild(childData)).rejects.toThrow('Failed to create child');
    });
  });

  describe('getChildrenByUser', () => {
    it('should return user children with group memberships', async () => {
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId,
        familyId,
        family: mockFamily,
      });

      const expectedChildren = [
        {
          id: 'child1',
          name: 'John',
          age: 8,
          familyId,
          groupMemberships: [{
            childId: 'child1',
            groupId: 'group1',
            group: { id: 'group1', name: 'School Group' },
          }],
        },
        {
          id: 'child2',
          name: 'Jane',
          age: 6,
          familyId,
          groupMemberships: [],
        },
      ];

      (mockPrisma.child.findMany as jest.Mock).mockResolvedValue(expectedChildren);

      const result = await childService.getChildrenByUser(userId);

      expect(mockPrisma.child.findMany).toHaveBeenCalledWith({
        where: { familyId },
        include: {
          groupMemberships: {
            include: {
              group: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: [{ name: 'asc' }],
      });
      expect(result).toEqual(expectedChildren);
    });

    it('should return empty array when user has no family', async () => {
      const userId = 'user123';
      
      // Mock no family found
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await childService.getChildrenByUser(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getChildById', () => {
    it('should return child by id for user', async () => {
      const childId = 'child123';
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId,
        familyId,
        family: mockFamily,
      });

      const expectedChild = {
        id: childId,
        name: 'John',
        age: 8,
        familyId,
      };

      (mockPrisma.child.findFirst as jest.Mock).mockResolvedValue(expectedChild);

      const result = await childService.getChildById(childId, userId);

      expect(mockPrisma.child.findFirst).toHaveBeenCalledWith({
        where: { id: childId, familyId },
      });
      expect(result).toEqual(expectedChild);
    });

    it('should throw error when child not found', async () => {
      const childId = 'child123';
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue({
        userId,
        familyId,
        family: mockFamily,
      });

      (mockPrisma.child.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(childService.getChildById(childId, userId)).rejects.toThrow('Child not found or access denied');
    });

    it('should throw error when user has no family', async () => {
      const childId = 'child123';
      const userId = 'user123';

      // Mock no family found
      (mockPrisma.familyMember.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(childService.getChildById(childId, userId)).rejects.toThrow('User must belong to a family to access children');
    });
  });

  describe('updateChild', () => {
    it('should update child successfully', async () => {
      const childId = 'child123';
      const userId = 'user123';
      const familyId = 'family123';
      const updateData = { name: 'Updated Name', age: 9 };
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyChildren call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getChildById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingChild = {
        id: childId,
        name: 'Old Name',
        age: 8,
        familyId,
      };

      const expectedChild = {
        id: childId,
        name: 'Updated Name',
        age: 9,
        familyId,
      };

      (mockPrisma.child.findFirst as jest.Mock).mockResolvedValue(existingChild);
      (mockPrisma.child.update as jest.Mock).mockResolvedValue(expectedChild);

      const result = await childService.updateChild(childId, userId, updateData);

      expect(mockPrisma.child.update).toHaveBeenCalledWith({
        where: { id: childId },
        data: {
          name: 'Updated Name',
          age: 9,
        },
      });
      expect(result).toEqual(expectedChild);
    });

    it('should update only age when only age is provided', async () => {
      const childId = 'child123';
      const userId = 'user123';
      const familyId = 'family123';
      const updateData = { age: 10 }; // Only updating age
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyChildren call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getChildById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingChild = {
        id: childId,
        name: 'Emmie',
        age: 12,
        familyId,
      };

      const expectedChild = {
        id: childId,
        name: 'Emmie',
        age: 10, // Updated age
        familyId,
      };

      (mockPrisma.child.findFirst as jest.Mock).mockResolvedValue(existingChild);
      (mockPrisma.child.update as jest.Mock).mockResolvedValue(expectedChild);

      const result = await childService.updateChild(childId, userId, updateData);

      expect(mockPrisma.child.update).toHaveBeenCalledWith({
        where: { id: childId },
        data: {
          age: 10, // Only age should be updated
        },
      });
      expect(result).toEqual(expectedChild);
    });

    it('should throw error when update fails', async () => {
      const childId = 'child123';
      const userId = 'user123';
      const familyId = 'family123';
      const updateData = { name: 'Updated Name' };
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyChildren call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getChildById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingChild = {
        id: childId,
        name: 'Old Name',
        age: 8,
        familyId,
      };

      (mockPrisma.child.findFirst as jest.Mock).mockResolvedValue(existingChild);
      (mockPrisma.child.update as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call once and expect it to throw the update failure error
      await expect(childService.updateChild(childId, userId, updateData)).rejects.toThrow('Failed to update child');
    });
  });

  describe('deleteChild', () => {
    it('should delete child successfully', async () => {
      const childId = 'child123';
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyChildren call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getChildById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingChild = {
        id: childId,
        name: 'John',
        age: 8,
        familyId,
      };

      (mockPrisma.child.findFirst as jest.Mock).mockResolvedValue(existingChild);
      (mockPrisma.child.delete as jest.Mock).mockResolvedValue(existingChild);

      const result = await childService.deleteChild(childId, userId);

      expect(mockPrisma.child.delete).toHaveBeenCalledWith({
        where: { id: childId },
      });
      expect(result).toEqual({ success: true });
    });

    it('should throw error when deletion fails', async () => {
      const childId = 'child123';
      const userId = 'user123';
      const familyId = 'family123';
      
      // Mock the family lookup
      const mockFamily = { id: familyId, name: 'Test Family' };
      
      // Setup ALL mocks before calling the function
      (mockPrisma.familyMember.findFirst as jest.Mock)
        .mockResolvedValueOnce({ // For getUserFamily call #1
          userId,
          familyId,
          family: mockFamily,
        })
        .mockResolvedValueOnce({ // For canUserModifyFamilyChildren call #2
          userId,
          familyId,
          role: 'ADMIN',
        })
        .mockResolvedValueOnce({ // For getChildById -> getUserFamily call #3
          userId,
          familyId,
          family: mockFamily,
        });

      const existingChild = {
        id: childId,
        name: 'John',
        age: 8,
        familyId,
      };

      (mockPrisma.child.findFirst as jest.Mock).mockResolvedValue(existingChild);
      (mockPrisma.child.delete as jest.Mock).mockRejectedValue(new Error('Database error'));

      // Call once and expect it to throw the deletion failure error
      await expect(childService.deleteChild(childId, userId)).rejects.toThrow('Failed to delete child');
    });
  });
});