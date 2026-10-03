import { expect, test, type Locator, type Page } from '@playwright/test';
import { Hunk, Program, Segment } from '../../model/domain.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const LINE_COUNT = 17;

test.use({
    viewport: { width: 1280, height: 900 },
});

function mdSegment(id: number, text: string): Segment {
    return {
        id,
        type: 'md',
        text,
        parameters: { visible: true },
    };
}

function programOf(...segments: Segment[]): Program {
    return {
        segments,
        parameters: { roundStrategy: 'noRound' },
    };
}

function numberedLines(count: number): string {
    return Array.from({ length: count }, (_, index) => String(index + 1)).join(
        '\n'
    );
}

const LONG_LINE =
    'A very long added line that should wrap across the editor width ' +
    'word '.repeat(24).trim();

const MULTILINE_TEXT = [LONG_LINE, LONG_LINE, LONG_LINE].join('\n');

// на телефоне нет общей панели правок, а файлы открываются через переключатель экранов
const isPhoneLayout = (page: Page) => (page.viewportSize()?.width ?? 0) <= 767;

async function openProjectWithHunks(
    page: Page,
    options: {
        program: Program;
        hunks: Hunk[];
        files?: { fileName: string; url: string }[];
        fileContents?: { urlPath: string; content: string }[];
        mobile?: boolean;
        deleteDelayMs?: number;
        onDelete?: (hunkId: string, revert: boolean) => void;
    }
) {
    if (options.mobile) {
        await page.setViewportSize({ width: 480, height: 900 });
    }
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', options.program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    if (options.files) {
        await routeSetup.setupListFilesCustom(options.files);
    } else {
        await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    }
    for (const file of options.fileContents ?? []) {
        await routeSetup.setupStaticFileContent(file.urlPath, file.content);
    }
    const hunkServer = await routeSetup.setupHunkRequestsWithState(
        options.hunks,
        { deleteDelayMs: options.deleteDelayMs, onDelete: options.onDelete }
    );

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(`/project/${uuid}`);
    if (isPhoneLayout(page)) {
        // на мобильном общей панели нет, ждём сам редактор
        await page.locator('.cm-content').first().waitFor({ state: 'visible' });
        return hunkServer;
    }
    await expect(
        page.getByRole('button', { name: 'Accept all' })
    ).toBeVisible();
    return hunkServer;
}

async function expectFullPageHunkSnapshot(page: Page, name: string) {
    await expect(page).toHaveScreenshot(`${name}.png`, {
        animations: 'disabled',
        maxDiffPixels: 2000,
    });
}

test('hunk-add-empty-segment', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'existing segment'), mdSegment(2, '')),
        hunks: [{ id: 'hunk-add-segment', type: 'addSegment', segmentId: 2 }],
    });

    await expect(page.locator('.segment-hunk-block--new')).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-empty-segment');
});

test('hunk-add-segment-with-text', async ({ page }) => {
    const newText = 'New segment from hunk';
    await openProjectWithHunks(page, {
        program: programOf(
            mdSegment(1, 'existing segment'),
            mdSegment(2, newText)
        ),
        hunks: [
            { id: 'hunk-add-segment', type: 'addSegment', segmentId: 2 },
            {
                id: 'hunk-add-lines',
                type: 'addLinesToSegment',
                segmentId: 2,
                startLine: 1,
                endLine: 1,
                text: newText,
            },
        ],
    });

    await expect(page.locator('.segment-hunk-block--new')).toBeVisible();
    await expect(
        page.locator('#ide-segment-1').getByText(newText)
    ).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-segment-with-text');
});

test('hunk-add-line-to-existing-segment', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'existing line\nadded line')),
        hunks: [
            {
                id: 'hunk-add-line',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 2,
                text: 'added line',
            },
        ],
    });

    await expect(page.locator('.cm-hunk-added-line')).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-line-to-existing-segment');
});

test('hunk-add-lines-begin-middle-end', async ({ page }) => {
    const original = numberedLines(LINE_COUNT).split('\n');
    const newText = [
        'BEGIN',
        ...original.slice(0, 8),
        'MIDDLE',
        ...original.slice(8),
        'END',
    ].join('\n');

    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, newText)),
        hunks: [
            {
                id: 'hunk-begin',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 1,
                endLine: 1,
                text: 'BEGIN',
            },
            {
                id: 'hunk-middle',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 10,
                endLine: 10,
                text: 'MIDDLE',
            },
            {
                id: 'hunk-end',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 20,
                endLine: 20,
                text: 'END',
            },
        ],
    });

    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(page, 'hunk-add-lines-begin-middle-end');
});

test('hunk-add-penultimate-line', async ({ page }) => {
    const original = numberedLines(LINE_COUNT).split('\n');
    const newText = [
        ...original.slice(0, 16),
        'PENULTIMATE',
        original[16],
    ].join('\n');

    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, newText)),
        hunks: [
            {
                id: 'hunk-penultimate',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 17,
                endLine: 17,
                text: 'PENULTIMATE',
            },
        ],
    });

    await expect(page.locator('.cm-hunk-added-line')).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-penultimate-line');
});

