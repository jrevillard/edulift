import {MemberActionLeft} from './MemberActionLeft';
interface UserLeftEventData {
  userId: string;
  groupId: string;
  action: MemberActionLeft;
  userName?: string;
  additionalProperties?: Map<string, any>;
}
export type { UserLeftEventData };
