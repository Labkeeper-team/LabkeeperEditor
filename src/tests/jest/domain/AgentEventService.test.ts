import { Hunk, HunkType } from '../../../model/domain.ts';
import { AgentToolName } from '../../../model/rpi/agentSocket.ts';
import { dictionary } from '../../../viewModel/dictionaries/index.ts';
import { AgentEventService } from '../../../viewModel/domain/AgentEventService.ts';

/** Инструменты, которые только читают проект и не порождают hunks */
const READ_TOOLS: AgentToolName[] = [
    'list_workspace',
    'read_segment',
    'read_segments',
    'search_segments',
    'read_file',
    'done',
];

/** Инструменты, которые меняют проект и приводят к hunks */
const WRITE_TOOLS: AgentToolName[] = [
    'add_segment',
    'add_lines_to_segment',
    'delete_lines_from_segment',
    'add_file',
    'add_lines_to_file',
    'delete_lines_from_file',
];

const ALL_HUNK_TYPES: HunkType[] = [
    'addSegment',
    'addLinesToSegment',
    'deleteLinesFromSegment',
    'addFile',
    'addLinesToFile',
    'deleteLinesFromFile',
];

function hunkOf(type: HunkType, rest: Partial<Hunk> = {}): Hunk {
    return { id: 'h', type, ...rest };
}

test('new-hunks-keeps-only-unknown-ones-in-original-order', () => {
    const service = new AgentEventService();
    const known1 = hunkOf('addSegment', { id: 'k1' });
    const known2 = hunkOf('addFile', { id: 'k2' });
    const fresh1 = hunkOf('addLinesToFile', { id: 'f1' });
    const fresh2 = hunkOf('addLinesToSegment', { id: 'f2' });

    const fresh = service.newHunks(
        [known1, known2],
        [known2, fresh1, known1, fresh2]
    );

    expect(fresh).toEqual([fresh1, fresh2]);
});

test('new-hunks-returns-everything-when-nothing-is-known', () => {
    const service = new AgentEventService();
    const next = [
        hunkOf('addSegment', { id: 'a' }),
        hunkOf('addFile', { id: 'b' }),
    ];

    expect(service.newHunks([], next)).toEqual(next);
});

test('new-hunks-on-empty-next-is-empty', () => {
    const service = new AgentEventService();

    expect(service.newHunks([hunkOf('addSegment', { id: 'a' })], [])).toEqual(
        []
    );
});

test.each(READ_TOOLS.map((tool) => [tool] as const))(
    'describe-tool-call-%s-gives-one-line-named-after-the-tool',
    (tool) => {
        const service = new AgentEventService();

        expect(service.describeToolCall(tool, [])).toEqual([
            { kind: 'event', labelKey: tool },
        ]);
    }
);

test('describe-tool-call-of-a-reading-tool-ignores-fresh-hunks', () => {
    const service = new AgentEventService();
    // hunks могли приехать от предыдущего пишущего вызова, читающий их не показывает
    const fresh = [hunkOf('addSegment', { id: 'a', segmentId: 1 })];

    expect(service.describeToolCall('read_segment', fresh)).toEqual([
        { kind: 'event', labelKey: 'read_segment' },
    ]);
});

test.each(WRITE_TOOLS.map((tool) => [tool] as const))(
    'describe-tool-call-%s-without-fresh-hunks-falls-back-to-plain-key',
    (tool) => {
        const service = new AgentEventService();

        expect(service.describeToolCall(tool, [])).toEqual([
            { kind: 'event', labelKey: `${tool}_plain` },
        ]);
    }
);

test('describe-tool-call-with-fresh-hunks-gives-a-line-per-hunk', () => {
    const service = new AgentEventService();
    const fresh = [
        hunkOf('addLinesToSegment', {
            id: 'a',
            segmentId: 3,
            startLine: 7,
        }),
        hunkOf('addLinesToFile', {
            id: 'b',
            fileName: 'Table.xml',
            startLine: 1,
            endLine: 12,
        }),
    ];

    expect(service.describeToolCall('add_lines_to_file', fresh)).toEqual([
        {
            kind: 'event',
            labelKey: 'add_lines_to_segment',
            file: undefined,
            segmentId: 3,
            lines: '#L7',
            target: { segmentIndex: 2, line: 7, focus: false },
        },
        {
            kind: 'event',
            labelKey: 'add_lines_to_file',
            file: 'Table.xml',
            segmentId: undefined,
            lines: '#L1-12',
            target: {
                segmentIndex: -1,
                line: 1,
                file: 'Table.xml',
                focus: false,
            },
        },
    ]);
});