test('hunk-add-multiline-line', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, `keep\n${MULTILINE_TEXT}`)),
        hunks: [
            {
                id: 'hunk-multiline-add',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 4,
                text: MULTILINE_TEXT,
            },
        ],
    });

    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(page, 'hunk-add-multiline-line');
});

test('hunk-delete-multiline-line', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'keep start\nkeep end')),
        hunks: [
            {
                id: 'hunk-multiline-delete',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 4,
                text: MULTILINE_TEXT,
            },
        ],
    });

    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(page, 'hunk-delete-multiline-line');
});

test('hunk-delete-first-middle-last-lines', async ({ page }) => {
    const remaining = numberedLines(LINE_COUNT)
        .split('\n')
        .filter((line) => line !== '1' && line !== '9' && line !== '17')
        .join('\n');

    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, remaining)),
        hunks: [
            {
                id: 'hunk-delete-first',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 1,
                endLine: 1,
                text: '1',
            },
            {
                id: 'hunk-delete-middle',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 8,
                endLine: 8,
                text: '9',
            },
            {
                id: 'hunk-delete-last',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 15,
                endLine: 15,
                text: '17',
            },
        ],
    });

    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(
        page,
        'hunk-delete-first-middle-last-lines'
    );
});

test('hunk-replace-first-middle-last-lines', async ({ page }) => {
    const original = numberedLines(LINE_COUNT).split('\n');
    const replacements: Record<number, string> = {
        1: 'FIRST',
        9: 'MIDDLE',
        17: 'LAST',
    };
    const newText = original
        .map((line, index) => replacements[index + 1] ?? line)
        .join('\n');

    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, newText)),
        hunks: [1, 9, 17].flatMap((line) => [
            {
                id: `hunk-replace-delete-${line}`,
                type: 'deleteLinesFromSegment' as const,
                segmentId: 1,
                startLine: line,
                endLine: line,
                text: String(line),
            },
            {
                id: `hunk-replace-add-${line}`,
                type: 'addLinesToSegment' as const,
                segmentId: 1,
                startLine: line,
                endLine: line,
                text: replacements[line],
            },
        ]),
    });

    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(
        page,
        'hunk-replace-first-middle-last-lines'
    );
});

test('hunk-add-file', async ({ page }) => {
    const fileText = 'new file line 1\nnew file line 2';
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'project')),
        hunks: [
            { id: 'hunk-add-file', type: 'addFile', fileName: 'notes.txt' },
            {
                id: 'hunk-add-file-lines',
                type: 'addLinesToFile',
                fileName: 'notes.txt',
                startLine: 1,
                endLine: 2,
                text: fileText,
            },
        ],
    });

    await page.locator('div.file-manager-button').click();
    await expect(page.getByText('notes.txt')).toBeVisible();
    await page.getByText('notes.txt').click();
    await expect(page.getByText('new file line 1')).toBeVisible();
    await expectFullPageHunkSnapshot(page, 'hunk-add-file');
});

test('hunk-delete-lines-from-file', async ({ page }) => {
    // на сервере файл уже без удалённых строк, номера считаются по нему, как у сегментов
    const fileOnDisk = numberedLines(LINE_COUNT)
        .split('\n')
        .filter((line) => line !== '1' && line !== '9' && line !== '17')
        .join('\n');
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'project')),
        hunks: [
            {
                id: 'hunk-delete-file-first',
                type: 'deleteLinesFromFile',
                fileName: 'notes.txt',
                startLine: 1,
                endLine: 1,
                text: '1',
            },
            {
                id: 'hunk-delete-file-middle',
                type: 'deleteLinesFromFile',
                fileName: 'notes.txt',
                startLine: 8,
                endLine: 8,
                text: '9',
            },
            {
                id: 'hunk-delete-file-last',
                type: 'deleteLinesFromFile',
                fileName: 'notes.txt',
                startLine: 15,
                endLine: 15,
                text: '17',
            },
        ],
        files: [{ fileName: 'notes.txt', url: '/files/notes.txt' }],
        fileContents: [{ urlPath: '/files/notes.txt', content: fileOnDisk }],
    });

    await page.locator('div.file-manager-button').click();
    await expect(page.getByText('notes.txt')).toBeVisible();
    await page.getByText('notes.txt').click();
    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expectFullPageHunkSnapshot(page, 'hunk-delete-lines-from-file');
});

/** Строки редактора сверху вниз: « » обычная, «+» зелёная, «-» призрак старой, [..] кнопки */
function editorRows(editor: Locator): Promise<string[]> {
    return editor.locator('.cm-content').evaluate((content) =>
        [...content.children].flatMap((node) => {
            if (node.classList.contains('cm-line')) {
                const mark = node.classList.contains('cm-hunk-added-line')
                    ? '+'
                    : ' ';
                return [`${mark}${node.textContent}`];
            }
            if (node.classList.contains('cm-hunk-deleted-wrap')) {
                // пустая старая строка рисуется пробелом, иначе у неё не было бы высоты
                return [...node.querySelectorAll('.cm-hunk-deleted-line')].map(
                    (line) =>
                        `-${line.textContent === ' ' ? '' : line.textContent}`
                );
            }
            if (node.classList.contains('cm-hunk-controls-host')) {
                const buttons = [...node.querySelectorAll('button')].map(
                    (button) => button.textContent
                );
                return [`[${buttons.join('|')}]`];
            }
            return [];
        })
    );
}

