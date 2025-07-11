import { SegmentType } from "../../model/domain";

export const createEmptySegment = (type: SegmentType) => {
    return {
        id: -1,
        type,
        parameters: {
            visible: true,
        },
        text: '',
    };
};