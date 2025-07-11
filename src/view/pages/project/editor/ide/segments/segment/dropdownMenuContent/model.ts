import { Segment } from "../../../../../../../../model/domain";

export interface DropdownSegmentMenuContentProps {
    index: number;
    segment: Segment;
}


export type ClickCheckboxParameter = 'visible' |  'hideAssignmentWithValues' | 'hideArray' | 'hideGeneralFormula' |  'hideInflAssignment' | 'hideInflAssignmentWithValues';