import { ActivityLogRepository } from '../ActivityLogRepository';

// Mock Prisma with necessary models for ActivityLogRepository
const mockPrisma = {
  activityLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  familyMember: {
    findMany: jest.fn(),
  },
  child: {
    findMany: jest.fn(),
  },
  vehicle: {
    findMany: jest.fn(),
  },
  groupMember: {
    findMany: jest.fn(),
  },
  groupInvitation: {
    findMany: jest.fn(),
  },
  familyInvitation: {
    findMany: jest.fn(),
  },
} as any;

describe('ActivityLogRepository', () => {
  let activityLogRepository: ActivityLogRepository;

  beforeEach(() => {
    activityLogRepository = new ActivityLogRepository(mockPrisma);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createActivity', () => {
    it('should create a new activity log entry', async () => {
      // Arrange
      const activityData = {
        userId: 'user-123',
        actionType: 'GROUP_JOIN',
        actionDescription: 'Joined group "Maple Street Families"',
        entityType: 'group',
        entityId: 'group-1',
        entityName: 'Maple Street Families',
      };

      const expectedActivity = {
        id: 'activity-123',
        userId: activityData.userId,
        actionType: activityData.actionType,
        actionDescription: activityData.actionDescription,
        entityType: activityData.entityType,
        entityId: activityData.entityId,
        entityName: activityData.entityName,
        metadata: null,
        createdAt: new Date(),
      };

      // Mock the activityLog.create call
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue(expectedActivity);

      // Act
      const result = await activityLogRepository.createActivity(activityData);

      // Assert
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: activityData.userId,
          actionType: activityData.actionType,
          actionDescription: activityData.actionDescription,
          entityType: activityData.entityType,
          entityId: activityData.entityId,
          entityName: activityData.entityName,
          metadata: null,
        },
      });
      expect(result).toEqual(expectedActivity);
    });

    it('should create activity with metadata', async () => {
      // Arrange
      const activityData = {
        userId: 'user-123',
        actionType: 'VEHICLE_ADD',
        actionDescription: 'Added vehicle Honda Civic',
        entityType: 'vehicle',
        entityId: 'vehicle-1',
        entityName: 'Honda Civic',
        metadata: { capacity: 4, color: 'blue' },
      };

      const expectedActivity = {
        id: 'activity-456',
        userId: activityData.userId,
        actionType: activityData.actionType,
        actionDescription: activityData.actionDescription,
        entityType: activityData.entityType,
        entityId: activityData.entityId,
        entityName: activityData.entityName,
        metadata: activityData.metadata,
        createdAt: new Date(),
      };

      // Mock the activityLog.create call
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue(expectedActivity);

      // Act
      const result = await activityLogRepository.createActivity(activityData);

      // Assert
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: activityData.userId,
          actionType: activityData.actionType,
          actionDescription: activityData.actionDescription,
          entityType: activityData.entityType,
          entityId: activityData.entityId,
          entityName: activityData.entityName,
          metadata: activityData.metadata,
        },
      });
      expect(result).toEqual(expectedActivity);
    });

    it('should create activity even with minimal data', async () => {
      // Arrange
      const activityData = {
        userId: 'user-123',
        actionType: 'GROUP_JOIN',
        actionDescription: 'Joined group',
        entityType: 'group',
      };

      const expectedActivity = {
        id: 'activity-789',
        userId: activityData.userId,
        actionType: activityData.actionType,
        actionDescription: activityData.actionDescription,
        entityType: activityData.entityType,
        entityId: null,
        entityName: null,
        metadata: null,
        createdAt: new Date(),
      };

      // Mock the activityLog.create call
      (mockPrisma.activityLog.create as jest.Mock).mockResolvedValue(expectedActivity);

      // Act
      const result = await activityLogRepository.createActivity(activityData);

      // Assert
      expect(mockPrisma.activityLog.create).toHaveBeenCalledWith({
        data: {
          userId: activityData.userId,
          actionType: activityData.actionType,
          actionDescription: activityData.actionDescription,
          entityType: activityData.entityType,
          entityId: null,
          entityName: null,
          metadata: null,
        },
      });
      expect(result).toEqual(expectedActivity);
    });
  });

  describe('getRecentActivityForUser', () => {
    it('should fetch recent activities for a user with default limit', async () => {
      // Arrange
      const userId = 'user-123';
      
      const expectedActivities = [
        {
          id: 'activity-1',
          userId,
          actionType: 'GROUP_JOIN',
          actionDescription: 'Joined group "Maple Street Families"',
          entityType: 'group',
          entityId: 'group-1',
          entityName: 'Maple Street Families',
          metadata: null,
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 'activity-2',
          userId,
          actionType: 'VEHICLE_ADD',
          actionDescription: 'Added vehicle Honda Civic',
          entityType: 'vehicle',
          entityId: 'vehicle-1',
          entityName: 'Honda Civic',
          metadata: null,
          createdAt: new Date('2023-01-02'),
        }
      ];

      // Mock the activityLog.findMany call
      (mockPrisma.activityLog.findMany as jest.Mock).mockResolvedValue(expectedActivities);

      // Act
      const result = await activityLogRepository.getRecentActivityForUser(userId);

      // Assert
      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      expect(result).toEqual(expectedActivities);
      expect(result).toHaveLength(2);
    });

    it('should fetch recent activities with custom limit', async () => {
      // Arrange
      const userId = 'user-123';
      const limit = 1;
      
      const expectedActivities = [
        {
          id: 'activity-1',
          userId,
          actionType: 'GROUP_JOIN',
          actionDescription: 'Joined group "Maple Street Families"',
          entityType: 'group',
          entityId: 'group-1',
          entityName: 'Maple Street Families',
          metadata: null,
          createdAt: new Date('2023-01-01'),
        }
      ];

      // Mock the activityLog.findMany call
      (mockPrisma.activityLog.findMany as jest.Mock).mockResolvedValue(expectedActivities);

      // Act
      const result = await activityLogRepository.getRecentActivityForUser(userId, limit);

      // Assert
      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      expect(result).toEqual(expectedActivities);
      expect(result).toHaveLength(1);
    });

    it('should return mock data for any user (using mock implementation)', async () => {
      // Arrange
      const userId = 'different-user-456';
      
      const expectedActivities = [
        {
          id: 'activity-3',
          userId,
          actionType: 'CHILD_ADD',
          actionDescription: 'Added child "Emma"',
          entityType: 'child',
          entityId: 'child-1',
          entityName: 'Emma',
          metadata: { age: 7 },
          createdAt: new Date('2023-01-01'),
        },
        {
          id: 'activity-4',
          userId,
          actionType: 'GROUP_JOIN',
          actionDescription: 'Joined group "Soccer Club"',
          entityType: 'group',
          entityId: 'group-2',
          entityName: 'Soccer Club',
          metadata: null,
          createdAt: new Date('2023-01-02'),
        }
      ];

      // Mock the activityLog.findMany call
      (mockPrisma.activityLog.findMany as jest.Mock).mockResolvedValue(expectedActivities);

      // Act
      const result = await activityLogRepository.getRecentActivityForUser(userId);

      // Assert
      expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      expect(result).toEqual(expectedActivities);
      expect(result).toHaveLength(2);
    });
  });
});