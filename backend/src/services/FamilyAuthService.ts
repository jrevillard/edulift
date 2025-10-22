import { PrismaClient, FamilyRole } from '@prisma/client';
import { FamilyPermissions, IFamilyAuthService, FamilyError } from '../types/family';

interface CacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl: number): Promise<void>;
}

export class FamilyAuthService implements IFamilyAuthService {
  private static readonly ROLE_HIERARCHY = {
    [FamilyRole.ADMIN]: 2,
    [FamilyRole.MEMBER]: 1
  };

  constructor(
    private prisma: PrismaClient,
    private cacheService: CacheService
  ) {}

  async getUserPermissions(userId: string): Promise<FamilyPermissions> {
    // Check cache first
    const cacheKey = `family_permissions:${userId}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) return cached;

    // Get user's family membership
    const member = await this.prisma.familyMember.findFirst({
      where: { userId },
      include: { family: true }
    });

    if (!member) {
      throw new FamilyError('USER_NOT_IN_FAMILY', 'User does not belong to any family');
    }

    // Calculate permissions based on role
    const permissions: FamilyPermissions = {
      canManageMembers: member.role === FamilyRole.ADMIN,
      canModifyChildren: member.role === FamilyRole.ADMIN,
      canModifyVehicles: member.role === FamilyRole.ADMIN,
      canViewFamily: true
    };

    // Cache for 5 minutes
    await this.cacheService.set(cacheKey, permissions, 300);

    return permissions;
  }

  async canAccessChild(userId: string, childId: string): Promise<boolean> {
    const child = await this.prisma.child.findUnique({
      where: { id: childId },
      select: { familyId: true }
    });

    if (!child) return false;

    const member = await this.prisma.familyMember.findFirst({
      where: { userId, familyId: child.familyId! }
    });

    return !!member;
  }

  async canModifyChild(userId: string, childId: string): Promise<boolean> {
    if (!await this.canAccessChild(userId, childId)) {
      return false;
    }

    const member = await this.prisma.familyMember.findFirst({
      where: { userId }
    });

    if (!member) return false;

    return member.role === FamilyRole.ADMIN;
  }

  async canAccessVehicle(userId: string, vehicleId: string): Promise<boolean> {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: { familyId: true }
    });

    if (!vehicle) return false;

    const member = await this.prisma.familyMember.findFirst({
      where: { userId, familyId: vehicle.familyId! }
    });

    return !!member;
  }

  async canModifyVehicle(userId: string, vehicleId: string): Promise<boolean> {
    if (!await this.canAccessVehicle(userId, vehicleId)) {
      return false;
    }

    const member = await this.prisma.familyMember.findFirst({
      where: { userId }
    });

    if (!member) return false;

    return member.role === FamilyRole.ADMIN;
  }

  async requireFamilyRole(userId: string, requiredRole: FamilyRole): Promise<void> {
    const member = await this.prisma.familyMember.findFirst({
      where: { userId }
    });

    if (!member) {
      throw new FamilyError('USER_NOT_IN_FAMILY', 'User does not belong to any family');
    }

    const userLevel = FamilyAuthService.ROLE_HIERARCHY[member.role];
    const requiredLevel = FamilyAuthService.ROLE_HIERARCHY[requiredRole];

    if (userLevel < requiredLevel) {
      throw new FamilyError('INSUFFICIENT_PERMISSIONS', 'User does not have required family role');
    }
  }
}