test.each([
    ['addSegment', 'add_segment'],
    ['addLinesToSegment', 'add_lines_to_segment'],
    ['deleteLinesFromSegment', 'delete_lines_from_segment'],
    ['addFile', 'add_file'],
    ['addLinesToFile', 'add_lines_to_file'],
    ['deleteLinesFromFile', 'delete_lines_from_file'],
] as const)('describe-hunk-%s-uses-label-%s', (type, labelKey) => {
    const service = new AgentEventService();

    expect(service.describeHunk(hunkOf(type))).toMatchObject({
        kind: 'event',
        labelKey,
    });
});

test('describe-hunk-of-an-unknown-type-falls-back-to-done', () => {
    const service = new AgentEventService();
    const unknown = hunkOf('renameFile' as unknown as HunkType, {
        fileName: 'a.tex',
        startLine: 3,
    });

    expect(service.describeHunk(unknown)).toEqual({
        kind: 'event',
        labelKey: 'done',
        file: 'a.tex',
        segmentId: undefined,
        lines: '#L3',
        // неизвестный тип не считается навигабельным
        target: undefined,
    });
});

test('describe-hunk-passes-file-and-segment-through', () => {
    const service = new AgentEventService();

    expect(
        service.describeHunk(
            hunkOf('addSegment', { fileName: 'main.tex', segmentId: 5 })
        )
    ).toMatchObject({ file: 'main.tex', segmentId: 5 });
});

test('lines-of-a-single-line-hunk-are-one-number', () => {
    const service = new AgentEventService();

    expect(
        service.describeHunk(hunkOf('addFile', { startLine: 5 })).lines
    ).toBe('#L5');
    // конец совпадает с началом, диапазон не рисуем
    expect(
        service.describeHunk(hunkOf('addFile', { startLine: 5, endLine: 5 }))
            .lines
    ).toBe('#L5');
});

test('lines-of-an-adding-hunk-are-a-range', () => {
    const service = new AgentEventService();

    expect(
        service.describeHunk(
            hunkOf('addLinesToFile', { startLine: 1, endLine: 12 })
        ).lines
    ).toBe('#L1-12');
});

test.each([['deleteLinesFromSegment'], ['deleteLinesFromFile']] as const)(
    'lines-of-%s-are-enumerated',
    (type) => {
        const service = new AgentEventService();

        expect(
            service.describeHunk(hunkOf(type, { startLine: 20, endLine: 22 }))
                .lines
        ).toBe('#L20, #22');
    }
);

test('lines-are-absent-when-the-hunk-has-no-start-line', () => {
    const service = new AgentEventService();

    expect(
        service.describeHunk(hunkOf('addLinesToFile', { endLine: 12 })).lines
    ).toBeUndefined();
});

test.each([['addFile'], ['addLinesToFile']] as const)(
    'navigation-target-of-%s-points-at-the-file-without-focus',
    (type) => {
        const service = new AgentEventService();

        expect(
            service.navigationTarget(
                hunkOf(type, { fileName: 'Table.xml', startLine: 4 })
            )
        ).toEqual({
            segmentIndex: -1,
            line: 4,
            file: 'Table.xml',
            focus: false,
        });
    }
);

test.each([['addSegment'], ['addLinesToSegment']] as const)(
    'navigation-target-of-%s-shifts-segment-id-to-index',
    (type) => {
        const service = new AgentEventService();

        expect(
            service.navigationTarget(
                hunkOf(type, { segmentId: 3, startLine: 7 })
            )
        ).toEqual({ segmentIndex: 2, line: 7, focus: false });
    }
);

test.each([['deleteLinesFromSegment'], ['deleteLinesFromFile']] as const)(
    'navigation-target-of-%s-is-absent',
    (type) => {
        const service = new AgentEventService();

        expect(
            service.navigationTarget(
                hunkOf(type, {
                    fileName: 'Table.xml',
                    segmentId: 3,
                    startLine: 7,
                })
            )
        ).toBeUndefined();
    }
);

