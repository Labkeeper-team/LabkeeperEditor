import { Hunk, HunkType } from '../../../model/domain.ts';
import {
    AGENT_TOOL_NAMES,
    AgentToolName,
} from '../../../model/rpi/agentSocket.ts';
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

/** Остальные знакомые инструменты пишут: новое имя без подписи и перечитывания покраснеет в их опытах */
const WRITE_TOOLS = AGENT_TOOL_NAMES.filter(
    (tool) => !READ_TOOLS.includes(tool)
);

// инструмент, которого фронт ещё не знает: судить можно только по hunks
const UNKNOWN_TOOL = 'rename_segment';

/** Незнакомые имена, в том числе поля Object.prototype: обычный объект нашёл бы по ним функцию */
const UNKNOWN_TOOLS = [
    ['a-new-name', UNKNOWN_TOOL],
    ['an-empty-name', ''],
    ['constructor', 'constructor'],
    ['toString', 'toString'],
    ['__proto__', '__proto__'],
    ['hasOwnProperty', 'hasOwnProperty'],
] as const;

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

test('changed-hunks-keep-new-ones-in-original-order', () => {
    const service = new AgentEventService();
    const known1 = hunkOf('addSegment', { id: 'k1' });
    const known2 = hunkOf('addFile', { id: 'k2' });
    const fresh1 = hunkOf('addLinesToFile', { id: 'f1' });
    const fresh2 = hunkOf('addLinesToSegment', { id: 'f2' });

    const fresh = service.changedHunks(
        [known1, known2],
        [known2, fresh1, known1, fresh2]
    );

    expect(fresh).toEqual([fresh1, fresh2]);
});

test('changed-hunks-return-everything-when-nothing-is-known', () => {
    const service = new AgentEventService();
    const next = [
        hunkOf('addSegment', { id: 'a' }),
        hunkOf('addFile', { id: 'b' }),
    ];

    expect(service.changedHunks([], next)).toEqual(next);
});

test('changed-hunks-on-empty-next-are-empty', () => {
    const service = new AgentEventService();

    expect(
        service.changedHunks([hunkOf('addSegment', { id: 'a' })], [])
    ).toEqual([]);
});

// сервер дописывает повторную правку того же места в прежний hunk, id не меняется
test('changed-hunks-include-a-known-hunk-that-grew', () => {
    const service = new AgentEventService();
    const before = hunkOf('addLinesToSegment', {
        id: 'a',
        segmentId: 1,
        startLine: 2,
        endLine: 2,
        text: 'Вторая строка',
    });
    const after = { ...before, endLine: 3, text: 'Вторая строка\nТретья' };

    expect(service.changedHunks([before], [after])).toEqual([after]);
});

// по спеке у добавленных строк текста может и не быть
test('changed-hunks-include-a-known-hunk-that-grew-without-text', () => {
    const service = new AgentEventService();
    const before = hunkOf('addLinesToSegment', {
        id: 'a',
        segmentId: 1,
        startLine: 2,
        endLine: 2,
    });
    const after = { ...before, endLine: 3 };

    expect(service.changedHunks([before], [after])).toEqual([after]);
});

test('changed-hunks-include-a-known-hunk-whose-text-changed', () => {
    const service = new AgentEventService();
    const before = hunkOf('addLinesToFile', {
        id: 'a',
        fileName: 'a.tex',
        startLine: 1,
        endLine: 1,
        text: 'A',
    });
    const after = { ...before, text: 'B' };

    expect(service.changedHunks([before], [after])).toEqual([after]);
});

test.each([
    [
        'type',
        hunkOf('addLinesToSegment', { id: 'a', segmentId: 1, text: 'x' }),
        hunkOf('deleteLinesFromSegment', { id: 'a', segmentId: 1, text: 'x' }),
    ],
    [
        'segment',
        hunkOf('addLinesToSegment', { id: 'a', segmentId: 1, text: 'x' }),
        hunkOf('addLinesToSegment', { id: 'a', segmentId: 2, text: 'x' }),
    ],
    [
        'file',
        hunkOf('addLinesToFile', { id: 'a', fileName: 'a.tex', text: 'x' }),
        hunkOf('addLinesToFile', { id: 'a', fileName: 'b.tex', text: 'x' }),
    ],
])('changed-hunks-include-a-known-hunk-with-another-%s', (_, before, after) => {
    const service = new AgentEventService();

    expect(service.changedHunks([before], [after])).toEqual([after]);
});

