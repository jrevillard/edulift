import {ScheduleSlotActionDeleted} from './ScheduleSlotActionDeleted';
import {ScheduleSlotData} from './ScheduleSlotData';
interface ScheduleSlotEventDataDeleted {
  groupId: string;
  scheduleSlotId: string;
  action: ScheduleSlotActionDeleted;
  slot?: ScheduleSlotData;
  additionalProperties?: Map<string, any>;
}
export { ScheduleSlotEventDataDeleted };