const HUNK_BUTTONS = '[Accept change|Revert change]';

/** Флаг revert в адресе DELETE как он ушёл: false от пропущенного параметра не отличить по includes */
function recordHunkDeletes(page: Page) {
    const deletes: { hunkId: string; revert: string | null }[] = [];
    page.on('request', (request) => {
        if (request.method() !== 'DELETE') {
            return;
        }
        const url = new URL(request.url());
        const hunkId = url.pathname.split('/hunk/')[1];
        if (hunkId) {
            deletes.push({ hunkId, revert: url.searchParams.get('revert') });
        }
    });
    return deletes;
}

// формы замены с препрода: диапазон это новые строки, text заменённые старые, "" одна пустая строка
const SEGMENT_REPLACES = {
    program: programOf(
        mdSegment(1, 'intro\nRow one.\n\nRow three.\nomega'),
        mdSegment(2, 'intro\nFilled line.\nomega')
    ),
    hunks: [
        {
            id: 'hunk-replace-lines',
            type: 'replaceTextInSegment',
            segmentId: 1,
            startLine: 2,
            endLine: 4,
            text: 'Second paragraph line.\nThird paragraph line.',
        },
        {
            id: 'hunk-replace-blank',
            type: 'replaceTextInSegment',
            segmentId: 2,
            startLine: 2,
            endLine: 2,
            text: '',
        },
    ] satisfies Hunk[],
};

test('hunk-replace-in-segment-shows-old-lines-above-new', async ({ page }) => {
    await openProjectWithHunks(page, SEGMENT_REPLACES);

    await expect
        .poll(() => editorRows(page.locator('#ide-segment-0')))
        .toEqual([
            ' intro',
            '-Second paragraph line.',
            '-Third paragraph line.',
            '+Row one.',
            '+',
            '+Row three.',
            HUNK_BUTTONS,
            ' omega',
        ]);
    await expect
        .poll(() => editorRows(page.locator('#ide-segment-1')))
        .toEqual([' intro', '-', '+Filled line.', HUNK_BUTTONS, ' omega']);
    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(3);
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(4);
    // одна пара кнопок на замену
    await expect(page.locator('.cm-hunk-btn--accept')).toHaveCount(2);
    await expect(page.locator('.cm-hunk-btn--revert')).toHaveCount(2);
    await expect(page.getByText('Total 2 changes')).toBeVisible();
});

test('hunk-replace-in-segment-accept-and-revert-send-their-flag', async ({
    page,
}) => {
    const deletes = recordHunkDeletes(page);
    await openProjectWithHunks(page, SEGMENT_REPLACES);

    await page.locator('#ide-segment-0 .cm-hunk-btn--accept').click();
    await expect
        .poll(() => deletes)
        .toEqual([{ hunkId: 'hunk-replace-lines', revert: 'false' }]);
    await expect(
        page.locator('#ide-segment-0 .cm-hunk-deleted-line')
    ).toHaveCount(0);

    await page.locator('#ide-segment-1 .cm-hunk-btn--revert').click();
    await expect
        .poll(() => deletes)
        .toEqual([
            { hunkId: 'hunk-replace-lines', revert: 'false' },
            { hunkId: 'hunk-replace-blank', revert: 'true' },
        ]);
    await expect(page.locator('.cm-hunk-deleted-line')).toHaveCount(0);
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(0);
});

test('hunk-global-bar-is-hidden-on-mobile', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'existing line\nadded line')),
        hunks: [
            {
                id: 'hunk-add-line',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 2,
                text: 'added line',
            },
        ],
        mobile: true,
    });

    // само изменение и кнопки у него на месте, общей панели быть не должно
    await expect(page.locator('.cm-hunk-added-line')).toBeVisible();
    await expect(page.locator('.cm-hunk-btn--accept').first()).toBeVisible();
    await expect(page.locator('.hunk-global-bar')).toHaveCount(0);
});

test('new-segment-hunk-keeps-its-buttons-on-mobile', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'existing segment'), mdSegment(2, '')),
        hunks: [{ id: 'hunk-add-segment', type: 'addSegment', segmentId: 2 }],
        mobile: true,
    });

    // у нового сегмента кнопки свои, общая панель для него не нужна
    await expect(page.locator('.segment-hunk-block--new')).toBeVisible();
    await expect(page.locator('.segment-hunk-btn--accept')).toBeVisible();
    await expect(page.locator('.hunk-global-bar')).toHaveCount(0);
});

test('hunk-accept-all-deletes-every-hunk', async ({ page }) => {
    const hunkServer = await openProjectWithHunks(page, {
        program: programOf(
            mdSegment(1, 'first\nadded one'),
            mdSegment(2, 'second\nadded two'),
            mdSegment(3, 'third\nadded three')
        ),
        hunks: ['one', 'two', 'three'].map((word, index) => ({
            id: `hunk-${index + 1}`,
            type: 'addLinesToSegment' as const,
            segmentId: index + 1,
            startLine: 2,
            endLine: 2,
            text: `added ${word}`,
        })),
        deleteDelayMs: 50,
    });
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(3);
    await expect(page.getByText('Total 3 changes')).toBeVisible();

    await page.getByRole('button', { name: 'Accept all' }).click();

    await expect(page.locator('.hunk-global-bar')).toHaveCount(0);
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(0);
    // приём идёт по одному, одновременных удалений на сервере быть не должно
    expect(hunkServer.maxInFlight()).toBe(1);
    expect(hunkServer.deleted()).toEqual(['hunk-1', 'hunk-2', 'hunk-3']);
});

