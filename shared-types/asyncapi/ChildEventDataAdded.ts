import {ChildActionAdded} from './ChildActionAdded';
import type {ChildData} from './ChildData';
interface ChildEventDataAdded {
  familyId: string;
  childId: string;
  action: ChildActionAdded;
  child?: ChildData;
  additionalProperties?: Map<string, any>;
}
export type { ChildEventDataAdded };
