import {ConflictType} from './ConflictType';
interface ConflictEventData {
  scheduleSlotId: string;
  conflictType: ConflictType;
  affectedUsers: string[];
  message?: string;
  additionalProperties?: Map<string, any>;
}
export { ConflictEventData };