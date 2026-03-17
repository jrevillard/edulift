
interface VehicleData {
  id?: string;
  make?: string;
  model?: string;
  year?: number;
  capacity?: number;
  additionalProperties?: Map<string, Map<string, any>>;
}
export type { VehicleData };
