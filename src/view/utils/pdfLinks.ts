/** Место назначения ссылки PDF: страница и точка в координатах PDF, null значит край страницы */
export type PdfDestinationTarget = {
    pageIndex: number;
    left: number | null;
    top: number | null;
};

export type PdfPageRef = { num: number; gen: number };

/** Часть PDFDocumentProxy, нужная для разбора назначений */
export interface PdfDestinationSource {
    numPages: number;
    getDestination(id: string): Promise<unknown[] | null>;
    getPageIndex(ref: PdfPageRef): Promise<number>;
}

const coordinate = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

const isPageRef = (value: unknown): value is PdfPageRef =>
    typeof value === 'object' &&
    value !== null &&
    Number.isInteger((value as PdfPageRef).num) &&
    Number.isInteger((value as PdfPageRef).gen);

/** Точка на странице по виду назначения, как считает scrollPageIntoView в pdf.js; масштаб назначения не применяем, у нас страница всегда по ширине */
function destinationPoint(
    dest: unknown[]
): Pick<PdfDestinationTarget, 'left' | 'top'> | null {
    const fit = dest[1];
    const name =
        typeof fit === 'object' && fit !== null
            ? (fit as { name?: unknown }).name
            : undefined;
    switch (name) {
        case 'XYZ':
            return { left: coordinate(dest[2]), top: coordinate(dest[3]) };
        case 'Fit':
        case 'FitB':
            return { left: null, top: null };
        case 'FitH':
        case 'FitBH':
            return { left: null, top: coordinate(dest[2]) };
        case 'FitV':
        case 'FitBV':
            return { left: coordinate(dest[2]), top: null };
        case 'FitR': {
            const [x1, y1, x2, y2] = dest.slice(2, 6).map(coordinate);
            return {
                left: x1 === null || x2 === null ? x1 : Math.min(x1, x2),
                top: y1 === null || y2 === null ? y1 : Math.max(y1, y2),
            };
        }
        default:
            return null;
    }
}

async function destinationPageIndex(
    page: unknown,
    source: PdfDestinationSource
): Promise<number | null> {
    let index: number | null = null;
    if (isPageRef(page)) {
        try {
            index = await source.getPageIndex(page);
        } catch {
            return null;
        }
    } else if (Number.isInteger(page)) {
        index = page as number;
    }
    if (index === null || index < 0 || index >= source.numPages) {
        return null;
    }
    return index;
}

/** Именованное назначение hyperref или явный массив [страница, вид, ...] превращает в страницу и точку, битое назначение даёт null */
export async function resolvePdfDestination(
    dest: string | unknown[] | null | undefined,
    source: PdfDestinationSource
): Promise<PdfDestinationTarget | null> {
    const explicit =
        typeof dest === 'string' ? await source.getDestination(dest) : dest;
    if (!Array.isArray(explicit)) {
        return null;
    }
    const point = destinationPoint(explicit);
    if (!point) {
        return null;
    }
    const pageIndex = await destinationPageIndex(explicit[0], source);
    if (pageIndex === null) {
        return null;
    }
    return { pageIndex, ...point };
}

/** Страница для именованного действия PDF (NextPage и соседи); истории переходов у нас нет, GoBack и прочее пропускаем */
export function namedActionPageIndex(
    action: string,
    currentPageIndex: number,
    pageCount: number
): number | null {
    let index: number;
    switch (action) {
        case 'NextPage':
            index = currentPageIndex + 1;
            break;
        case 'PrevPage':
            index = currentPageIndex - 1;
            break;
        case 'FirstPage':
            index = 0;
            break;
        case 'LastPage':
            index = pageCount - 1;
            break;
        default:
            return null;
    }
    return index >= 0 && index < pageCount ? index : null;
}

/** Текущая страница как у pdf.js: та, что занимает больше всего видимой области */
export function mostVisiblePageIndex(
    pages: { top: number; height: number }[],
    scrollTop: number,
    clientHeight: number
): number {
    const bottom = scrollTop + clientHeight;
    let best = 0;
    let bestVisible = -1;
    pages.forEach(({ top, height }, index) => {
        const visible =
            Math.min(bottom, top + height) - Math.max(scrollTop, top);
        if (visible > bestVisible) {
            best = index;
            bestVisible = visible;
        }
    });
    return best;
}

type Rect = { left: number; top: number; right: number; bottom: number };

/** Ближайший к точке прямоугольник не дальше radius; внутри прямоугольника расстояние 0, так что прямое попадание всегда выигрывает */
export function nearestRectIndex(
    rects: Rect[],
    x: number,
    y: number,
    radius: number
): number | null {
    let best: number | null = null;
    let bestDistance = radius;
    rects.forEach((rect, index) => {
        const dx = Math.max(rect.left - x, 0, x - rect.right);
        const dy = Math.max(rect.top - y, 0, y - rect.bottom);
        const distance = Math.hypot(dx, dy);
        if (distance <= bestDistance) {
            best = index;
            bestDistance = distance;
        }
    });
    return best;
}
