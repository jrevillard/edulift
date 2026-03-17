import {ScheduleSlotActionDeleted} from './ScheduleSlotActionDeleted';
import type {ScheduleSlotData} from './ScheduleSlotData';
interface ScheduleSlotEventDataDeleted {
  groupId: string;
  scheduleSlotId: string;
  action: ScheduleSlotActionDeleted;
  slot?: ScheduleSlotData;
  additionalProperties?: Map<string, any>;
}
export type { ScheduleSlotEventDataDeleted };
