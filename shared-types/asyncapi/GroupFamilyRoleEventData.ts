import {FamilyRole} from './FamilyRole';
interface GroupFamilyRoleEventData {
  groupId: string;
  familyId: string;
  newRole: FamilyRole;
  previousRole?: FamilyRole;
  updatedBy?: string;
  additionalProperties?: Map<string, any>;
}
export type { GroupFamilyRoleEventData };
