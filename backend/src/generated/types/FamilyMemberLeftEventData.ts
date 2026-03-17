import {MemberActionLeft} from './MemberActionLeft';
interface FamilyMemberLeftEventData {
  familyId: string;
  userId: string;
  action: MemberActionLeft;
  userName?: string;
  role?: string;
  additionalProperties?: Map<string, any>;
}
export { FamilyMemberLeftEventData };