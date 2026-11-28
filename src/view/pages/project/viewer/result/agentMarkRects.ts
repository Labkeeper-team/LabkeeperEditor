import {
    LINE_ASCENT_PT,
    LINE_DESCENT_PT,
    type AgentPdfMark,
} from '../../../../../viewModel/domain/AgentPdfMarkLocator.ts';

/** Строка текста на странице: верх и низ в pt от верха страницы */
export interface PageTextBand {
    top: number;
    bottom: number;
}

export interface PdfPageGeometry {
    /** Высота страницы в pt */
    height: number;
    text: PageTextBand[];
}

/** Отметка на одной странице, pt от верха страницы */
export interface AgentMarkRect {
    /** Правка, которую открывает щелчок: у слитых отметок верхняя */
    hunkId: string;
    pageIndex: number;
    top: number;
    bottom: number;
}

/** Отметки ближе этого сливаются в одну: соседние правки в PDF читаются одним куском */
const MERGE_GAP_PT = 2;

const LINE_HEIGHT_PT = LINE_ASCENT_PT + LINE_DESCENT_PT;

/** Нижний край текста на странице ниже from. Им заменяется край, который вышел за страницу */
const lowestTextBelow = (
    page: PdfPageGeometry,
    from: number
): number | null => {
    let lowest: number | null = null;
    for (const band of page.text) {
        if (band.top >= from - LINE_DESCENT_PT) {
            lowest = Math.max(lowest ?? band.bottom, band.bottom);
        }
    }
    return lowest;
};

/**
 * GH-190: отметки правок по страницам. Правка через границу страницы
 * делится на куски, край за пределами страницы прижимается к её последнему
 * тексту, пересекающиеся куски сливаются
 */
export function agentMarkRects(
    marks: ReadonlyArray<AgentPdfMark>,
    pages: ReadonlyArray<PdfPageGeometry | undefined>
): AgentMarkRect[] {
    const rects: AgentMarkRect[] = [];
    for (const { hunkId, top, bottom: rawBottom } of marks) {
        // низ выше верха: сервер ответил про строки не по порядку, показываем одну строку
        const bottom =
            rawBottom.page < top.page ||
            (rawBottom.page === top.page && rawBottom.y <= top.y)
                ? { ...top, y: top.y + LINE_HEIGHT_PT }
                : rawBottom;
        for (
            let pageNumber = top.page;
            pageNumber <= bottom.page;
            pageNumber++
        ) {
            const page = pages[pageNumber - 1];
            if (!page) {
                continue;
            }
            const from = Math.max(0, pageNumber === top.page ? top.y : 0);
            let to = pageNumber === bottom.page ? bottom.y : page.height;
            if (to > page.height) {
                to =
                    lowestTextBelow(page, from) ??
                    Math.min(page.height, from + LINE_HEIGHT_PT);
            }
            to = Math.min(to, page.height);
            if (to - from >= 1) {
                rects.push({
                    hunkId,
                    pageIndex: pageNumber - 1,
                    top: from,
                    bottom: to,
                });
            }
        }
    }
    rects.sort((a, b) => a.pageIndex - b.pageIndex || a.top - b.top);
    const merged: AgentMarkRect[] = [];
    for (const rect of rects) {
        const last = merged[merged.length - 1];
        if (
            last &&
            last.pageIndex === rect.pageIndex &&
            rect.top <= last.bottom + MERGE_GAP_PT
        ) {
            last.bottom = Math.max(last.bottom, rect.bottom);
        } else {
            merged.push({ ...rect });
        }
    }
    return merged;
}
