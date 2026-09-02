import {
    expandGroupsForDisplay,
    getFileHunkEntries,
    groupHunks,
    hunksForFile,
    hunksForSegment,
    mapBaseLineToDisplayLine,
    resolveControlsLine,
    shouldShowGlobalHunkBar,
    applyFileHunksToContent,
} from '../../viewModel/utils/hunkGrouping.ts';
import { Hunk } from '../../model/domain.ts';

const replaceHunks: Hunk[] = [
    {
        id: 'delete-1',
        type: 'deleteLinesFromSegment',
        segmentId: 5,
        startLine: 10,
        endLine: 12,
        text: 'old line',
    },
    {
        id: 'add-1',
        type: 'addLinesToSegment',
        segmentId: 5,
        startLine: 10,
        endLine: 12,
    },
];

test('groupHunks merges replace pair with same start line', () => {
    const groups = groupHunks(replaceHunks);
    expect(groups).toHaveLength(1);
    expect(groups[0].hunks).toHaveLength(2);
    expect(groups[0].deletedLines).toEqual(['old line']);
    expect(groups[0].addedLineRange).toEqual({ startLine: 10, endLine: 12 });
});

test('groupHunks merges addSegment with all addLinesToSegment', () => {
    const hunks: Hunk[] = [
        { id: 'create-1', type: 'addSegment', segmentId: 7 },
        {
            id: 'add-1',
            type: 'addLinesToSegment',
            segmentId: 7,
            startLine: 1,
            endLine: 3,
        },
        {
            id: 'add-2',
            type: 'addLinesToSegment',
            segmentId: 7,
            startLine: 10,
            endLine: 11,
        },
    ];
    const groups = groupHunks(hunks);
    expect(groups).toHaveLength(1);
    expect(groups[0].hunks.map((h) => h.id).sort()).toEqual(
        ['add-1', 'add-2', 'create-1'].sort()
    );
    expect(groups[0].isWholeSegment).toBe(true);
    expect(groups[0].isNewSegment).toBe(true);
});

test('expandGroupsForDisplay keeps separate add ranges apart', () => {
    const hunks: Hunk[] = [
        {
            id: '1',
            type: 'addLinesToSegment',
            segmentId: 5,
            startLine: 3,
            endLine: 4,
        },
        {
            id: '2',
            type: 'addLinesToSegment',
            segmentId: 5,
            startLine: 10,
            endLine: 11,
        },
    ];
    const groups = expandGroupsForDisplay(groupHunks(hunks));
    expect(groups).toHaveLength(2);
    expect(resolveControlsLine(groups[0], 20)).toBe(4);
    expect(resolveControlsLine(groups[1], 20)).toBe(11);
});

test('resolveControlsLine uses hunk text length when endLine is overstated', () => {
    const group = {
        key: 'test',
        hunks: [
            {
                id: '1',
                type: 'addLinesToSegment' as const,
                segmentId: 1,
                startLine: 5,
                endLine: 99,
                text: 'only one line',
            },
        ],
        target: { kind: 'segment' as const, segmentId: 1 },
        anchorLine: 5,
        controlsAfterLine: 99,
        deletedLines: [],
        addedLineRange: { startLine: 5, endLine: 99 },
        isCreation: false,
        isWholeSegment: false,
        isNewFile: false,
        isNewSegment: false,
    };
    expect(resolveControlsLine(group, 10)).toBe(5);
});

test('groupHunks merges addSegment with addLinesToSegment', () => {
    const hunks: Hunk[] = [
        { id: 'create-1', type: 'addSegment', segmentId: 7 },
        {
            id: 'add-1',
            type: 'addLinesToSegment',
            segmentId: 7,
            startLine: 1,
            endLine: 3,
        },
    ];
    const groups = groupHunks(hunks);
    expect(groups).toHaveLength(1);
    expect(groups[0].hunks.map((h) => h.id)).toEqual(['create-1', 'add-1']);
    expect(groups[0].isCreation).toBe(true);
    expect(groups[0].isWholeSegment).toBe(true);
    expect(groups[0].isNewSegment).toBe(true);
});

test('shouldShowGlobalHunkBar for mixed file and segment hunks', () => {
    expect(
        shouldShowGlobalHunkBar([
            { id: '1', type: 'addFile', fileName: 'a.tex' },
            {
                id: '2',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 1,
                endLine: 1,
            },
        ])
    ).toBe(true);
    expect(
        shouldShowGlobalHunkBar([
            { id: '1', type: 'addFile', fileName: 'a.tex' },
        ])
    ).toBe(true);
    expect(
        shouldShowGlobalHunkBar([
            { id: '1', type: 'addFile', fileName: 'a.tex' },
            { id: '2', type: 'addFile', fileName: 'b.tex' },
        ])
    ).toBe(true);
    expect(shouldShowGlobalHunkBar([])).toBe(false);
});

