import {CapacityStatusWarning} from './CapacityStatusWarning';
interface ScheduleSlotCapacityWarningEventData {
  groupId: string;
  scheduleSlotId: string;
  reservedStatus: CapacityStatusWarning;
  currentLoad?: number;
  capacity?: number;
  message?: string;
  additionalProperties?: Map<string, any>;
}
export { ScheduleSlotCapacityWarningEventData };