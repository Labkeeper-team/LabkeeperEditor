import {
    expandGroupsForDisplay,
    getFileHunkEntries,
    groupHunks,
    hunksForFile,
    hunksForSegment,
    mapBaseLineToDisplayLine,
    mapBaseLineToOverlayLine,
    overlayDeleteHunksOnNewContent,
    resolveControlsLine,
    deletedLinesAnchorAtEnd,
    shouldShowGlobalHunkBar,
    stripDeleteHunksFromContent,
    hunkTextLines,
    getFileContentFromHunks,
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

test('groupHunks merges addFile with addLinesToFile', () => {
    const hunks: Hunk[] = [
        {
            id: 'add-lines',
            type: 'addLinesToFile',
            fileName: 'data.csv',
            startLine: 1,
            endLine: 2,
            text: 'a,b\n1,2',
        },
        { id: 'add-file', type: 'addFile', fileName: 'data.csv' },
    ];
    const groups = groupHunks(hunks);
    expect(groups).toHaveLength(1);
    expect(groups[0].hunks.map((h) => h.id).sort()).toEqual(
        ['add-file', 'add-lines'].sort()
    );
    expect(groups[0].isNewFile).toBe(true);
});

test.each([
    {
        name: 'one line',
        hunk: { text: 'one', startLine: 1, endLine: 1 },
        lines: ['one'],
    },
    {
        name: 'server text has no trailing line break',
        hunk: { text: '7\n9', startLine: 6, endLine: 7 },
        lines: ['7', '9'],
    },
    {
        name: 'trailing line break counted by the range adds no line',
        hunk: { text: 'one\ntwo\n', startLine: 1, endLine: 2 },
        lines: ['one', 'two'],
    },
    {
        name: 'trailing line break inside the range is a blank line',
        hunk: { text: 'new para\n', startLine: 2, endLine: 3 },
        lines: ['new para', ''],
    },
    {
        name: 'CRLF is read as a line break',
        hunk: { text: 'one\r\ntwo\r\n', startLine: 1, endLine: 2 },
        lines: ['one', 'two'],
    },
    {
        name: 'blank line before the trailing break stays',
        hunk: { text: 'one\n\n', startLine: 1, endLine: 2 },
        lines: ['one', ''],
    },
    {
        name: 'trailing line break without a range is a blank line',
        hunk: { text: 'one\n' },
        lines: ['one', ''],
    },
    {
        name: 'empty text is one blank line',
        hunk: { text: '', startLine: 1, endLine: 1 },
        lines: [''],
    },
])('hunkTextLines: $name', ({ hunk, lines }) => {
    expect(hunkTextLines(hunk)).toEqual(lines);
});

test('blank line added by the agent at the end of its text is highlighted', () => {
    const [group] = groupHunks([
        {
            id: 'add',
            type: 'addLinesToSegment',
            segmentId: 1,
            startLine: 2,
            endLine: 3,
            text: 'new para\n',
        },
    ]);

    // в документе 'intro', 'new para', '', 'omega': зелёные строки 2 и 3, кнопки после пустой
    expect(resolveControlsLine(group, 4)).toBe(3);
});

test('deleted blank line at the end of the text stays in the deleted block', () => {
    const [group] = groupHunks([
        {
            id: 'delete',
            type: 'deleteLinesFromFile',
            fileName: 'notes.txt',
            startLine: 2,
            endLine: 3,
            text: 'old\n',
        },
    ]);

    expect(group.deletedLines).toEqual(['old', '']);
});

test('added text whose range counts the trailing line break highlights only its own lines', () => {
    const [group] = groupHunks([
        {
            id: 'add',
            type: 'addLinesToFile',
            fileName: 'notes.txt',
            startLine: 3,
            endLine: 4,
            text: 'NEW 1\nNEW 2\n',
        },
    ]);

    expect(resolveControlsLine(group, 10)).toBe(4);
});

test('deleted text with CRLF and a trailing line break counted by the range shows only its own lines', () => {
    const [group] = groupHunks([
        {
            id: 'delete',
            type: 'deleteLinesFromFile',
            fileName: 'notes.txt',
            startLine: 3,
            endLine: 4,
            text: 'old 1\r\nold 2\r\n',
        },
    ]);

    expect(group.deletedLines).toEqual(['old 1', 'old 2']);
});

test('mapBaseLineToDisplayLine does not count a trailing line break counted by the range as a line', () => {
    const hunks: Hunk[] = [
        {
            id: 'add-before',
            type: 'addLinesToFile',
            fileName: 'notes.txt',
            startLine: 2,
            endLine: 3,
            text: 'new 1\nnew 2\n',
        },
    ];

    expect(mapBaseLineToDisplayLine(hunks, 5)).toBe(7);
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

    expect(resolveControlsLine(group, 20, [earlierAdd, currentAdd])).toBe(5);
});

test('overlayDeleteHunksOnNewContent inserts at original startLine without shifting later hunks', () => {
    const hunks: Hunk[] = [
        {
            id: 'ae1e950e-9359-4028-adae-77515447d458',
            type: 'deleteLinesFromSegment',
            segmentId: 1,
            startLine: 4,
            endLine: 4,
            text: '4',
        },
        {
            id: 'b4b478e1-7694-4443-a684-a5e26eaa1218',
            type: 'deleteLinesFromSegment',
            segmentId: 1,
            startLine: 6,
            endLine: 7,
            text: '7\n9',
        },
        {
            id: 'a6c2a856-6c9b-4957-8d24-eeefaee03250',
            type: 'deleteLinesFromSegment',
            segmentId: 1,
            startLine: 12,
            endLine: 12,
            text: '15',
        },
    ];
    const newContent = [
        '1',
        '2',
        '3',
        '5',
        '6',
        '10',
        '11',
        '12',
        '13',
        '14',
        '16',
        '17',
    ].join('\n');

    const overlayed = overlayDeleteHunksOnNewContent(newContent, hunks);
    expect(overlayed.split('\n')).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
        '6',
        '7',
        '9',
        '10',
        '11',
        '12',
        '13',
        '14',
        '16',
        '15',
        '17',
    ]);
    expect(stripDeleteHunksFromContent(overlayed, hunks)).toBe(newContent);
});