test('hunk-accept-all-survives-typing', async ({ page }) => {
    const hunkServer = await openProjectWithHunks(page, {
        program: programOf(
            mdSegment(1, 'first\nadded one'),
            mdSegment(2, 'second\nadded two'),
            mdSegment(3, 'third\nadded three')
        ),
        hunks: ['one', 'two', 'three'].map((word, index) => ({
            id: `hunk-${index + 1}`,
            type: 'addLinesToSegment' as const,
            segmentId: index + 1,
            startLine: 2,
            endLine: 2,
            text: `added ${word}`,
        })),
        deleteDelayMs: 150,
    });
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(3);

    await page.getByRole('button', { name: 'Accept all' }).click();
    // редактор во время приёма не заблокирован, и набор текста не должен слать свои удаления
    const editor = page.locator('.cm-content').nth(2);
    await editor.click();
    await editor.pressSequentially('typed');

    await expect(page.locator('.hunk-global-bar')).toHaveCount(0);
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(0);
    expect(hunkServer.maxInFlight()).toBe(1);
    expect(hunkServer.deleted()).toEqual(['hunk-1', 'hunk-2', 'hunk-3']);
});

test('hunk-trailing-line-break-in-segment-follows-the-range', async ({
    page,
}) => {
    await openProjectWithHunks(page, {
        program: programOf(
            mdSegment(1, 'intro\nnew para\n\nomega'),
            mdSegment(2, 'intro\nNEW 1\nNEW 2\nomega')
        ),
        hunks: [
            // сервер склеивает строки без завершающего перевода: здесь абзац и пустая строка после него
            {
                id: 'hunk-add-blank',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 3,
                text: 'new para\n',
            },
            // здесь диапазон на строку короче текста, и \n в конце только завершает его
            {
                id: 'hunk-add-with-break',
                type: 'addLinesToSegment',
                segmentId: 2,
                startLine: 2,
                endLine: 3,
                text: 'NEW 1\nNEW 2\n',
            },
        ],
    });

    // id редактора сегмента идёт по его индексу в программе
    const addedLines = (segmentIndex: number) =>
        page.locator(
            `#ide-segment-${segmentIndex} .cm-content > .cm-line.cm-hunk-added-line`
        );
    await expect(addedLines(0)).toHaveText(['new para', '']);
    await expect(addedLines(1)).toHaveText(['NEW 1', 'NEW 2']);
});

test('hunk-deleted-blank-line-in-segment-is-shown', async ({ page }) => {
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'intro\nomega')),
        hunks: [
            {
                id: 'hunk-delete-blank',
                type: 'deleteLinesFromSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 3,
                text: 'old\n',
            },
        ],
    });

    // удалены две строки, и пустая из них тоже видна в красном блоке
    await expect(
        page.locator('#ide-segment-0 .cm-hunk-deleted-line')
    ).toHaveText(['old', '']);
});

const AGENT_FILE = 'notes.txt';
const AGENT_FILE_URL = '/files/notes.txt';

interface AgentFileEdit {
    // текст файла до агента: к нему сервер возвращает файл при откате
    before: string;
    // сервер хранит уже новый текст, hunks только описывают правку
    after: string;
    hunks: Hunk[];
}

function fileHunk(
    id: string,
    type: 'addLinesToFile' | 'deleteLinesFromFile' | 'replaceTextInFile',
    startLine: number,
    endLine: number,
    text: string
): Hunk {
    return { id, type, fileName: AGENT_FILE, startLine, endLine, text };
}

const AGENT_EDIT: AgentFileEdit = {
    before: ['intro', 'alpha', 'middle', 'omega'].join('\n'),
    after: [
        'intro',
        'alpha',
        'ALPHA ADDED',
        'middle',
        'INSERTED ONE',
        'INSERTED TWO',
        'omega',
        'SECOND',
        'FIRST',
    ].join('\n'),
    hunks: [
        // абзац дописан: удалена строка, и вставлена она же с продолжением
        fileHunk(
            'hunk-file-delete-alpha',
            'deleteLinesFromFile',
            2,
            2,
            'alpha'
        ),
        fileHunk(
            'hunk-file-add-alpha',
            'addLinesToFile',
            2,
            3,
            'alpha\nALPHA ADDED'
        ),
        // текст вставки кончается переводом строки, а диапазон 5..6 говорит, что пустой строки за ним нет
        fileHunk(
            'hunk-file-add-middle',
            'addLinesToFile',
            5,
            6,
            'INSERTED ONE\nINSERTED TWO\n'
        ),
        // повторная правка того же места склеена не в порядке строк файла
        fileHunk('hunk-file-add-end', 'addLinesToFile', 8, 9, 'FIRST\nSECOND'),
    ],
};

