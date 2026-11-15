import { Segment } from '../../../../../../../../model/domain';

export interface DropdownSegmentMenuContentProps {
    index: number;
    segment: Segment;
    /** Parameter checkboxes: hidden for a shared project of another user */
    parametersEditable?: boolean;
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