test('overlayDeleteHunksOnNewContent appends a trailing deleted line', () => {
    const hunks: Hunk[] = [
        {
            id: 'delete-last',
            type: 'deleteLinesFromFile',
            fileName: 'notes.txt',
            startLine: 5,
            endLine: 5,
            text: '5',
        },
    ];
    const newContent = ['1', '2', '3', '4'].join('\n');

    expect(
        overlayDeleteHunksOnNewContent(newContent, hunks).split('\n')
    ).toEqual(['1', '2', '3', '4', '5']);
    expect(deletedLinesAnchorAtEnd(5, 4)).toBe(true);
    expect(deletedLinesAnchorAtEnd(4, 4)).toBe(false);
});

test('overlay of deleted text with a trailing line break agrees with its line map', () => {
    const hunks: Hunk[] = [
        {
            id: 'delete',
            type: 'deleteLinesFromFile',
            fileName: 'notes.txt',
            startLine: 2,
            endLine: 2,
            text: 'x\n',
        },
    ];
    const newContent = ['a', 'b', 'c'].join('\n');

    const overlayed = overlayDeleteHunksOnNewContent(newContent, hunks);
    expect(overlayed.split('\n')).toEqual(['a', 'x', 'b', 'c']);
    const line = mapBaseLineToOverlayLine(hunks, 2, 'add');
    expect(overlayed.split('\n')[line - 1]).toBe('b');
    expect(stripDeleteHunksFromContent(overlayed, hunks)).toBe(newContent);
});

type ReplaceType = 'replaceTextInSegment' | 'replaceTextInFile';

/** hunk замены в том виде, как его шлёт сервер: у чужой цели явный null */
function replaceHunk(
    type: ReplaceType,
    startLine: number,
    endLine: number,
    text: string,
    id = 'replace'
): Hunk {
    const place =
        type === 'replaceTextInSegment'
            ? { segmentId: 1, fileName: null }
            : { segmentId: null, fileName: 'notes.txt' };
    return { id, type, startLine, endLine, text, ...place } as unknown as Hunk;
}

