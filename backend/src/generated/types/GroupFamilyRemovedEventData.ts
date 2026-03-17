import {GroupFamilyActionRemoved} from './GroupFamilyActionRemoved';
interface GroupFamilyRemovedEventData {
  groupId: string;
  familyId: string;
  action: GroupFamilyActionRemoved;
  removedBy?: string;
  additionalProperties?: Map<string, any>;
}
export { GroupFamilyRemovedEventData };