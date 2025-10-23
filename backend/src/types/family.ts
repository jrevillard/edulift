import { 
  FamilyRole as PrismaFamilyRole, 
  Family as PrismaFamily,
  FamilyMember as PrismaFamilyMember,
  Child as PrismaChild,
  Vehicle as PrismaVehicle,
  User as PrismaUser,
} from '@prisma/client';

export { PrismaFamilyRole as FamilyRole };

// Use Prisma types with includes
export type Family = PrismaFamily & {
  members: (PrismaFamilyMember & { user: PrismaUser })[];
  children: PrismaChild[];
  vehicles: PrismaVehicle[];
};

export type FamilyMember = PrismaFamilyMember & {
  user: PrismaUser;
};

export type Child = PrismaChild;
export type Vehicle = PrismaVehicle;
export type User = PrismaUser;

export interface FamilyPermissions {
  canManageMembers: boolean;
  canModifyChildren: boolean;
  canModifyVehicles: boolean;
  canViewFamily: boolean;
}

export interface IFamilyService {
  createFamily(userId: string, name: string): Promise<Family>;
  joinFamily(inviteCode: string, userId: string): Promise<Family>;
  getUserFamily(userId: string): Promise<Family | null>;
  updateMemberRole(adminId: string, memberId: string, newRole: PrismaFamilyRole): Promise<void>;
  removeMember(adminId: string, memberId: string): Promise<void>;
  // generateNewInviteCode removed - using unified invitation system
}

export interface IFamilyAuthService {
  getUserPermissions(userId: string): Promise<FamilyPermissions>;
  canAccessChild(userId: string, childId: string): Promise<boolean>;
  canModifyChild(userId: string, childId: string): Promise<boolean>;
  canAccessVehicle(userId: string, vehicleId: string): Promise<boolean>;
  canModifyVehicle(userId: string, vehicleId: string): Promise<boolean>;
  requireFamilyRole(userId: string, requiredRole: PrismaFamilyRole): Promise<void>;
}

export class FamilyError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
  ) {
    super(message);
    this.name = 'FamilyError';
  }
}