// формы с препрода 28.09 (бэкенд 4.10.1.886): диапазон это новые строки, text это заменённые старые
test.each([
    {
        name: 'one line for one in a segment',
        hunk: replaceHunk('replaceTextInSegment', 3, 3, 'Alpha line one.'),
        deletedLines: ['Alpha line one.'],
    },
    {
        name: 'two lines for three in a segment',
        hunk: replaceHunk(
            'replaceTextInSegment',
            5,
            7,
            'Second paragraph line.\nThird paragraph line.'
        ),
        deletedLines: ['Second paragraph line.', 'Third paragraph line.'],
    },
    {
        name: 'empty text is one blank line',
        hunk: replaceHunk('replaceTextInSegment', 4, 4, ''),
        deletedLines: [''],
    },
    {
        name: 'blank line after the last line break is an old line too',
        hunk: replaceHunk(
            'replaceTextInFile',
            7,
            10,
            'line e\nkeep 3\nline f\nkeep 4\n'
        ),
        deletedLines: ['line e', 'keep 3', 'line f', 'keep 4', ''],
    },
    {
        name: 'two lines for one in a file',
        hunk: replaceHunk('replaceTextInFile', 6, 6, 'old one\nold two'),
        deletedLines: ['old one', 'old two'],
    },
    {
        name: 'CRLF is read as a line break',
        hunk: replaceHunk('replaceTextInFile', 4, 5, 'line c\r\n\r\nline d'),
        deletedLines: ['line c', '', 'line d'],
    },
    {
        name: 'CRLF at the end keeps its blank old line',
        hunk: replaceHunk('replaceTextInFile', 3, 3, 'old\r\n'),
        deletedLines: ['old', ''],
    },
])('replace hunk: $name', ({ hunk, deletedLines }) => {
    const groups = expandGroupsForDisplay(groupHunks([hunk]));

    expect(groups).toHaveLength(1);
    const [group] = groups;
    expect(group.hunks).toEqual([hunk]);
    expect(group.deletedLines).toEqual(deletedLines);
    // старые строки стоят над первой новой, кнопки после последней новой
    expect(group.anchorLine).toBe(hunk.startLine);
    expect(group.addedLineRange).toEqual({
        startLine: hunk.startLine,
        endLine: hunk.endLine,
    });
    expect(group.controlsAfterLine).toBe(hunk.endLine);
    expect(resolveControlsLine(group, 20)).toBe(hunk.endLine);
    expect(group.isCreation).toBe(false);
});

test('replace hunks of one file merged by the server stay one group each', () => {
    // сервер слил удаление, вставку и замену в одну замену 7..10, а соседние замены остаются отдельными группами
    const hunks = [
        replaceHunk('replaceTextInFile', 2, 2, 'line b', 'da6d05be'),
        replaceHunk('replaceTextInFile', 4, 5, 'line c\n\nline d', '7257addd'),
        replaceHunk(
            'replaceTextInFile',
            7,
            10,
            'line e\nkeep 3\nline f\nkeep 4\n',
            '600cf653'
        ),
    ];

    const groups = expandGroupsForDisplay(groupHunks(hunks));

    expect(groups.map((group) => group.hunks.map((hunk) => hunk.id))).toEqual([
        ['da6d05be'],
        ['7257addd'],
        ['600cf653'],
    ]);
    expect(groups.map((group) => group.addedLineRange)).toEqual([
        { startLine: 2, endLine: 2 },
        { startLine: 4, endLine: 5 },
        { startLine: 7, endLine: 10 },
    ]);
});

test('replace next to a delete and an add on the same line pairs with neither', () => {
    // замена первой: как зерно группы она не должна забрать удаление
    const hunks: Hunk[] = [
        replaceHunk('replaceTextInFile', 4, 4, 'old', 'replace'),
        {
            id: 'delete',
            type: 'deleteLinesFromFile',
            fileName: 'notes.txt',
            startLine: 4,
            endLine: 4,
            text: 'gone',
        },
        {
            id: 'add',
            type: 'addLinesToFile',
            fileName: 'notes.txt',
            startLine: 4,
            endLine: 4,
            text: 'new',
        },
    ];

    const groups = expandGroupsForDisplay(groupHunks(hunks));

    expect(
        groups.map((group) => group.hunks.map((hunk) => hunk.id).sort()).sort()
    ).toEqual([['add', 'delete'], ['replace']]);
});

