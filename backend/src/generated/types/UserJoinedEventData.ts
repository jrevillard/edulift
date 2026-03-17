import {MemberActionJoined} from './MemberActionJoined';
interface UserJoinedEventData {
  userId: string;
  groupId: string;
  action: MemberActionJoined;
  userName?: string;
  additionalProperties?: Map<string, any>;
}
export { UserJoinedEventData };