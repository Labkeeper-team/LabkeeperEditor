import type { Hunk, Segment } from '../../model/domain.ts';

/**
 * GH-190: строки правки агента, которые надо найти в PDF. Номера 1-based в
 * нынешнем тексте сегмента или файла: так их отдаёт сервер в ханке
 */
export interface AgentChangeRange {
    hunkId: string;
    /** id сегмента, он же его место в программе (1-based) */
    segmentId?: number;
    file?: string;
    startLine: number;
    endLine: number;
}

/** Правки, после которых в документе есть новый текст. Удаление в PDF показать нечем */
const LINE_HUNK_TYPES = new Set<Hunk['type']>([
    'addLinesToSegment',
    'replaceTextInSegment',
    'addLinesToFile',
    'replaceTextInFile',
]);

export function agentChangeRanges(
    hunks: ReadonlyArray<Hunk>,
    segments: ReadonlyArray<Segment>
): AgentChangeRange[] {
    const ranges: AgentChangeRange[] = [];
    for (const hunk of hunks) {
        if (LINE_HUNK_TYPES.has(hunk.type) && hunk.startLine != null) {
            const place = hunk.fileName
                ? { file: hunk.fileName }
                : hunk.segmentId != null
                  ? { segmentId: hunk.segmentId }
                  : null;
            if (!place) {
                continue;
            }
            ranges.push({
                hunkId: hunk.id,
                ...place,
                startLine: hunk.startLine,
                endLine: Math.max(hunk.startLine, hunk.endLine ?? 0),
            });
            continue;
        }
        // новый сегмент целиком: весь его текст и есть правка
        if (hunk.type === 'addSegment' && hunk.segmentId != null) {
            const text = segments[hunk.segmentId - 1]?.text ?? '';
            if (text.trim() === '') {
                continue;
            }
            ranges.push({
                hunkId: hunk.id,
                segmentId: hunk.segmentId,
                startLine: 1,
                endLine: text.split('\n').length,
            });
        }
    }
    return ranges;
}
