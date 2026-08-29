import {
    renumberSegmentIds,
    resolveSegmentId,
    withSegmentIds,
} from '../../viewModel/utils/segmentId.ts';

test('resolveSegmentId follows 1-based list position', () => {
    const segments = [
        { id: 10, type: 'md' as const, parameters: {}, text: 'a' },
        { id: 20, type: 'md' as const, parameters: {}, text: 'b' },
    ];
    expect(resolveSegmentId(segments, 0)).toBe(1);
    expect(resolveSegmentId(segments, 1)).toBe(2);
});

test('renumberSegmentIds assigns sequential ids by list order', () => {
    const segments = [
        { id: 1, type: 'md' as const, parameters: {}, text: 'first' },
        { type: 'md' as const, parameters: {}, text: 'inserted' },
        { id: 5, type: 'md' as const, parameters: {}, text: 'second' },
    ];

    renumberSegmentIds(segments);

    expect(segments.map((s) => s.id)).toEqual([1, 2, 3]);
});

test('withSegmentIds normalizes all ids to list order', () => {
    const program = withSegmentIds({
        segments: [
            { id: 1, type: 'md', parameters: {}, text: 'first' },
            { id: 99, type: 'md', parameters: {}, text: 'second' },
        ],
        parameters: { roundStrategy: 'noRound' },
    });

    expect(program.segments.map((s) => s.id)).toEqual([1, 2]);
});
