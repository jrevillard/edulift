
interface ConnectedPayload {
  userId: string;
  groups?: string[];
  timestamp: number;
  additionalProperties?: Map<string, any>;
}
export type { ConnectedPayload };
