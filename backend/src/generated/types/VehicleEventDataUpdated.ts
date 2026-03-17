import {VehicleActionUpdated} from './VehicleActionUpdated';
import {VehicleData} from './VehicleData';
interface VehicleEventDataUpdated {
  familyId: string;
  vehicleId: string;
  action: VehicleActionUpdated;
  vehicle?: VehicleData;
  additionalProperties?: Map<string, any>;
}
export { VehicleEventDataUpdated };