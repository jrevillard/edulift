import {VehicleActionDeleted} from './VehicleActionDeleted';
import type {VehicleData} from './VehicleData';
interface VehicleEventDataDeleted {
  familyId: string;
  vehicleId: string;
  action: VehicleActionDeleted;
  vehicle?: VehicleData;
  additionalProperties?: Map<string, any>;
}
export type { VehicleEventDataDeleted };
