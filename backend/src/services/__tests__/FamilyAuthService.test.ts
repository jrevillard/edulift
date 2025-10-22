import { FamilyAuthService } from '../FamilyAuthService';
import { FamilyError, FamilyRole } from '../../types/family';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  familyMember: {
    findFirst: jest.fn()
  },
  child: {
    findUnique: jest.fn()
  },
  vehicle: {
    findUnique: jest.fn()
  }
} as any;

// Mock Cache Service
const mockCacheService = {
  get: jest.fn(),
  set: jest.fn()
};

describe('FamilyAuthService', () => {
  let familyAuthService: FamilyAuthService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    familyAuthService = new FamilyAuthService(
      mockPrisma as PrismaClient,
      mockCacheService
    );
  });

  describe('getUserPermissions', () => {
    const userId = 'user-123';

    it('should return admin permissions for ADMIN role', async () => {
      // Mock user is ADMIN
      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.ADMIN,
        family: { id: 'family-123', name: 'Test Family' }
      });

      const permissions = await familyAuthService.getUserPermissions(userId);

      expect(permissions).toEqual({
        canManageMembers: true,
        canModifyChildren: true,
        canModifyVehicles: true,
        canViewFamily: true
      });

      expect(mockCacheService.set).toHaveBeenCalledWith(
        `family_permissions:${userId}`,
        permissions,
        300
      );
    });

    it('should return member permissions for MEMBER role', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.MEMBER,
        family: { id: 'family-123', name: 'Test Family' }
      });

      const permissions = await familyAuthService.getUserPermissions(userId);

      expect(permissions).toEqual({
        canManageMembers: false,
        canModifyChildren: false,
        canModifyVehicles: false,
        canViewFamily: true
      });
    });

    it('should return cached permissions when available', async () => {
      const cachedPermissions = {
        canManageMembers: true,
        canModifyChildren: true,
        canModifyVehicles: true,
        canViewFamily: true
      };

      mockCacheService.get.mockResolvedValue(cachedPermissions);

      const permissions = await familyAuthService.getUserPermissions(userId);

      expect(permissions).toEqual(cachedPermissions);
      expect(mockPrisma.familyMember.findFirst).not.toHaveBeenCalled();
    });

    it('should throw error if user not in family', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      await expect(familyAuthService.getUserPermissions(userId))
        .rejects
        .toThrow(new FamilyError('USER_NOT_IN_FAMILY', 'User does not belong to any family'));
    });
  });

  describe('canAccessChild', () => {
    const userId = 'user-123';
    const childId = 'child-456';

    it('should return true if child belongs to user family', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({
        id: childId,
        familyId: 'family-123'
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123'
      });

      const result = await familyAuthService.canAccessChild(userId, childId);

      expect(result).toBe(true);
      expect(mockPrisma.child.findUnique).toHaveBeenCalledWith({
        where: { id: childId },
        select: { familyId: true }
      });
    });

    it('should return false if child does not exist', async () => {
      mockPrisma.child.findUnique.mockResolvedValue(null);

      const result = await familyAuthService.canAccessChild(userId, childId);

      expect(result).toBe(false);
    });

    it('should return false if user not in same family as child', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({
        id: childId,
        familyId: 'family-123'
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      const result = await familyAuthService.canAccessChild(userId, childId);

      expect(result).toBe(false);
    });
  });

  describe('canModifyChild', () => {
    const userId = 'user-123';
    const childId = 'child-456';

    it('should return true if user is ADMIN and can access child', async () => {
      // Setup child access
      mockPrisma.child.findUnique.mockResolvedValue({
        id: childId,
        familyId: 'family-123'
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.ADMIN
      });

      const result = await familyAuthService.canModifyChild(userId, childId);

      expect(result).toBe(true);
    });

    it('should return true if user is ADMIN and can access child', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({
        id: childId,
        familyId: 'family-123'
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.ADMIN
      });

      const result = await familyAuthService.canModifyChild(userId, childId);

      expect(result).toBe(true);
    });

    it('should return false if user is MEMBER', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({
        id: childId,
        familyId: 'family-123'
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.MEMBER
      });

      const result = await familyAuthService.canModifyChild(userId, childId);

      expect(result).toBe(false);
    });

    it('should return false if user cannot access child', async () => {
      mockPrisma.child.findUnique.mockResolvedValue(null);

      const result = await familyAuthService.canModifyChild(userId, childId);

      expect(result).toBe(false);
    });
  });

  describe('canAccessVehicle', () => {
    const userId = 'user-123';
    const vehicleId = 'vehicle-456';

    it('should return true if vehicle belongs to user family', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        familyId: 'family-123'
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123'
      });

      const result = await familyAuthService.canAccessVehicle(userId, vehicleId);

      expect(result).toBe(true);
    });

    it('should return false if vehicle does not exist', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue(null);

      const result = await familyAuthService.canAccessVehicle(userId, vehicleId);

      expect(result).toBe(false);
    });
  });

  describe('canModifyVehicle', () => {
    const userId = 'user-123';
    const vehicleId = 'vehicle-456';

    it('should return true if user is ADMIN and can access vehicle', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        familyId: 'family-123'
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.ADMIN
      });

      const result = await familyAuthService.canModifyVehicle(userId, vehicleId);

      expect(result).toBe(true);
    });

    it('should return false if user is MEMBER', async () => {
      mockPrisma.vehicle.findUnique.mockResolvedValue({
        id: vehicleId,
        familyId: 'family-123'
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.MEMBER
      });

      const result = await familyAuthService.canModifyVehicle(userId, vehicleId);

      expect(result).toBe(false);
    });
  });

  describe('requireFamilyRole', () => {
    const userId = 'user-123';

    it('should not throw if user has required role', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.ADMIN
      });

      await expect(familyAuthService.requireFamilyRole(userId, FamilyRole.ADMIN))
        .resolves
        .not.toThrow();
    });

    it('should not throw if user has higher role than required', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.ADMIN
      });

      await expect(familyAuthService.requireFamilyRole(userId, FamilyRole.MEMBER))
        .resolves
        .not.toThrow();
    });

    it('should throw error if user has insufficient role', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        id: 'member-123',
        userId,
        familyId: 'family-123',
        role: FamilyRole.MEMBER
      });

      await expect(familyAuthService.requireFamilyRole(userId, FamilyRole.ADMIN))
        .rejects
        .toThrow(new FamilyError('INSUFFICIENT_PERMISSIONS', 'User does not have required family role'));
    });

    it('should throw error if user not in family', async () => {
      mockPrisma.familyMember.findFirst.mockResolvedValue(null);

      await expect(familyAuthService.requireFamilyRole(userId, FamilyRole.MEMBER))
        .rejects
        .toThrow(new FamilyError('USER_NOT_IN_FAMILY', 'User does not belong to any family'));
    });
  });
});