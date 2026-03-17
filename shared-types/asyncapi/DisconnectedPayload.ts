import {DisconnectReason} from './DisconnectReason';
interface DisconnectedPayload {
  reason: DisconnectReason;
  timestamp: number;
  additionalProperties?: Map<string, any>;
}
export type { DisconnectedPayload };
