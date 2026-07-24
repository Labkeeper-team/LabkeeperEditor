export type DropdownPlacement = 'top' | 'bottom';

type GetDropdownPlacementParams = {
    triggerRect: DOMRect; // расположение кнопки на экране
    dropdownHeight: number; // высота модалки тегов (px)
    boundaryRect?: DOMRect | null; // рамка скролла (списка проектов)
    viewportHeight: number; // высота видимой области окна
};

export const getDropdownPlacement = ({
    triggerRect,
    dropdownHeight,
    boundaryRect,
    viewportHeight,
}: GetDropdownPlacementParams): DropdownPlacement => {
    const viewportTop = 0;
    const viewportBottom = Math.max(0, Math.floor(viewportHeight));
    const boundaryTop = boundaryRect
        ? Math.max(viewportTop, boundaryRect.top)
        : viewportTop;
    const boundaryBottom = boundaryRect
        ? Math.min(viewportBottom, boundaryRect.bottom)
        : viewportBottom;
    const availableBelow = Math.max(0, boundaryBottom - triggerRect.bottom);
    const availableAbove = Math.max(0, triggerRect.top - boundaryTop);
    const requiredHeight = dropdownHeight / 0.95;
    const fitsBelow = availableBelow >= requiredHeight;
    const fitsAbove = availableAbove >= requiredHeight;
    if (fitsBelow) {
        return 'bottom';
    }
    if (fitsAbove) {
        return 'top';
    }
    return 'bottom';
};