test('getFileHunkEntries marks addFile as added and delete-only as deleted', () => {
    const hunks: Hunk[] = [
        { id: 'f1', type: 'addFile', fileName: 'new.tex' },
        {
            id: 'f2',
            type: 'deleteLinesFromFile',
            fileName: 'old.tex',
            startLine: 1,
            endLine: 1,
            text: 'removed',
        },
    ];
    const entries = getFileHunkEntries(hunks);
    expect(entries.find((e) => e.fileName === 'new.tex')?.state).toBe('added');
    expect(entries.find((e) => e.fileName === 'old.tex')?.state).toBe(
        'deleted'
    );
});

test('expandGroupsForDisplay splits delete and add on different lines', () => {
    const hunks: Hunk[] = [
        {
            id: 'delete-1',
            type: 'deleteLinesFromSegment',
            segmentId: 3,
            startLine: 2,
            endLine: 2,
            text: 'Небольшой текст нового сегмента.',
        },
        {
            id: 'add-1',
            type: 'addLinesToSegment',
            segmentId: 3,
            startLine: 1,
            endLine: 1,
            text: 'Замена',
        },
    ];
    const groups = expandGroupsForDisplay(groupHunks(hunks));
    expect(groups).toHaveLength(2);
    expect(groups[0].deletedLines).toEqual([
        'Небольшой текст нового сегмента.',
    ]);
    expect(groups[1].addedLineRange).toEqual({ startLine: 1, endLine: 1 });
    expect(resolveControlsLine(groups[0], 1)).toBe(1);
    expect(resolveControlsLine(groups[1], 1)).toBe(1);
});

test('hunksForSegment and hunksForFile filter by target', () => {
    const hunks: Hunk[] = [
        {
            id: '1',
            type: 'addLinesToSegment',
            segmentId: 1,
            startLine: 1,
            endLine: 1,
        },
        {
            id: '2',
            type: 'addLinesToFile',
            fileName: 'main.tex',
            startLine: 1,
            endLine: 1,
        },
    ];
    expect(hunksForSegment(hunks, 1)).toHaveLength(1);
    expect(hunksForFile(hunks, 'main.tex')).toHaveLength(1);
});

test('applyFileHunksToContent deletes old lines then inserts additions', () => {
    const hunks: Hunk[] = [
        {
            id: '40b728ff-82d9-4e4a-8b4b-89b49110ca9b',
            type: 'deleteLinesFromFile',
            fileName: 'notes.txt',
            startLine: 2,
            endLine: 7,
            text: '1\n2\n3\n4\n55\n6',
        },
        {
            id: 'ffa6f9d9-c028-4193-be23-f412b5eb6d44',
            type: 'addLinesToFile',
            fileName: 'notes.txt',
            startLine: 1,
            endLine: 1,
            text: 'ахаха',
        },
    ];
    const fileOnDisk = 'header\n1\n2\n3\n4\n55\n6\n';

    const applied = applyFileHunksToContent(fileOnDisk, hunks, 'notes.txt');
    expect(applied).toBe('ахаха\nheader\n');
    expect(applyFileHunksToContent(applied, hunks, 'notes.txt')).toBe(applied);
});

test('applyFileHunksToContent is a no-op without file hunks', () => {
    expect(applyFileHunksToContent('keep\n', [], 'notes.txt')).toBe('keep\n');
});

test('mapBaseLineToDisplayLine accumulates earlier hunk line deltas', () => {
    const hunks: Hunk[] = [
        {
            id: 'add-before',
            type: 'addLinesToFile',
            fileName: 'notes.txt',
            startLine: 2,
            endLine: 3,
            text: 'new 1\nnew 2',
        },
        {
            id: 'delete-before',
            type: 'deleteLinesFromFile',
            fileName: 'notes.txt',
            startLine: 5,
            endLine: 6,
            text: 'old 5\nold 6',
        },
        {
            id: 'add-current',
            type: 'addLinesToFile',
            fileName: 'notes.txt',
            startLine: 10,
            endLine: 10,
            text: 'new 10',
        },
    ];

    expect(mapBaseLineToDisplayLine(hunks, 2)).toBe(2);
    expect(mapBaseLineToDisplayLine(hunks, 5)).toBe(7);
    expect(mapBaseLineToDisplayLine(hunks, 10)).toBe(10);
});

test('resolveControlsLine uses mapped display line and added text length', () => {
    const earlierAdd: Hunk = {
        id: 'earlier',
        type: 'addLinesToSegment',
        segmentId: 1,
        startLine: 2,
        endLine: 3,
        text: 'first\nsecond',
    };
    const currentAdd: Hunk = {
        id: 'current',
        type: 'addLinesToSegment',
        segmentId: 1,
        startLine: 5,
        endLine: 99,
        text: 'current',
    };
    const group = groupHunks([currentAdd])[0];

    expect(resolveControlsLine(group, 20, [earlierAdd, currentAdd])).toBe(7);
});
