import {GroupActionCreated} from './GroupActionCreated';
import type {GroupData} from './GroupData';
interface GroupEventDataCreated {
  groupId: string;
  action: GroupActionCreated;
  createdBy?: string;
  group?: GroupData;
  additionalProperties?: Map<string, any>;
}
export type { GroupEventDataCreated };
