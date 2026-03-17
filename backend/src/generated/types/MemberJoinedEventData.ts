import {MemberActionJoined} from './MemberActionJoined';
interface MemberJoinedEventData {
  groupId: string;
  userId: string;
  action: MemberActionJoined;
  userName?: string;
  additionalProperties?: Map<string, any>;
}
export { MemberJoinedEventData };