test('changed-hunks-skip-a-known-hunk-that-only-moved', () => {
    const service = new AgentEventService();
    const before = hunkOf('addLinesToSegment', {
        id: 'a',
        segmentId: 1,
        startLine: 2,
        endLine: 3,
        text: 'x\ny',
    });
    const deleted = hunkOf('deleteLinesFromSegment', {
        id: 'b',
        segmentId: 1,
        startLine: 1,
        endLine: 1,
        text: 'первая',
    });
    // строку выше удалили: прежний hunk лишь сдвинулся, его никто не правил
    const moved = { ...before, startLine: 1, endLine: 2 };

    expect(service.changedHunks([before], [moved, deleted])).toEqual([deleted]);
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

test.each(UNKNOWN_TOOLS)(
    'describe-tool-call-of-%s-without-fresh-hunks-gives-the-common-line',
    (_case, tool) => {
        const service = new AgentEventService();

        expect(service.describeToolCall(tool, [])).toEqual([
            { kind: 'event', labelKey: 'unknown_tool' },
        ]);
    }
);

test('describe-tool-call-of-an-unknown-tool-names-the-places-it-changed', () => {
    const service = new AgentEventService();
    const fresh = [
        hunkOf('addLinesToSegment', { id: 'a', segmentId: 2, startLine: 4 }),
    ];

    expect(service.describeToolCall(UNKNOWN_TOOL, fresh)).toEqual([
        {
            kind: 'event',
            labelKey: 'add_lines_to_segment',
            file: undefined,
            segmentId: 2,
            lines: '#L4',
            target: { segmentIndex: 1, line: 4, focus: false },
        },
    ]);
});

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

/** Типы правок, которых фронт ещё не знает, в том числе поля Object.prototype */
const UNKNOWN_HUNKS: [string, Partial<Hunk>, string][] = [
    ['renameFile', { fileName: 'a.tex' }, 'add_lines_to_file'],
    ['deleteSegment', { segmentId: 4 }, 'add_lines_to_segment'],
    ['constructor', { segmentId: 4 }, 'add_lines_to_segment'],
    ['toString', { fileName: 'a.tex' }, 'add_lines_to_file'],
    ['movePlace', {}, 'unknown_tool'],
];

// суть незнакомой правки назвать нечем, а место можно, и «Завершение работы» тут соврало бы
test.each(UNKNOWN_HUNKS)(
    'describe-hunk-of-an-unknown-type-%s-names-the-place',
    (type, place, labelKey) => {
        const service = new AgentEventService();
        const unknown = hunkOf(type as HunkType, { ...place, startLine: 3 });

        expect(service.describeHunk(unknown)).toEqual({
            kind: 'event',
            labelKey,
            file: place.fileName,
            segmentId: place.segmentId,
            lines: '#L3',
            // неизвестный тип не считается навигабельным
            target: undefined,
        });
    }
);

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

test('last-navigation-target-is-the-last-place-changed', () => {
    const service = new AgentEventService();
    const fresh = [
        hunkOf('addLinesToSegment', { id: 'a', segmentId: 2, startLine: 3 }),
        hunkOf('addLinesToFile', { id: 'b', fileName: 'a.tex', startLine: 5 }),
        // удаление некуда показать, оно не должно перебить прошлую цель
        hunkOf('deleteLinesFromSegment', { id: 'c', segmentId: 1 }),
    ];

    expect(service.lastNavigationTarget(fresh)).toEqual({
        segmentIndex: -1,
        line: 5,
        file: 'a.tex',
        focus: false,
    });
    expect(service.lastNavigationTarget([])).toBeUndefined();
});

// читающий инструмент сам ничего не перечитывает, поэтому видно, что решают hunks
const READING_TOOL: AgentToolName = 'read_segment';

test.each([
    ['add_segment'],
    ['add_lines_to_segment'],
    ['delete_lines_from_segment'],
] as const)(
    'reload-scope-of-%s-asks-for-the-program-even-without-hunk-changes',
    (tool) => {
        const service = new AgentEventService();

        expect(service.reloadScope(tool, [])).toEqual({
            program: true,
            files: false,
        });
    }
);

test.each([
    ['add_file'],
    ['add_lines_to_file'],
    ['delete_lines_from_file'],
] as const)(
    'reload-scope-of-%s-asks-for-the-files-even-without-hunk-changes',
    (tool) => {
        const service = new AgentEventService();

        expect(service.reloadScope(tool, [])).toEqual({
            program: false,
            files: true,
        });
    }
);

test.each(READ_TOOLS.map((tool) => [tool]))(
    'reload-scope-of-%s-asks-for-nothing',
    (tool) => {
        const service = new AgentEventService();

        expect(service.reloadScope(tool, [])).toEqual({
            program: false,
            files: false,
        });
    }
);

test.each([
    ['addSegment'],
    ['addLinesToSegment'],
    ['deleteLinesFromSegment'],
] as const)('reload-scope-of-%s-asks-for-the-program-only', (type) => {
    const service = new AgentEventService();

    expect(
        service.reloadScope(READING_TOOL, [hunkOf(type, { segmentId: 1 })])
    ).toEqual({
        program: true,
        files: false,
    });
});

test.each([['addFile'], ['addLinesToFile'], ['deleteLinesFromFile']] as const)(
    'reload-scope-of-%s-asks-for-the-files-only',
    (type) => {
        const service = new AgentEventService();

        expect(
            service.reloadScope(READING_TOOL, [
                hunkOf(type, { fileName: 'a.tex' }),
            ])
        ).toEqual({ program: false, files: true });
    }
);

test('reload-scope-of-a-mixed-batch-asks-for-both', () => {
    const service = new AgentEventService();

    expect(
        service.reloadScope(READING_TOOL, [
            hunkOf('deleteLinesFromSegment', { id: 'a', segmentId: 1 }),
            hunkOf('addFile', { id: 'b', fileName: 'a.tex' }),
        ])
    ).toEqual({ program: true, files: true });
});

// незнакомый инструмент мог писать без hunks, и следующее сохранение затёрло бы его правку
test.each(UNKNOWN_TOOLS)(
    'reload-scope-of-%s-without-hunks-asks-for-the-program-and-the-files',
    (_case, tool) => {
        const service = new AgentEventService();

        expect(service.reloadScope(tool, [])).toEqual({
            program: true,
            files: true,
        });
    }
);

test('describe-model-call-uses-the-model-call-key', () => {
    const service = new AgentEventService();

    expect(service.describeModelCall()).toEqual({
        kind: 'event',
        labelKey: 'model_call',
    });
});

test('describe-changes-keeps-one-line-per-place-in-order-of-appearance', () => {
    const service = new AgentEventService();
    const hunks = [
        hunkOf('addLinesToSegment', { id: 'a', segmentId: 3 }),
        hunkOf('addLinesToFile', { id: 'b', fileName: 'main.tex' }),
        hunkOf('deleteLinesFromSegment', { id: 'c', segmentId: 3 }),
    ];

    // вторая правка того же сегмента новой строки не даёт и порядок не меняет
    expect(service.describeChanges(hunks)).toEqual([
        { labelKey: 'segment', segmentId: 3 },
        { labelKey: 'file', file: 'main.tex' },
    ]);
});

test('describe-changes-replaces-the-tail-with-one-common-line', () => {
    const service = new AgentEventService();
    const hunks = [1, 2, 3, 4, 5, 6].map((segmentId) =>
        hunkOf('addLinesToSegment', { id: `h${segmentId}`, segmentId })
    );

    const changes = service.describeChanges(hunks, 5);

    expect(changes).toHaveLength(6);
    expect(changes[4]).toEqual({ labelKey: 'segment', segmentId: 5 });
    expect(changes[5]).toEqual({ labelKey: 'more' });
});

test('describe-changes-does-not-hide-a-hunk-without-a-place', () => {
    const service = new AgentEventService();

    expect(service.describeChanges([hunkOf('addLinesToSegment')])).toEqual([
        { labelKey: 'other' },
    ]);
});

test.each([['ru'], ['en']] as const)(
    'every-change-key-exists-in-the-%s-dictionary',
    (language) => {
        const service = new AgentEventService();
        const texts = dictionary[language].agent_chat.change as Record<
            string,
            string
        >;
        const places = [
            hunkOf('addLinesToSegment', { id: 'a', segmentId: 1 }),
            hunkOf('addLinesToFile', { id: 'b', fileName: 'main.tex' }),
            hunkOf('addLinesToSegment', { id: 'c' }),
        ];
        // второй вызов с коротким пределом добавляет ключ общего хвоста
        const keys = [
            ...service.describeChanges(places),
            ...service.describeChanges(places, 1),
        ].map((change) => change.labelKey);

        const missing = keys.filter((key) => texts[key] === undefined);
        expect(missing).toEqual([]);
        expect(new Set(keys)).toEqual(
            new Set(['segment', 'file', 'other', 'more'])
        );
    }
);

test.each([['ru'], ['en']] as const)(
    'every-label-key-exists-in-the-%s-dictionary',
    (language) => {
        const service = new AgentEventService();
        const events = dictionary[language].agent_chat.event as Record<
            string,
            string
        >;
        const keys = new Set<string>([service.describeModelCall().labelKey]);
        const tools = [
            ...AGENT_TOOL_NAMES,
            ...UNKNOWN_TOOLS.map(([, tool]) => tool),
        ];
        for (const tool of tools) {
            for (const draft of service.describeToolCall(tool, [])) {
                keys.add(draft.labelKey);
            }
        }
        for (const type of ALL_HUNK_TYPES) {
            keys.add(service.describeHunk(hunkOf(type)).labelKey);
        }
        // подпись незнакомого типа правки тоже должна быть переводимой
        for (const [type, place] of UNKNOWN_HUNKS) {
            keys.add(
                service.describeHunk(hunkOf(type as HunkType, place)).labelKey
            );
        }

        // только свои ключи: по 'constructor' обычный объект нашёл бы функцию
        const missing = [...keys].filter(
            (key) => !Object.prototype.hasOwnProperty.call(events, key)
        );
        expect(missing).toEqual([]);
    }
);
