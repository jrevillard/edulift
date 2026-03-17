import {ScheduleSlotActionUpdated} from './ScheduleSlotActionUpdated';
import {ScheduleSlotData} from './ScheduleSlotData';
interface ScheduleSlotEventDataUpdated {
  groupId: string;
  scheduleSlotId: string;
  action: ScheduleSlotActionUpdated;
  slot?: ScheduleSlotData;
  additionalProperties?: Map<string, any>;
}
export { ScheduleSlotEventDataUpdated };