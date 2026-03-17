import {NotificationType} from './NotificationType';
interface NotificationEventData {
  reservedType: NotificationType;
  message: string;
  data?: Map<string, Map<string, any>>;
  additionalProperties?: Map<string, any>;
}
export type { NotificationEventData };
