type VisualViewportSize = Pick<VisualViewport, 'width' | 'height'>;

// clientWidth целый, а ширина визуального вьюпорта дробная, так что в покое их отношение бывает чуть больше 1
const PINCH_ZOOM_THRESHOLD = 1.01;

/** Во сколько раз страница увеличена щипком. Не visualViewport.scale: при раскладке шире экрана («Версия для ПК») он меньше 1 уже в покое */
function pinchZoomFactor(
    visualViewport: VisualViewportSize | null | undefined,
    layoutWidth: number
): number {
    if (!visualViewport || !(visualViewport.width > 0) || !(layoutWidth > 0)) {
        return 1;
    }
    const zoom = layoutWidth / visualViewport.width;
    return zoom > PINCH_ZOOM_THRESHOLD ? zoom : 1;
}

export function isPinchZoomed(
    visualViewport: VisualViewportSize | null | undefined,
    layoutWidth: number
): boolean {
    return pinchZoomFactor(visualViewport, layoutWidth) > 1;
}

/** Высота видимой области без щипкового зума: клавиатура её уменьшает, а зум нет, иначе при щипке сжималась бы вся вёрстка */
export function unzoomedViewportHeight(
    visualViewport: VisualViewportSize | null | undefined,
    layoutWidth: number,
    innerHeight: number
): number {
    // у неактивного документа visualViewport отдаёт нули
    if (!visualViewport || !(visualViewport.height > 0)) {
        return Math.round(innerHeight);
    }
    return Math.round(
        visualViewport.height * pinchZoomFactor(visualViewport, layoutWidth)
    );
}

/** Ширина раскладки, как её видят media queries: на iOS innerWidth при щипке падает до ширины визуального вьюпорта, а clientWidth не считает полосу прокрутки */
export function layoutViewportWidth(): number {
    return Math.max(window.innerWidth, document.documentElement.clientWidth);
}
