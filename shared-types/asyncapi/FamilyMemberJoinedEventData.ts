import {MemberActionJoined} from './MemberActionJoined';
interface FamilyMemberJoinedEventData {
  familyId: string;
  userId: string;
  action: MemberActionJoined;
  userName?: string;
  role?: string;
  additionalProperties?: Map<string, any>;
}
export type { FamilyMemberJoinedEventData };
