import { SegmentType } from '../../model/domain';

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

export const isElementTextTruncated = (element: Element | null): boolean => {
    if (!(element instanceof HTMLElement)) {
        return false;
    }

    return (
        element.scrollHeight > element.clientHeight + 1 ||
        element.scrollWidth > element.clientWidth + 1
    );
};