const AGENT_NEW_LINES = [
    'ALPHA ADDED',
    'INSERTED ONE',
    'INSERTED TWO',
    'SECOND',
    'FIRST',
];

const SINGLE_AGENT_EDIT: AgentFileEdit = {
    before: ['intro', 'omega'].join('\n'),
    after: ['intro', 'INSERTED ONE', 'INSERTED TWO', 'omega'].join('\n'),
    hunks: [
        fileHunk(
            'hunk-file-add-single',
            'addLinesToFile',
            2,
            3,
            'INSERTED ONE\nINSERTED TWO\n'
        ),
    ],
};

async function openFileEditedByAgent(page: Page, edit: AgentFileEdit) {
    // только моки: страница не ходит наружу
    await page.route(
        (url) => url.hostname !== 'localhost',
        (route) => route.abort()
    );
    const file = await new RouteSetup(page).setupEditableTextFile(
        AGENT_FILE,
        AGENT_FILE_URL,
        edit.after
    );
    const deletes: { hunkId: string; revert: boolean }[] = [];
    await openProjectWithHunks(page, {
        program: programOf(mdSegment(1, 'project')),
        hunks: edit.hunks,
        files: [{ fileName: AGENT_FILE, url: AGENT_FILE_URL }],
        onDelete: (hunkId, revert) => {
            deletes.push({ hunkId, revert });
            // откат всех правок возвращает файлу текст до агента
            if (
                deletes.filter((item) => item.revert).length ===
                edit.hunks.length
            ) {
                file.setContent(edit.before);
            }
        },
    });
    if (isPhoneLayout(page)) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'Files' }).click();
    } else {
        await page.locator('div.file-manager-button').click();
    }
    await page.getByText(AGENT_FILE, { exact: true }).click();
    await expect(
        page.locator('.text-file-editor-panel .cm-hunk-controls').first()
    ).toBeVisible();
    return { file, deletes };
}

const fileEditorLines = (page: Page) =>
    page.locator('.text-file-editor-panel .cm-content > .cm-line');

const fileEditorAddedLines = (page: Page) =>
    page.locator(
        '.text-file-editor-panel .cm-content > .cm-line.cm-hunk-added-line'
    );

type AgentFile = Awaited<ReturnType<typeof openFileEditedByAgent>>['file'];

// автосохранение файла уходит через секунду после изменения: проверка «загрузок нет» раньше этого окна прошла бы и при ошибочном сохранении
const AUTOSAVE_WINDOW_MS = 2000;

/** После приёма или отката файл перечитывается: экран сверяется только с тем, что пришло в этом ответе */
async function clickAndWaitForFileReload(
    page: Page,
    file: AgentFile,
    button: Locator
) {
    const reloaded = page.waitForResponse(
        (response) => new URL(response.url()).pathname === AGENT_FILE_URL
    );
    await button.click();
    await (await reloaded).finished();
    await expect.poll(() => file.fetches()).toBe(2);
    // текст ответа доходит до CodeMirror через рендер, два кадра его пропускают
    await page.evaluate(
        () =>
            new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve))
            )
    );
}

async function expectNoUploadsAfterAutosaveWindow(page: Page, file: AgentFile) {
    await page.waitForTimeout(AUTOSAVE_WINDOW_MS);
    expect(file.uploads()).toEqual([]);
    expect(file.fetches()).toBe(2);
}

test('hunk-file-new-lines-are-shown-once', async ({ page }) => {
    await openFileEditedByAgent(page, AGENT_EDIT);

    await expect(fileEditorLines(page)).toHaveText(
        AGENT_EDIT.after.split('\n')
    );
    // новая строка ровно одна и зелёная, белого дубля под ней нет
    const shown = await fileEditorLines(page).allTextContents();
    for (const line of AGENT_NEW_LINES) {
        expect(shown.filter((text) => text === line)).toHaveLength(1);
    }
    await expect(fileEditorAddedLines(page)).toHaveText([
        'alpha',
        ...AGENT_NEW_LINES,
    ]);
    await expect(
        page.locator('.text-file-editor-panel .cm-hunk-deleted-line')
    ).toHaveText(['alpha']);
});

test('hunk-file-agent-blank-line-is-added', async ({ page }) => {
    await openFileEditedByAgent(page, {
        before: ['intro', 'omega'].join('\n'),
        after: ['intro', 'new para', '', 'omega'].join('\n'),
        // абзац и пустая строка после него, склеенные без завершающего перевода
        hunks: [
            fileHunk(
                'hunk-file-add-blank',
                'addLinesToFile',
                2,
                3,
                'new para\n'
            ),
        ],
    });

    await expect(fileEditorLines(page)).toHaveText([
        'intro',
        'new para',
        '',
        'omega',
    ]);
    await expect(fileEditorAddedLines(page)).toHaveText(['new para', '']);
});

test('hunk-file-deleted-blank-line-is-shown', async ({ page }) => {
    await openFileEditedByAgent(page, {
        before: ['intro', 'old', '', 'omega'].join('\n'),
        after: ['intro', 'omega'].join('\n'),
        hunks: [
            fileHunk(
                'hunk-file-delete-blank',
                'deleteLinesFromFile',
                2,
                3,
                'old\n'
            ),
        ],
    });

    await expect(
        page.locator('.text-file-editor-panel .cm-hunk-deleted-line')
    ).toHaveText(['old', '']);
});

