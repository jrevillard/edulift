import {VehicleActionDeleted} from './VehicleActionDeleted';
import {VehicleData} from './VehicleData';
interface VehicleEventDataDeleted {
  familyId: string;
  vehicleId: string;
  action: VehicleActionDeleted;
  vehicle?: VehicleData;
  additionalProperties?: Map<string, any>;
}
export { VehicleEventDataDeleted };