import { Segment } from '../../../../../../../../model/domain';

export interface DropdownSegmentMenuContentProps {
    index: number;
    segment: Segment;
}

export type ClickCheckboxParameter =
    | 'visible'
    | 'hideAssignment'
    | 'hideAssignmentWithValues'
    | 'hideValue'
    | 'hideGeneralFormula'
    | 'hideInflAssignment'
    | 'hideInflAssignmentWithValues'
    | 'hideInfl';
