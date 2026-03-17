import {FamilyUpdateAction} from './FamilyUpdateAction';
import type {FamilyData} from './FamilyData';
interface FamilyEventData {
  familyId: string;
  action: FamilyUpdateAction;
  family?: FamilyData;
  additionalProperties?: Map<string, any>;
}
export type { FamilyEventData };
