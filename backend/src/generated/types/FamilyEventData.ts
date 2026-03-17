import {FamilyUpdateAction} from './FamilyUpdateAction';
import {FamilyData} from './FamilyData';
interface FamilyEventData {
  familyId: string;
  action: FamilyUpdateAction;
  family?: FamilyData;
  additionalProperties?: Map<string, any>;
}
export { FamilyEventData };