test('hunk-file-accept-all-keeps-new-text', async ({ page }) => {
    const { file, deletes } = await openFileEditedByAgent(page, AGENT_EDIT);

    await clickAndWaitForFileReload(
        page,
        file,
        page.getByRole('button', { name: 'Accept all' })
    );

    await expect(page.locator('.hunk-global-bar')).toHaveCount(0);
    await expect(fileEditorLines(page)).toHaveText(
        AGENT_EDIT.after.split('\n')
    );
    await expect(fileEditorAddedLines(page)).toHaveCount(0);
    expect(deletes).toEqual(
        AGENT_EDIT.hunks.map((hunk) => ({ hunkId: hunk.id, revert: false }))
    );
    await expectNoUploadsAfterAutosaveWindow(page, file);
});

test('hunk-file-revert-all-restores-old-text', async ({ page }) => {
    const { file, deletes } = await openFileEditedByAgent(page, AGENT_EDIT);

    await clickAndWaitForFileReload(
        page,
        file,
        page.getByRole('button', { name: 'Revert all' })
    );

    await expect(page.locator('.hunk-global-bar')).toHaveCount(0);
    await expect(fileEditorLines(page)).toHaveText(
        AGENT_EDIT.before.split('\n')
    );
    await expect(fileEditorAddedLines(page)).toHaveCount(0);
    expect(deletes).toEqual(
        AGENT_EDIT.hunks.map((hunk) => ({ hunkId: hunk.id, revert: true }))
    );
    await expectNoUploadsAfterAutosaveWindow(page, file);
});

test('hunk-file-accept-one-keeps-new-text', async ({ page }) => {
    const { file, deletes } = await openFileEditedByAgent(
        page,
        SINGLE_AGENT_EDIT
    );

    await clickAndWaitForFileReload(
        page,
        file,
        page.locator('.text-file-editor-panel .cm-hunk-btn--accept')
    );

    await expect(fileEditorAddedLines(page)).toHaveCount(0);
    await expect(fileEditorLines(page)).toHaveText(
        SINGLE_AGENT_EDIT.after.split('\n')
    );
    expect(deletes).toEqual([
        { hunkId: 'hunk-file-add-single', revert: false },
    ]);
    await expectNoUploadsAfterAutosaveWindow(page, file);
});

test('hunk-file-revert-one-restores-old-text', async ({ page }) => {
    const { file, deletes } = await openFileEditedByAgent(
        page,
        SINGLE_AGENT_EDIT
    );

    await clickAndWaitForFileReload(
        page,
        file,
        page.locator('.text-file-editor-panel .cm-hunk-btn--revert')
    );

    await expect(fileEditorAddedLines(page)).toHaveCount(0);
    await expect(fileEditorLines(page)).toHaveText(
        SINGLE_AGENT_EDIT.before.split('\n')
    );
    expect(deletes).toEqual([{ hunkId: 'hunk-file-add-single', revert: true }]);
    await expectNoUploadsAfterAutosaveWindow(page, file);
});

test('hunk-file-typing-saves-stored-text', async ({ page }) => {
    const { file } = await openFileEditedByAgent(page, AGENT_EDIT);

    await fileEditorLines(page).first().click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');

    // на сервер уходит то, что там лежало, плюс набранный символ, без дублей
    await expect
        .poll(() => file.uploads())
        .toEqual([AGENT_EDIT.after.replace('intro', 'intro!')]);
});

test('hunk-file-typing-keeps-typed-text', async ({ page }) => {
    const { file, deletes } = await openFileEditedByAgent(page, AGENT_EDIT);
    const after = AGENT_EDIT.after;

    await fileEditorLines(page).first().click();
    await page.keyboard.press('End');
    await page.keyboard.type('!');
    // набор принимает правки агента, после приёма hunks перечитываются
    await expect.poll(() => deletes.length).toBe(AGENT_EDIT.hunks.length);
    await expect
        .poll(() => file.uploads())
        .toEqual([after.replace('intro', 'intro!')]);
    await expect(fileEditorLines(page).first()).toHaveText('intro!');

    // курсор остался за набранным символом, следующий идёт следом
    await page.keyboard.type('?');
    await expect
        .poll(() => file.uploads())
        .toEqual([
            after.replace('intro', 'intro!'),
            after.replace('intro', 'intro!?'),
        ]);
    await expect(fileEditorLines(page).first()).toHaveText('intro!?');
});

test('hunk-file-typing-during-reload-keeps-typed-text', async ({ page }) => {
    const { file } = await openFileEditedByAgent(page, AGENT_EDIT);
    const after = AGENT_EDIT.after;
    file.setFetchDelayMs(1500);
    const staleAnswer = page.waitForResponse(
        (response) => new URL(response.url()).pathname === AGENT_FILE_URL
    );

    // после приёма файл перечитывается, ответ задержан, и в это время идёт набор
    await page
        .locator('.text-file-editor-panel .cm-hunk-btn--accept')
        .first()
        .click();
    await expect.poll(() => file.fetches()).toBe(2);
    await fileEditorLines(page).first().click();
    await page.keyboard.press('End');
    await page.keyboard.type('X');
    await staleAnswer;
    await page.keyboard.type('Y');

    await expect
        .poll(() => file.uploads().slice(-1))
        .toEqual([after.replace('intro', 'introXY')]);
    await expect(fileEditorLines(page).first()).toHaveText('introXY');
});

