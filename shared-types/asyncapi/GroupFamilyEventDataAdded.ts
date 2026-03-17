import {GroupFamilyActionAdded} from './GroupFamilyActionAdded';
interface GroupFamilyEventDataAdded {
  groupId: string;
  familyId: string;
  action: GroupFamilyActionAdded;
  familyName?: string;
  joinedBy?: string;
  additionalProperties?: Map<string, any>;
}
export type { GroupFamilyEventDataAdded };