test('replace inside a new file stays in the group of the new file', () => {
    const replace = replaceHunk('replaceTextInFile', 1, 2, '');
    const hunks: Hunk[] = [
        replace,
        { id: 'new-file', type: 'addFile', fileName: 'notes.txt' },
    ];

    const groups = expandGroupsForDisplay(groupHunks(hunks));

    expect(groups).toHaveLength(1);
    expect(groups[0].hunks.map((hunk) => hunk.id).sort()).toEqual(
        ['new-file', 'replace'].sort()
    );
    expect(groups[0].isNewFile).toBe(true);
    // файла до агента не было, старым строкам в нём взяться неоткуда
    expect(groups[0].deletedLines).toEqual([]);
    expect(getFileHunkEntries(hunks)).toEqual([
        {
            fileName: 'notes.txt',
            state: 'added',
            hunkIds: groups[0].hunks.map((hunk) => hunk.id),
        },
    ]);
});

test('replace inside a new segment stays in the group of the new segment', () => {
    const replace = replaceHunk('replaceTextInSegment', 1, 3, '');
    const hunks: Hunk[] = [
        replace,
        { id: 'new-segment', type: 'addSegment', segmentId: 1 },
    ];

    const groups = expandGroupsForDisplay(groupHunks(hunks));

    expect(groups).toHaveLength(1);
    expect(groups[0].hunks.map((hunk) => hunk.id).sort()).toEqual(
        ['new-segment', 'replace'].sort()
    );
    expect(groups[0].isNewSegment).toBe(true);
    expect(groups[0].deletedLines).toEqual([]);
});

test('replace in another file does not join a new file', () => {
    const hunks: Hunk[] = [
        { id: 'new-file', type: 'addFile', fileName: 'other.txt' },
        replaceHunk('replaceTextInFile', 2, 2, 'line b'),
    ];

    const groups = groupHunks(hunks);

    expect(groups.map((group) => group.hunks.map((hunk) => hunk.id))).toEqual([
        ['new-file'],
        ['replace'],
    ]);
});

test('replace in another segment does not join a new segment', () => {
    const hunks: Hunk[] = [
        { id: 'new-segment', type: 'addSegment', segmentId: 2 },
        replaceHunk('replaceTextInSegment', 3, 3, 'Alpha line one.'),
    ];

    const groups = groupHunks(hunks);

    expect(groups.map((group) => group.hunks.map((hunk) => hunk.id))).toEqual([
        ['new-segment'],
        ['replace'],
    ]);
});

test('file with only replaced lines is modified in the tree, not deleted', () => {
    const entries = getFileHunkEntries([
        replaceHunk('replaceTextInFile', 2, 2, 'line b', 'one'),
        {
            ...replaceHunk('replaceTextInFile', 6, 6, 'old one\nold two'),
            id: 'two',
            fileName: 'other.txt',
        },
    ]);

    expect(entries).toEqual([
        { fileName: 'notes.txt', state: 'modified', hunkIds: ['one'] },
        { fileName: 'other.txt', state: 'modified', hunkIds: ['two'] },
    ]);
});

// text замены это старые строки: выдать его за содержимое файла значило бы показать текст до правки
test('replaced text is not taken for the content of a file', () => {
    expect(
        getFileContentFromHunks(
            [replaceHunk('replaceTextInFile', 2, 2, 'line b')],
            'notes.txt'
        )
    ).toBeNull();
});

