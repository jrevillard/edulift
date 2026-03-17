import {ChildActionUpdated} from './ChildActionUpdated';
import {ChildData} from './ChildData';
interface ChildEventDataUpdated {
  familyId: string;
  childId: string;
  action: ChildActionUpdated;
  child?: ChildData;
  additionalProperties?: Map<string, any>;
}
export { ChildEventDataUpdated };