// файл после двух замен агента: последняя съела пустую строку после завершающего перевода, и файл его потерял
const REPLACE_FILE_EDIT: AgentFileEdit = {
    before: [
        'intro',
        'line c',
        '',
        'line d',
        'middle',
        'line e',
        'keep 3',
        'line f',
        'keep 4',
        '',
    ].join('\n'),
    after: [
        'intro',
        'line X',
        'line Y',
        'middle',
        'NEW 1',
        'NEW 2',
        'NEW 3',
        'NEW 4',
    ].join('\n'),
    hunks: [
        fileHunk(
            'hunk-file-replace-para',
            'replaceTextInFile',
            2,
            3,
            'line c\n\nline d'
        ),
        fileHunk(
            'hunk-file-replace-tail',
            'replaceTextInFile',
            5,
            8,
            'line e\nkeep 3\nline f\nkeep 4\n'
        ),
    ],
};

const SINGLE_REPLACE_FILE_EDIT: AgentFileEdit = {
    before: ['intro', 'line c', '', 'line d', 'omega'].join('\n'),
    after: ['intro', 'line X', 'line Y', 'omega'].join('\n'),
    hunks: [
        fileHunk(
            'hunk-file-replace-single',
            'replaceTextInFile',
            2,
            3,
            'line c\n\nline d'
        ),
    ],
};

const fileEditor = (page: Page) => page.locator('.text-file-editor-panel');

test('hunk-replace-in-file-shows-old-lines-above-new', async ({ page }) => {
    await openFileEditedByAgent(page, REPLACE_FILE_EDIT);

    await expect
        .poll(() => editorRows(fileEditor(page)))
        .toEqual([
            ' intro',
            '-line c',
            '-',
            '-line d',
            '+line X',
            '+line Y',
            HUNK_BUTTONS,
            ' middle',
            '-line e',
            '-keep 3',
            '-line f',
            '-keep 4',
            '-',
            '+NEW 1',
            '+NEW 2',
            '+NEW 3',
            '+NEW 4',
            HUNK_BUTTONS,
        ]);
    await expect(fileEditor(page).locator('.cm-hunk-deleted-line')).toHaveCount(
        8
    );
    await expect(fileEditorAddedLines(page)).toHaveCount(6);
    await expect(fileEditor(page).locator('.cm-hunk-controls')).toHaveCount(2);
    // замена это правка файла, а не удаление строк: красной пометки в дереве нет
    await expect(
        page.locator('.tree-row-file--hunk-modified', { hasText: AGENT_FILE })
    ).toBeVisible();
    await expect(page.locator('.tree-row-file--hunk-deleted')).toHaveCount(0);
});

test('hunk-replace-in-file-accept-keeps-new-text', async ({ page }) => {
    const flags = recordHunkDeletes(page);
    const { file, deletes } = await openFileEditedByAgent(
        page,
        SINGLE_REPLACE_FILE_EDIT
    );

    await clickAndWaitForFileReload(
        page,
        file,
        fileEditor(page).locator('.cm-hunk-btn--accept')
    );

    await expect(fileEditorLines(page)).toHaveText(
        SINGLE_REPLACE_FILE_EDIT.after.split('\n')
    );
    await expect(fileEditorAddedLines(page)).toHaveCount(0);
    await expect(fileEditor(page).locator('.cm-hunk-deleted-line')).toHaveCount(
        0
    );
    expect(deletes).toEqual([
        { hunkId: 'hunk-file-replace-single', revert: false },
    ]);
    expect(flags).toEqual([
        { hunkId: 'hunk-file-replace-single', revert: 'false' },
    ]);
    await expect(page.locator('.tree-row-file--has-hunks')).toHaveCount(0);
});

test('hunk-replace-in-file-revert-restores-old-text', async ({ page }) => {
    const flags = recordHunkDeletes(page);
    const { file, deletes } = await openFileEditedByAgent(
        page,
        SINGLE_REPLACE_FILE_EDIT
    );

    await clickAndWaitForFileReload(
        page,
        file,
        fileEditor(page).locator('.cm-hunk-btn--revert')
    );

    await expect(fileEditorLines(page)).toHaveText(
        SINGLE_REPLACE_FILE_EDIT.before.split('\n')
    );
    await expect(fileEditorAddedLines(page)).toHaveCount(0);
    await expect(fileEditor(page).locator('.cm-hunk-deleted-line')).toHaveCount(
        0
    );
    expect(deletes).toEqual([
        { hunkId: 'hunk-file-replace-single', revert: true },
    ]);
    expect(flags).toEqual([
        { hunkId: 'hunk-file-replace-single', revert: 'true' },
    ]);
    await expect(page.locator('.tree-row-file--has-hunks')).toHaveCount(0);
});

