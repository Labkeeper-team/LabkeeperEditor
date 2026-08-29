import { Segment } from '../../model/domain.ts';

/** Segment id always matches 1-based position in the list. */
export function resolveSegmentId(
    _segments: ReadonlyArray<Segment>,
    segmentIndex: number
): number {
    return segmentIndex + 1;
}

export function renumberSegmentIds(segments: Segment[]): void {
    for (let i = 0; i < segments.length; i++) {
        segments[i] = { ...segments[i], id: i + 1 };
    }
}

/** Normalizes ids to 1..n by list order before save/API calls. */
export function withSegmentIds(program: {
    segments: Segment[];
    parameters: { roundStrategy: string };
}): { segments: Segment[]; parameters: { roundStrategy: string } } {
    return {
        segments: program.segments.map((segment, index) => ({
            ...segment,
            id: index + 1,
        })),
        parameters: program.parameters,
    };
}
