import { SegmentType } from '../../../../../../../model/domain';

export interface EditorTypeDivider {
    type: SegmentType;
    text: string;
}
export interface SegmentDividerProps {
    showDivider: boolean;
    index: number;
}
