import {GroupActionDeleted} from './GroupActionDeleted';
import {GroupData} from './GroupData';
interface GroupEventDataDeleted {
  groupId: string;
  action: GroupActionDeleted;
  deletedBy?: string;
  group?: GroupData;
  additionalProperties?: Map<string, any>;
}
export { GroupEventDataDeleted };