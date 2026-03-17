import {ChildActionDeleted} from './ChildActionDeleted';
import {ChildData} from './ChildData';
interface ChildEventDataDeleted {
  familyId: string;
  childId: string;
  action: ChildActionDeleted;
  child?: ChildData;
  additionalProperties?: Map<string, any>;
}
export { ChildEventDataDeleted };