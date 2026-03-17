import {MemberActionLeft} from './MemberActionLeft';
interface MemberLeftEventData {
  groupId: string;
  userId: string;
  action: MemberActionLeft;
  userName?: string;
  additionalProperties?: Map<string, any>;
}
export type { MemberLeftEventData };
