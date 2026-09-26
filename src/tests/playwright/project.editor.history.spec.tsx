import { expect, test, type Page } from '@playwright/test';
import { Hunk, Program, Segment } from '../../model/domain.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

// react-hotkeys-hook узнаёт Mac по userAgent, а у Desktop Chrome он от Windows
const MAC_USER_AGENT =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

// интервал автоповтора зажатой клавиши в системе
const KEY_REPEAT_MS = 35;

test.use({
    viewport: { width: 1280, height: 900 },
});

const agentHunk: Hunk = {
    id: 'hunk-1',
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 1,
    endLine: 1,
    text: 'AI line',
};

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

const segments = (page: Page) =>
    page.locator('.segments-container .cm-content');
// кнопки hunk рисуются внутри редактора, поэтому текст сегмента берём только из строк
const segmentTexts = (page: Page) =>
    segments(page).evaluateAll((contents) =>
        contents.map((content) =>
            Array.from(
                content.querySelectorAll('.cm-line'),
                (line) => line.textContent ?? ''
            ).join('\n')
        )
    );
const undoButton = (page: Page) => page.locator('.history-button.revert');
const redoButton = (page: Page) => page.locator('.history-button:not(.revert)');

/** Отдаёт тексты сегментов из каждого запроса сохранения программы, по порядку */
async function openProject(
    page: Page,
    program: Program,
    extra?: (routeSetup: RouteSetup) => Promise<unknown>
): Promise<string[][]> {
    // всё, что не на локальном сервере, режем: тесту не нужны ни production, ни Sentry
    await page.route(
        (url) =>
            url.protocol.startsWith('http') && url.hostname !== 'localhost',
        (route) => route.abort()
    );
    const saved: string[][] = [];
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest(200, 'empty', (route) => {
        const body = route.request().postDataJSON() as Program;
        saved.push(body.segments.map((segment) => segment.text));
    });
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);
    await extra?.(routeSetup);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await segments(page).first().waitFor({ state: 'visible' });
    return saved;
}

async function expectSavedSince(
    saved: string[][],
    from: number,
    expected: string[]
) {
    await expect
        .poll(() =>
            saved
                .slice(from)
                .some(
                    (texts) =>
                        JSON.stringify(texts) === JSON.stringify(expected)
                )
        )
        .toBe(true);
}

// сохранение ставит границу шага: без его ожидания следующее нажатие проскочило бы до неё
async function step(
    page: Page,
    saved: string[][],
    action: () => Promise<void>,
    expected: string[]
) {
    const from = saved.length;
    await action();
    await expect.poll(() => segmentTexts(page)).toEqual(expected);
    await expectSavedSince(saved, from, expected);
}

async function placeCursorAtEnd(page: Page, segmentIndex: number) {
    await segments(page).nth(segmentIndex).click();
    await page.keyboard.press('End');
}

const redoVariants = [
    { name: 'ctrl-y', mac: false, undo: 'Control+z', redo: 'Control+y' },
    {
        name: 'ctrl-shift-z',
        mac: false,
        undo: 'Control+z',
        redo: 'Control+Shift+z',
    },
    { name: 'button', mac: false, undo: 'Control+z', redo: 'button' },
    {
        name: 'mac-cmd-shift-z',
        mac: true,
        undo: 'Meta+z',
        redo: 'Meta+Shift+z',
    },
    { name: 'mac-ctrl-y', mac: true, undo: 'Meta+z', redo: 'Control+y' },
];

for (const variant of redoVariants) {
    test.describe(variant.name, () => {
        if (variant.mac) {
            test.use({ userAgent: MAC_USER_AGENT });
        }

        test(`redo-walks-whole-history-${variant.name}`, async ({ page }) => {
            const saved = await openProject(
                page,
                programOf(mdSegment(1, 'start'))
            );
            const states = [
                'start',
                'start one',
                'start one two',
                'start one two three',
            ];
            await placeCursorAtEnd(page, 0);
            for (let i = 1; i < states.length; i++) {
                await step(
                    page,
                    saved,
                    // одним вводом: автосохранение посреди набора на медленной машине поставило бы границу внутри шага
                    () =>
                        page.keyboard.insertText(
                            states[i].slice(states[i - 1].length)
                        ),
                    [states[i]]
                );
            }
            for (let i = states.length - 2; i >= 0; i--) {
                await step(
                    page,
                    saved,
                    () => page.keyboard.press(variant.undo),
                    [states[i]]
                );
            }

            for (let i = 1; i < states.length; i++) {
                await step(
                    page,
                    saved,
                    () =>
                        variant.redo === 'button'
                            ? redoButton(page).click()
                            : page.keyboard.press(variant.redo),
                    [states[i]]
                );
                if (i < states.length - 1) {
                    await expect(redoButton(page)).not.toHaveClass(/disabled/);
                } else {
                    await expect(redoButton(page)).toHaveClass(/disabled/);
                }
            }
        });
    });
}

test('held-ctrl-y-walks-whole-redo-history', async ({ page }) => {
    const saved = await openProject(page, programOf(mdSegment(1, 's')));
    await placeCursorAtEnd(page, 0);
    for (const text of ['s1', 's12', 's123', 's1234']) {
        await step(page, saved, () => page.keyboard.type(text.slice(-1)), [
            text,
        ]);
    }
    for (const text of ['s123', 's12', 's1', 's']) {
        await step(page, saved, () => page.keyboard.press('Control+z'), [text]);
    }

    const from = saved.length;
    // зажатая клавиша: система шлёт keydown с repeat без keyup, и каждый повтор сразу сохраняет программу
    await page.keyboard.down('Control');
    for (let i = 0; i < 6; i++) {
        await page.keyboard.down('y');
        await page.waitForTimeout(KEY_REPEAT_MS);
    }
    await page.keyboard.up('y');
    await page.keyboard.up('Control');

    await expect.poll(() => segmentTexts(page)).toEqual(['s1234']);
    await expect(redoButton(page)).toHaveClass(/disabled/);
    await expectSavedSince(saved, from, ['s1234']);
});