// WebKit не знает overflow-clip-margin: хост нулевой высоты обрезал кнопки целиком, и в Safari правку было нечем принять
const HUNK_BUTTON_VIEWPORTS = [
    { width: 1360, height: 900 },
    { width: 390, height: 844 },
];

const SEGMENT_EDITS = {
    add: {
        program: programOf(mdSegment(1, 'intro\nadded line\nomega')),
        hunks: [
            {
                id: 'hunk-segment-add',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 2,
                text: 'added line',
            },
        ] satisfies Hunk[],
    },
    replace: {
        program: programOf(mdSegment(1, 'intro\nRow one.\nRow two.\nomega')),
        hunks: [
            {
                id: 'hunk-segment-replace',
                type: 'replaceTextInSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 3,
                text: 'Old line.',
            },
        ] satisfies Hunk[],
    },
};

const FILE_EDITS = {
    add: SINGLE_AGENT_EDIT,
    replace: SINGLE_REPLACE_FILE_EDIT,
};

/** Что получит касание в центре кнопки и чуть левее неё: обрезку предком toBeVisible не замечает */
async function hitAroundButton(button: Locator) {
    await button.scrollIntoViewIfNeeded();
    return button.evaluate((target) => {
        const rect = target.getBoundingClientRect();
        const y = rect.top + rect.height / 2;
        const describe = (hit: Element | null) => {
            if (hit === null) {
                return 'nothing';
            }
            if (target.contains(hit)) {
                return 'button';
            }
            return hit.closest('.cm-line') ? 'line' : hit.className;
        };
        return {
            center: describe(
                document.elementFromPoint(rect.left + rect.width / 2, y)
            ),
            left: describe(document.elementFromPoint(rect.left - 8, y)),
        };
    });
}

for (const viewport of HUNK_BUTTON_VIEWPORTS) {
    for (const place of ['segment', 'file'] as const) {
        for (const kind of ['add', 'replace'] as const) {
            test(`hunk-buttons-take-the-click-${place}-${kind}-${viewport.width}`, async ({
                page,
            }) => {
                const flags = recordHunkDeletes(page);
                await page.setViewportSize(viewport);
                let editor: Locator;
                let hunkId: string;
                if (place === 'segment') {
                    await openProjectWithHunks(page, SEGMENT_EDITS[kind]);
                    editor = page.locator('#ide-segment-0');
                    hunkId = SEGMENT_EDITS[kind].hunks[0].id;
                } else {
                    await openFileEditedByAgent(page, FILE_EDITS[kind]);
                    editor = fileEditor(page);
                    hunkId = FILE_EDITS[kind].hunks[0].id;
                }
                const accept = editor.locator('.cm-hunk-btn--accept');
                const revert = editor.locator('.cm-hunk-btn--revert');
                await expect(accept).toBeVisible();

                // строка под кнопками остаётся строкой: левее кнопок касание ставит курсор
                expect(await hitAroundButton(accept)).toEqual({
                    center: 'button',
                    left: 'line',
                });
                expect((await hitAroundButton(revert)).center).toBe('button');

                // на телефоне жмём откат, на широком экране приём: так каждая кнопка нажата в каждом месте
                const revertFlag = isPhoneLayout(page);
                const box = await (revertFlag ? revert : accept).boundingBox();
                await page.mouse.click(
                    box!.x + box!.width / 2,
                    box!.y + box!.height / 2
                );
                await expect
                    .poll(() => flags)
                    .toEqual([{ hunkId, revert: String(revertFlag) }]);
            });
        }
    }
}

for (const viewport of HUNK_BUTTON_VIEWPORTS) {
    test(`hunk-buttons-at-segment-end-do-not-scroll-the-segment-${viewport.width}`, async ({
        page,
    }) => {
        await page.setViewportSize(viewport);
        await openProjectWithHunks(page, {
            program: programOf(
                mdSegment(1, 'intro\nadded end'),
                mdSegment(2, 'intro\nNew end.')
            ),
            hunks: [
                {
                    id: 'hunk-add-end',
                    type: 'addLinesToSegment',
                    segmentId: 1,
                    startLine: 2,
                    endLine: 2,
                    text: 'added end',
                },
                {
                    id: 'hunk-replace-end',
                    type: 'replaceTextInSegment',
                    segmentId: 2,
                    startLine: 2,
                    endLine: 2,
                    text: 'Old end.',
                },
            ],
        });
        for (const segment of ['#ide-segment-0', '#ide-segment-1']) {
            const editor = page.locator(segment);
            await expect(editor.locator('.cm-hunk-btn--accept')).toBeVisible();
            // кнопки у последней строки стоят на пустой строке после неё и не выходят за текст, иначе у сегмента появилась бы своя прокрутка
            const layout = await editor.evaluate((root) => {
                const scroller = root.querySelector('.cm-scroller')!;
                const content = root.querySelector('.cm-content')!;
                const buttons = [...root.querySelectorAll('.cm-hunk-btn')];
                return {
                    buttonsInsideText: buttons.every(
                        (button) =>
                            button.getBoundingClientRect().bottom <=
                            content.getBoundingClientRect().bottom
                    ),
                    extraScroll: scroller.scrollHeight - scroller.clientHeight,
                };
            });
            expect(layout).toEqual({ buttonsInsideText: true, extraScroll: 0 });
        }
    });
}
