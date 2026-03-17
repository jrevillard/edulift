import {VehicleActionAdded} from './VehicleActionAdded';
import {VehicleData} from './VehicleData';
interface VehicleEventDataAdded {
  familyId: string;
  vehicleId: string;
  action: VehicleActionAdded;
  vehicle?: VehicleData;
  additionalProperties?: Map<string, any>;
}
export { VehicleEventDataAdded };