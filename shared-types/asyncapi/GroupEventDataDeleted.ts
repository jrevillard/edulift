import {GroupActionDeleted} from './GroupActionDeleted';
import type {GroupData} from './GroupData';
interface GroupEventDataDeleted {
  groupId: string;
  action: GroupActionDeleted;
  deletedBy?: string;
  group?: GroupData;
  additionalProperties?: Map<string, any>;
}
export type { GroupEventDataDeleted };