test('navigation-target-is-absent-without-file-and-segment-id', () => {
    const service = new AgentEventService();

    expect(
        service.navigationTarget(hunkOf('addSegment', { startLine: 7 }))
    ).toBeUndefined();
});

test('navigation-target-without-start-line-points-at-the-first-line', () => {
    const service = new AgentEventService();

    expect(
        service.navigationTarget(hunkOf('addSegment', { segmentId: 2 }))
    ).toEqual({ segmentIndex: 1, line: 1, focus: false });
});

test('first-navigation-target-skips-hunks-without-a-target', () => {
    const service = new AgentEventService();
    const fresh = [
        hunkOf('deleteLinesFromFile', {
            id: 'a',
            fileName: 'old.tex',
            startLine: 2,
        }),
        // без segmentId прыгать некуда
        hunkOf('addSegment', { id: 'b', startLine: 3 }),
        hunkOf('addLinesToSegment', { id: 'c', segmentId: 4, startLine: 9 }),
        hunkOf('addFile', { id: 'd', fileName: 'new.tex', startLine: 1 }),
    ];

    expect(service.firstNavigationTarget(fresh)).toEqual({
        segmentIndex: 3,
        line: 9,
        focus: false,
    });
});

test('first-navigation-target-is-absent-when-there-is-nowhere-to-jump', () => {
    const service = new AgentEventService();
    const fresh = [
        hunkOf('deleteLinesFromSegment', { id: 'a', segmentId: 1 }),
        hunkOf('deleteLinesFromFile', { id: 'b', fileName: 'old.tex' }),
    ];

    expect(service.firstNavigationTarget(fresh)).toBeUndefined();
    expect(service.firstNavigationTarget([])).toBeUndefined();
});

test.each([
    ['addSegment'],
    ['addLinesToSegment'],
    ['deleteLinesFromSegment'],
] as const)('reload-scope-of-%s-asks-for-the-program-only', (type) => {
    const service = new AgentEventService();

    expect(service.reloadScope([hunkOf(type, { segmentId: 1 })])).toEqual({
        program: true,
        files: false,
    });
});

test.each([['addFile'], ['addLinesToFile'], ['deleteLinesFromFile']] as const)(
    'reload-scope-of-%s-asks-for-the-files-only',
    (type) => {
        const service = new AgentEventService();

        expect(
            service.reloadScope([hunkOf(type, { fileName: 'a.tex' })])
        ).toEqual({ program: false, files: true });
    }
);

test('reload-scope-of-a-mixed-batch-asks-for-both', () => {
    const service = new AgentEventService();

    expect(
        service.reloadScope([
            hunkOf('deleteLinesFromSegment', { id: 'a', segmentId: 1 }),
            hunkOf('addFile', { id: 'b', fileName: 'a.tex' }),
        ])
    ).toEqual({ program: true, files: true });
});

test('reload-scope-of-an-empty-batch-asks-for-nothing', () => {
    const service = new AgentEventService();

    expect(service.reloadScope([])).toEqual({ program: false, files: false });
});

test('describe-model-call-uses-the-model-call-key', () => {
    const service = new AgentEventService();

    expect(service.describeModelCall()).toEqual({
        kind: 'event',
        labelKey: 'model_call',
    });
});

test.each([['ru'], ['en']] as const)(
    'every-label-key-exists-in-the-%s-dictionary',
    (language) => {
        const service = new AgentEventService();
        const events = dictionary[language].agent_chat.event as Record<
            string,
            string
        >;
        const keys = new Set<string>([service.describeModelCall().labelKey]);
        for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
            for (const draft of service.describeToolCall(tool, [])) {
                keys.add(draft.labelKey);
            }
        }
        for (const type of ALL_HUNK_TYPES) {
            keys.add(service.describeHunk(hunkOf(type)).labelKey);
        }
        // fallback у неизвестного типа тоже должен быть переводимым
        keys.add(
            service.describeHunk(hunkOf('renameFile' as unknown as HunkType))
                .labelKey
        );

        const missing = [...keys].filter((key) => events[key] === undefined);
        expect(missing).toEqual([]);
    }
);
