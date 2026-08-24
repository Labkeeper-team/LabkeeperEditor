import { Program } from '../../model/domain.ts';
import { SearchCurrentMatch, SegmentsViewportAnchor } from '../repository';

/** Вхождение запроса. from/to это смещения в тексте сегмента, line 1-based */
export interface SearchMatch {
    segmentIndex: number;
    from: number;
    to: number;
    line: number;
}

/**
 * Поиск по сегментам программы. Файлы не участвуют.
 * Алгоритм тот же indexOf, что и в подсветке сегмента, чтобы список совпадений
 * и подсвеченные вхождения не разъезжались
 */
export class SearchService {
    findMatches(program: Program, query: string): SearchMatch[] {
        if (!query) {
            return [];
        }

        const matches: SearchMatch[] = [];
        const segments = program?.segments ?? [];

        for (
            let segmentIndex = 0;
            segmentIndex < segments.length;
            segmentIndex++
        ) {
            const text = segments[segmentIndex]?.text ?? '';
            // строку считаем инкрементально, иначе на длинном сегменте будет O(n*m)
            let line = 1;
            let scanned = 0;
            let startIndex = text.indexOf(query);

            while (startIndex !== -1) {
                for (let i = scanned; i < startIndex; i++) {
                    if (text.charCodeAt(i) === 10) {
                        line++;
                    }
                }
                scanned = startIndex;

                const endIndex = startIndex + query.length;
                matches.push({
                    segmentIndex,
                    from: startIndex,
                    to: endIndex,
                    line,
                });
                startIndex = text.indexOf(query, endIndex);
            }
        }

        return matches;
    }

    /**
     * Первое совпадение, которое начинается не раньше якоря.
     * Если ниже якоря ничего нет, начинаем с начала документа
     */
    firstIndexAtOrAfter(
        matches: SearchMatch[],
        anchor: SegmentsViewportAnchor | null
    ): number {
        if (matches.length === 0) {
            return -1;
        }
        if (!anchor) {
            return 0;
        }

        const index = matches.findIndex(
            (match) =>
                match.segmentIndex > anchor.segmentIndex ||
                (match.segmentIndex === anchor.segmentIndex &&
                    match.line >= anchor.line)
        );
        return index === -1 ? 0 : index;
    }

    /** Следующее совпадение по документу, после последнего снова первое */
    nextIndexAfter(
        matches: SearchMatch[],
        current: SearchCurrentMatch | null
    ): number {
        if (matches.length === 0) {
            return -1;
        }
        if (!current) {
            return 0;
        }

        const currentIndex = matches.findIndex(
            (match) =>
                match.segmentIndex === current.segmentIndex &&
                match.from === current.from
        );
        if (currentIndex !== -1) {
            return (currentIndex + 1) % matches.length;
        }

        // текст поменялся между Enter, идём к ближайшему совпадению после старой позиции
        const fallback = matches.findIndex(
            (match) =>
                match.segmentIndex > current.segmentIndex ||
                (match.segmentIndex === current.segmentIndex &&
                    match.from > current.from)
        );
        return fallback === -1 ? 0 : fallback;
    }

    lineOfOffset(text: string, offset: number): number {
        let line = 1;
        const limit = Math.min(offset, text.length);
        for (let i = 0; i < limit; i++) {
            if (text.charCodeAt(i) === 10) {
                line++;
            }
        }
        return line;
    }
}
