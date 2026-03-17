import {GroupActionUpdated} from './GroupActionUpdated';
import {GroupData} from './GroupData';
interface GroupEventDataUpdated {
  groupId: string;
  action: GroupActionUpdated;
  updatedBy?: string;
  group?: GroupData;
  additionalProperties?: Map<string, any>;
}
export { GroupEventDataUpdated };