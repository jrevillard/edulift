import {CapacityStatusFull} from './CapacityStatusFull';
interface ScheduleSlotCapacityFullEventData {
  groupId: string;
  scheduleSlotId: string;
  reservedStatus: CapacityStatusFull;
  currentLoad?: number;
  capacity?: number;
  message?: string;
  additionalProperties?: Map<string, any>;
}
export { ScheduleSlotCapacityFullEventData };