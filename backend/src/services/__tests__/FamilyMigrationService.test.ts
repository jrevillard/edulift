import { FamilyMigrationService } from '../FamilyMigrationService';
import { FamilyRole } from '../../types/family';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  $transaction: jest.fn(),
  user: {
    findMany: jest.fn(),
  },
  family: {
    findMany: jest.fn(),
  },
  child: {
    findMany: jest.fn(),
  },
  vehicle: {
    findMany: jest.fn(),
  },
} as any;

// Mock Logger
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('FamilyMigrationService', () => {
  let migrationService: FamilyMigrationService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    migrationService = new FamilyMigrationService(
      mockPrisma as PrismaClient,
      mockLogger,
    );
  });

  describe('migrateExistingUsersToFamilies', () => {
    it('should migrate all users to families with their children and vehicles', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          name: 'John Doe',
          children: [
            { id: 'child-1', name: 'Alice' },
            { id: 'child-2', name: 'Bob' },
          ],
          vehicles: [
            { id: 'vehicle-1', name: 'Car' },
          ],
        },
        {
          id: 'user-2',
          name: 'Jane Smith',
          children: [
            { id: 'child-3', name: 'Charlie' },
          ],
          vehicles: [],
        },
      ];

      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          user: {
            findMany: jest.fn().mockResolvedValue(mockUsers),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({}),
          },
          family: {
            create: jest.fn().mockImplementation(({ data }) => ({
              id: `family-${data.name}`,
              ...data,
            })),
          },
          child: {
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          vehicle: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      const result = await migrationService.migrateExistingUsersToFamilies();

      expect(result).toEqual({
        totalUsers: 2,
        familiesCreated: 2,
        childrenMigrated: 3,
        vehiclesMigrated: 1,
        errors: [],
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Starting family migration for existing users');
      expect(mockLogger.info).toHaveBeenCalledWith('Found 2 users to migrate');
    });

    it('should skip users who already have family membership', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          name: 'John Doe',
          children: [],
          vehicles: [],
        },
      ];

      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          user: {
            findMany: jest.fn().mockResolvedValue(mockUsers),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue({ id: 'existing-membership' }),
            create: jest.fn(),
          },
          family: {
            create: jest.fn(),
          },
          child: {
            updateMany: jest.fn(),
          },
          vehicle: {
            updateMany: jest.fn(),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      const result = await migrationService.migrateExistingUsersToFamilies();

      expect(result).toEqual({
        totalUsers: 1,
        familiesCreated: 0,
        childrenMigrated: 0,
        vehiclesMigrated: 0,
        errors: [],
      });

      expect(mockLogger.warn).toHaveBeenCalledWith('User user-1 already has family membership, skipping');
    });

    it('should handle migration errors gracefully', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          name: 'John Doe',
          children: [],
          vehicles: [],
        },
      ];

      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          user: {
            findMany: jest.fn().mockResolvedValue(mockUsers),
          },
          familyMember: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockRejectedValue(new Error('Database error')),
          },
          family: {
            create: jest.fn().mockResolvedValue({ id: 'family-1' }),
          },
          child: {
            updateMany: jest.fn(),
          },
          vehicle: {
            updateMany: jest.fn(),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      const result = await migrationService.migrateExistingUsersToFamilies();

      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to migrate user user-1');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('rollbackMigration', () => {
    it('should rollback family migration successfully', async () => {
      const mockFamilies = [
        {
          id: 'family-1',
          name: 'Family One',
          members: [
            { userId: 'user-1', role: FamilyRole.ADMIN },
            { userId: 'user-2', role: FamilyRole.MEMBER },
          ],
          children: [
            { id: 'child-1' },
            { id: 'child-2' },
          ],
          vehicles: [
            { id: 'vehicle-1' },
          ],
        },
      ];

      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          family: {
            findMany: jest.fn().mockResolvedValue(mockFamilies),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          familyMember: {
            deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          child: {
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          vehicle: {
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      const result = await migrationService.rollbackMigration();

      expect(result).toEqual({
        totalUsers: 2,
        familiesCreated: -1, // Negative indicates deletion
        childrenMigrated: 2,
        vehiclesMigrated: 1,
        errors: [],
      });

      expect(mockLogger.info).toHaveBeenCalledWith('Starting family migration rollback');
    });

    it('should handle families without admin during rollback', async () => {
      const mockFamilies = [
        {
          id: 'family-1',
          name: 'Family One',
          members: [
            { userId: 'user-1', role: FamilyRole.MEMBER },
          ],
          children: [],
          vehicles: [],
        },
      ];

      const mockTransaction = jest.fn(async (callback) => {
        return callback({
          family: {
            findMany: jest.fn().mockResolvedValue(mockFamilies),
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          familyMember: {
            deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          child: {
            updateMany: jest.fn(),
          },
          vehicle: {
            updateMany: jest.fn(),
          },
        });
      });

      mockPrisma.$transaction.mockImplementation(mockTransaction);

      const result = await migrationService.rollbackMigration();

      expect(result.errors).toContain('No admin found for family family-1');
    });
  });

  describe('validateMigration', () => {
    it('should return true when migration is valid', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.child.findMany.mockResolvedValue([]);
      mockPrisma.vehicle.findMany.mockResolvedValue([]);

      const result = await migrationService.validateMigration();

      expect(result).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith('Migration validation passed');
    });

    it('should return false when users without families exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'user-1' }]);
      mockPrisma.child.findMany.mockResolvedValue([]);
      mockPrisma.vehicle.findMany.mockResolvedValue([]);

      const result = await migrationService.validateMigration();

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Found 1 users without families');
    });

    it('should return false when children without families exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.child.findMany.mockResolvedValue([{ id: 'child-1' }]);
      mockPrisma.vehicle.findMany.mockResolvedValue([]);

      const result = await migrationService.validateMigration();

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Found 1 children without families');
    });

    it('should return false when vehicles without families exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.child.findMany.mockResolvedValue([]);
      mockPrisma.vehicle.findMany.mockResolvedValue([{ id: 'vehicle-1' }]);

      const result = await migrationService.validateMigration();

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Found 1 vehicles without families');
    });

    it('should handle validation errors', async () => {
      mockPrisma.user.findMany.mockRejectedValue(new Error('Database error'));

      const result = await migrationService.validateMigration();

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith('Migration validation failed: Error: Database error');
    });
  });
});