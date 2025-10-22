import { GroupRole } from '@prisma/client';

export interface CreateGroupData {
  name: string;
  description?: string | undefined; // Optional group description
  familyId: string;  // Groups are created by families
  createdBy: string; // User who created it (must be family ADMIN)
}

export interface JoinGroupData {
  familyId: string;  // Family joining the group
  groupId: string;
  role?: GroupRole;
  addedBy: string;   // User who added the family
}

export interface InviteFamilyToGroupData {
  familyId: string;           // Target family ID to invite
  role?: GroupRole;           // Role for the family in this group (defaults to MEMBER)
  personalMessage?: string;
}

export interface FamilySearchResult {
  id: string;
  name: string;
  adminContacts: Array<{
    name: string;
    email: string;
  }>;
  memberCount: number;
  canInvite: boolean;
}