test('redo-returns-structural-steps', async ({ page }) => {
    const saved = await openProject(
        page,
        programOf(
            mdSegment(1, 'aaaa'),
            mdSegment(2, 'bbbb'),
            mdSegment(3, 'cccc')
        )
    );
    const containers = page.locator('.segment-editor-container');
    const states = [
        ['aaaa', 'bbbb', 'cccc'],
        ['bbbb', 'aaaa', 'cccc'],
        ['bbbb', 'aaaa'],
        ['bbbb', 'aaaa', ''],
    ];
    await step(
        page,
        saved,
        () =>
            containers.nth(0).locator('.change-position-button.rotate').click(),
        states[1]
    );
    await step(
        page,
        saved,
        async () => {
            await containers.nth(2).locator('.dropdown-menu-container').click();
            await page.getByText('Delete').last().click();
        },
        states[2]
    );
    // меню сегмента после удаления само не закрывается
    await page.keyboard.press('Escape');
    await step(
        page,
        saved,
        async () => {
            await page
                .locator('.labkeeper_select.computation .select-header')
                .first()
                .click();
            await page
                .getByRole('listitem')
                .filter({ hasText: /^Markdown$/i })
                .click();
        },
        states[3]
    );

    for (let i = states.length - 2; i >= 0; i--) {
        await step(
            page,
            saved,
            () => page.keyboard.press('Control+z'),
            states[i]
        );
    }
    for (let i = 1; i < states.length; i++) {
        await step(
            page,
            saved,
            () => page.keyboard.press('Control+y'),
            states[i]
        );
    }
    await expect(redoButton(page)).toHaveClass(/disabled/);
});

test('redo-after-quick-edits-in-two-segments', async ({ page }) => {
    const saved = await openProject(
        page,
        programOf(mdSegment(1, 'A'), mdSegment(2, 'B'))
    );
    // обе правки успевают до таймера сохранения, и граница шага у них одна на двоих
    await step(
        page,
        saved,
        async () => {
            await placeCursorAtEnd(page, 0);
            await page.keyboard.type('x');
            await placeCursorAtEnd(page, 1);
            await page.keyboard.type('y');
        },
        ['Ax', 'By']
    );

    await step(page, saved, () => page.keyboard.press('Control+z'), [
        'Ax',
        'B',
    ]);
    await step(page, saved, () => page.keyboard.press('Control+z'), ['A', 'B']);
    await step(page, saved, () => page.keyboard.press('Control+y'), [
        'Ax',
        'B',
    ]);
    await step(page, saved, () => page.keyboard.press('Control+y'), [
        'Ax',
        'By',
    ]);
});

test('undo-and-redo-work-with-hunks', async ({ page }) => {
    const hunkDeletes: string[] = [];
    page.on('request', (request) => {
        if (request.method() === 'DELETE' && request.url().includes('/hunk/')) {
            hunkDeletes.push(request.url());
        }
    });
    const saved = await openProject(
        page,
        programOf(mdSegment(1, 'AI line'), mdSegment(2, 'y')),
        (routeSetup) => routeSetup.setupHunkRequestsWithState([agentHunk])
    );
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(1);
    await placeCursorAtEnd(page, 1);
    for (const text of ['y1', 'y12', 'y123']) {
        await step(page, saved, () => page.keyboard.type(text.slice(-1)), [
            'AI line',
            text,
        ]);
    }
    // правка в другом сегменте чужой hunk не принимает
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(1);

    for (const text of ['y12', 'y1', 'y']) {
        await step(page, saved, () => page.keyboard.press('Control+z'), [
            'AI line',
            text,
        ]);
    }
    // undo принимает hunks, а не откатывает их
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(0);
    expect(hunkDeletes).toHaveLength(1);
    expect(hunkDeletes[0]).not.toContain('revert=true');

    for (const text of ['y1', 'y12', 'y123']) {
        await step(page, saved, () => page.keyboard.press('Control+y'), [
            'AI line',
            text,
        ]);
    }
    await expect(redoButton(page)).toHaveClass(/disabled/);
});

test('hunk-revert-still-works-after-edits', async ({ page }) => {
    const hunkDeletes: string[] = [];
    let projectLoads = 0;
    page.on('request', (request) => {
        if (request.method() === 'DELETE' && request.url().includes('/hunk/')) {
            hunkDeletes.push(request.url());
        }
        if (request.url().includes(`/project/${uuid}/get`)) {
            projectLoads += 1;
        }
    });
    const saved = await openProject(
        page,
        programOf(mdSegment(1, 'AI line'), mdSegment(2, 'y')),
        (routeSetup) => routeSetup.setupHunkRequestsWithState([agentHunk])
    );
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(1);
    await placeCursorAtEnd(page, 1);
    await step(page, saved, () => page.keyboard.type('1'), ['AI line', 'y1']);
    await expect(undoButton(page)).not.toHaveClass(/disabled/);
    const loadsBeforeRevert = projectLoads;

    await page.locator('.cm-hunk-btn--revert').first().click();

    await expect.poll(() => hunkDeletes).toHaveLength(1);
    expect(hunkDeletes[0]).toContain('revert=true');
    await expect(page.locator('.cm-hunk-added-line')).toHaveCount(0);
    await expect.poll(() => projectLoads).toBeGreaterThan(loadsBeforeRevert);
    // программа перечитана с сервера, прежняя история к ней не относится
    await expect(undoButton(page)).toHaveClass(/disabled/);
});
