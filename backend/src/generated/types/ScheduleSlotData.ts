
interface ScheduleSlotData {
  id?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  capacity?: number;
  currentLoad?: number;
  additionalProperties?: Map<string, Map<string, any>>;
}
export { ScheduleSlotData };