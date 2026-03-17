import {ScheduleSlotActionCreated} from './ScheduleSlotActionCreated';
import {ScheduleSlotData} from './ScheduleSlotData';
interface ScheduleSlotEventDataCreated {
  groupId: string;
  scheduleSlotId: string;
  action: ScheduleSlotActionCreated;
  slot?: ScheduleSlotData;
  additionalProperties?: Map<string, any>;
}
export { ScheduleSlotEventDataCreated };