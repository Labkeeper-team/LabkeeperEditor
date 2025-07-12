import { SegmentType } from '../../../../../../../model/domain';
import { EventValues } from '../../../../../../../model/service/observer';

export interface EditorTypeDivider {
    type: SegmentType;
    text: string;
    event1: EventValues;
    event2?: EventValues;
}
export interface SegmentDividerProps {
    showDivider: boolean;
    index: number;
}
