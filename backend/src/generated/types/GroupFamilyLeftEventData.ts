import {GroupFamilyActionRemoved} from './GroupFamilyActionRemoved';
interface GroupFamilyLeftEventData {
  groupId: string;
  familyId: string;
  action: GroupFamilyActionRemoved;
  removedBy?: string;
  additionalProperties?: Map<string, any>;
}
export { GroupFamilyLeftEventData };