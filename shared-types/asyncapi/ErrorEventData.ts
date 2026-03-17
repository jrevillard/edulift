
interface ErrorEventData {
  reservedType: string;
  message: string;
  details?: Map<string, Map<string, any>>;
  additionalProperties?: Map<string, any>;
}
export type { ErrorEventData };