// Дерево файлов берёт из записи все id сразу: пока запись строилась на группу,
// кнопка «Принять» в дереве принимала только первую правку файла
test('у файла с несколькими правками одна запись со всеми id', () => {
    const hunks: Hunk[] = [
        {
            id: 'add-top',
            type: 'addLinesToFile',
            fileName: 'report.tex',
            startLine: 2,
            endLine: 2,
        },
        {
            id: 'add-bottom',
            type: 'addLinesToFile',
            fileName: 'report.tex',
            startLine: 40,
            endLine: 41,
        },
        {
            id: 'delete-middle',
            type: 'deleteLinesFromFile',
            fileName: 'report.tex',
            startLine: 20,
            endLine: 20,
            text: 'устаревшая строка',
        },
    ];

    const entries = getFileHunkEntries(hunks);

    expect(entries).toHaveLength(1);
    expect(entries[0].fileName).toBe('report.tex');
    expect([...entries[0].hunkIds].sort()).toEqual([
        'add-bottom',
        'add-top',
        'delete-middle',
    ]);
});

// Файл приходит и с ведущим слэшем, и без него: это один и тот же файл
test('записи одного файла склеиваются независимо от ведущего слэша', () => {
    const entries = getFileHunkEntries([
        {
            id: 'a',
            type: 'addLinesToFile',
            fileName: 'chapters/intro.tex',
            startLine: 1,
            endLine: 1,
        },
        {
            id: 'b',
            type: 'addLinesToFile',
            fileName: '/chapters/intro.tex',
            startLine: 10,
            endLine: 10,
        },
    ]);

    expect(entries).toHaveLength(1);
    expect([...entries[0].hunkIds].sort()).toEqual(['a', 'b']);
});

// Значок состояния описывает файл целиком, а не первую его правку.
// Порядок правок перебирается оба: флаг добавления должен копиться по всем
// группам, иначе последняя группа затрёт его и файл станет «удаляемым»
test.each([
    ['удаление раньше добавления', 'del', 1, 'add', 30],
    ['добавление раньше удаления', 'add', 1, 'del', 30],
])(
    'файл с добавлением и удалением показан как изменённый: %s',
    (_case, firstKind, firstLine, secondKind, secondLine) => {
        const hunkOf = (kind: string, line: number): Hunk =>
            kind === 'del'
                ? {
                      id: `del-${line}`,
                      type: 'deleteLinesFromFile',
                      fileName: 'mixed.tex',
                      startLine: line,
                      endLine: line,
                      text: 'было',
                  }
                : {
                      id: `add-${line}`,
                      type: 'addLinesToFile',
                      fileName: 'mixed.tex',
                      startLine: line,
                      endLine: line,
                  };

        const entries = getFileHunkEntries([
            hunkOf(firstKind as string, firstLine as number),
            hunkOf(secondKind as string, secondLine as number),
        ]);

        expect(entries).toHaveLength(1);
        expect(entries[0].state).toBe('modified');
    }
);

// Новый файл с дописанными строками остаётся добавленным: на этом держится
// список фантомных файлов, которых ещё нет в проекте
test('новый файл с дополнительной правкой остаётся добавленным', () => {
    const entries = getFileHunkEntries([
        { id: 'create', type: 'addFile', fileName: 'fresh.tex' },
        {
            id: 'more',
            type: 'addLinesToFile',
            fileName: 'fresh.tex',
            startLine: 5,
            endLine: 5,
        },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].state).toBe('added');
});

// Создание файла и удаление строк в отдельные группы не сливаются: признак
// создания обязан пережить следующую группу, иначе файл перестанет быть новым
test('новый файл с удалением строк остаётся добавленным', () => {
    const entries = getFileHunkEntries([
        { id: 'create', type: 'addFile', fileName: 'fresh.tex' },
        {
            id: 'cut',
            type: 'deleteLinesFromFile',
            fileName: 'fresh.tex',
            startLine: 3,
            endLine: 3,
            text: 'лишняя строка',
        },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].state).toBe('added');
});

// Удаление в двух разных местах файла: добавлений нет, значит файл удаляемый
test('файл только с удалениями в разных местах показан как удаляемый', () => {
    const entries = getFileHunkEntries([
        {
            id: 'd1',
            type: 'deleteLinesFromFile',
            fileName: 'drop.tex',
            startLine: 1,
            endLine: 1,
            text: 'первая',
        },
        {
            id: 'd2',
            type: 'deleteLinesFromFile',
            fileName: 'drop.tex',
            startLine: 9,
            endLine: 9,
            text: 'вторая',
        },
    ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].state).toBe('deleted');
});
