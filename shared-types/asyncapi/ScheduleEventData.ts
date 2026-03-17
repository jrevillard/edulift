
interface ScheduleEventData {
  groupId: string;
  week: string;
  schedule?: Map<string, Map<string, any>>;
  additionalProperties?: Map<string, any>;
}
export type { ScheduleEventData };
