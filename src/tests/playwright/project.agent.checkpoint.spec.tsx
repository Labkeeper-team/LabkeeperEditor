import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { AgentHistoryEntry, Hunk } from '../../model/domain.ts';

/**
 * GH-189: откат и приём правок в агентском режиме. Сервер замокан с
 * состоянием: прогон агента кладёт ханк и запись истории, DELETE их убирает
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

type Frame = Record<string, unknown>;

const OLD_ENTRY: AgentHistoryEntry = {
    id: 'old',
    request: 'старый запрос',
    response: 'старый ответ',
    createdAt: '2026-10-20T10:00:00Z',
};

const GUEST_PROGRAM = {
    segments: [{ id: 1, type: 'md', text: 'новая строка', parameters: {} }],
    parameters: { roundStrategy: 'noRound' },
};

const hunk = (id: string): Hunk => ({
    id,
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 1,
    endLine: 1,
});

type Server = {
    hunks: Hunk[];
    history: AgentHistoryEntry[];
    hunkDeletes: { id: string; revert: boolean }[];
    entryDeletes: string[];
    starts: number;
};

/** Прогон агента: что он оставит на сервере и какой ответ пришлёт */
type Run = { hunkId?: string; entryId?: string; answer?: string };

async function openAgentMode(
    page: Page,
    {
        runs = [],
        hunks = [],
        history = [OLD_ENTRY],
        authenticated = true,
        path = `/project/${uuid}/agent`,
    }: {
        runs?: Run[];
        hunks?: Hunk[];
        history?: AgentHistoryEntry[];
        authenticated?: boolean;
        path?: string;
    } = {}
): Promise<Server> {
    const server: Server = {
        hunks: [...hunks],
        history: [...history],
        hunkDeletes: [],
        entryDeletes: [],
        starts: 0,
    };
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(authenticated);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');

    await page.route(`**/api/v4/public/project/${uuid}/hunk`, (route) =>
        route.fulfill({ json: { hunks: server.hunks } })
    );
    await page.route(`**/api/v4/public/project/${uuid}/hunk/*`, (route) => {
        const url = new URL(route.request().url());
        const id = url.pathname.split('/').pop() ?? '';
        server.hunkDeletes.push({
            id,
            revert: url.searchParams.get('revert') === 'true',
        });
        server.hunks = server.hunks.filter((h) => h.id !== id);
        return route.fulfill({ json: {} });
    });
    await page.route(`**/api/v4/public/project/${uuid}/history`, (route) =>
        route.fulfill({ json: { history: server.history } })
    );
    await page.route(`**/api/v4/public/project/${uuid}/history/*`, (route) => {
        const id = new URL(route.request().url()).pathname.split('/').pop()!;
        server.entryDeletes.push(id);
        server.history = server.history.filter((e) => e.id !== id);
        return route.fulfill({ json: {} });
    });
    await page.routeWebSocket('**/api/v4/ws/**', (ws) => {
        ws.onMessage((message) => {
            const start = JSON.parse(String(message)) as { prompt: string };
            const run = runs[server.starts] ?? {};
            server.starts += 1;
            // агент правит проект по ходу прогона, а запись истории сервер пишет в конце
            if (run.hunkId) {
                server.hunks = [...server.hunks, hunk(run.hunkId)];
            }
            const frames: Frame[] = [
                { type: 'toolCall', toolName: 'add_lines_to_segment' },
            ];
            if (run.entryId) {
                server.history = [
                    ...server.history,
                    {
                        id: run.entryId,
                        request: start.prompt,
                        response: run.answer ?? 'готово',
                        createdAt: new Date(
                            Date.parse('2026-10-21T10:00:00Z') +
                                server.starts * 60_000
                        ).toISOString(),
                    },
                ];
            }
            frames.push(
                authenticated
                    ? {
                          type: 'agentFinished',
                          message: run.answer ?? 'готово',
                          stopReason: 'Done',
                      }
                    : {
                          // гостю программа и ханки приезжают в финале
                          type: 'agentFinishedUnauthorized',
                          message: run.answer ?? 'готово',
                          stopReason: 'Done',
                          program: GUEST_PROGRAM,
                          hunks: run.hunkId ? [hunk(run.hunkId)] : [],
                      }
            );
            for (const frame of frames) {
                ws.send(JSON.stringify(frame));
            }
        });
    });

    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
    return server;
}

const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');

async function submitPrompt(page: Page, text: string) {
    const answers = page.locator('.agent-chat__response-text');
    const before = await answers.count();
    await promptField(page).fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
    // прогон кончился: ответ в ленте, а после него перечитана история
    await expect(answers).toHaveCount(before + 1);
}

const checkpoint = (page: Page) =>
    page.getByRole('group', { name: 'Agent changes' });
const revertButton = (page: Page) =>
    checkpoint(page).getByRole('button', { name: /^Revert/ });
const acceptButton = (page: Page) =>
    checkpoint(page).getByRole('button', { name: 'Accept' });

async function setCheckpointMode(
    page: Page,
    mode: 'Last request' | 'Several requests'
) {
    await page.getByRole('button', { name: 'Agent settings' }).click();
    await page
        .getByRole('group', { name: 'Reverting changes' })
        .getByRole('button', { name: mode })
        .click();
    await page.getByRole('button', { name: 'Close settings' }).click();
}

test('finished-run-is-framed-with-revert-and-accept', async ({ page }) => {
    await openAgentMode(page, { runs: [{ hunkId: 'h1', entryId: 'e1' }] });
    // до правок рамки нет
    await expect(checkpoint(page)).toHaveCount(0);

    await submitPrompt(page, 'добавь строку');

    await expect(checkpoint(page)).toBeVisible();
    // в рамке только новый прогон, старая запись выше неё
    await expect(
        checkpoint(page).locator('.agent-chat__request-text')
    ).toHaveText(['добавь строку']);
    await expect(revertButton(page)).toHaveText('Revert 1 request');
    await expect(acceptButton(page)).toBeVisible();
    await expect(checkpoint(page)).toContainText('Total 1 changes');
    // запись истории привязана к запросу ленты и второй раз не рисуется
    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
        'добавь строку',
    ]);
});

test('steps-collapse-right-after-the-run', async ({ page }) => {
    await openAgentMode(page, { runs: [{ hunkId: 'h1', entryId: 'e1' }] });

    await submitPrompt(page, 'добавь строку');

    await expect(page.locator('.agent-chat__response-text')).toHaveText([
        'старый ответ',
        'готово',
    ]);
    const toggle = page.locator('.agent-chat__steps-toggle');
    await expect(toggle).toHaveText('Agent steps: 1');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.agent-chat__event')).toHaveCount(0);
});

test('revert-asks-then-undoes-changes-and-removes-the-request', async ({
    page,
}) => {
    const server = await openAgentMode(page, {
        runs: [{ hunkId: 'h1', entryId: 'e1' }],
    });
    await submitPrompt(page, 'добавь строку');

    await revertButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Revert the changes?' });
    await expect(dialog).toContainText(
        'highlighted requests removed from the history'
    );
    await dialog.getByRole('button', { name: 'Revert 1 request' }).click();

    await expect(checkpoint(page)).toHaveCount(0);
    await expect
        .poll(() => server.hunkDeletes)
        .toEqual([{ id: 'h1', revert: true }]);
    await expect.poll(() => server.entryDeletes).toEqual(['e1']);
    // в ленте осталось то, что было до прогона
    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
    ]);
});

test('cancel-in-the-dialog-keeps-everything', async ({ page }) => {
    const server = await openAgentMode(page, {
        runs: [{ hunkId: 'h1', entryId: 'e1' }],
    });
    await submitPrompt(page, 'добавь строку');

    await revertButton(page).click();
    await page
        .getByRole('dialog', { name: 'Revert the changes?' })
        .getByRole('button', { name: 'Cancel' })
        .click();

    await expect(checkpoint(page)).toBeVisible();
    await expect.poll(() => server.hunkDeletes).toEqual([]);
    await expect.poll(() => server.entryDeletes).toEqual([]);
});

test('accept-keeps-the-history-and-drops-the-frame', async ({ page }) => {
    const server = await openAgentMode(page, {
        runs: [{ hunkId: 'h1', entryId: 'e1' }],
    });
    await submitPrompt(page, 'добавь строку');

    await acceptButton(page).click();

    await expect(checkpoint(page)).toHaveCount(0);
    await expect
        .poll(() => server.hunkDeletes)
        .toEqual([{ id: 'h1', revert: false }]);
    await expect.poll(() => server.entryDeletes).toEqual([]);
    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
        'добавь строку',
    ]);
});

test('last-mode-accepts-previous-changes-before-a-new-request', async ({
    page,
}) => {
    const server = await openAgentMode(page, {
        runs: [
            { hunkId: 'h1', entryId: 'e1' },
            { hunkId: 'h2', entryId: 'e2' },
        ],
    });
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');

    // правка первого прогона принята до старта второго
    await expect
        .poll(() => server.hunkDeletes)
        .toEqual([{ id: 'h1', revert: false }]);
    await expect(
        checkpoint(page).locator('.agent-chat__request-text')
    ).toHaveText(['второй']);
    await expect(revertButton(page)).toHaveText('Revert 1 request');

    await revertButton(page).click();
    await page
        .getByRole('dialog', { name: 'Revert the changes?' })
        .getByRole('button', { name: 'Revert 1 request' })
        .click();
    await expect(checkpoint(page)).toHaveCount(0);
    await expect.poll(() => server.entryDeletes).toEqual(['e2']);
    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
        'первый',
    ]);
});

test('range-mode-frames-every-request-since-there-were-no-changes', async ({
    page,
}) => {
    const server = await openAgentMode(page, {
        runs: [
            { hunkId: 'h1', entryId: 'e1' },
            { hunkId: 'h2', entryId: 'e2' },
        ],
    });
    await setCheckpointMode(page, 'Several requests');
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');

    await expect.poll(() => server.hunkDeletes).toEqual([]);
    await expect(
        checkpoint(page).locator('.agent-chat__request-text')
    ).toHaveText(['первый', 'второй']);
    await expect(revertButton(page)).toHaveText('Revert 2 requests');
    await expect(checkpoint(page)).toContainText('Total 2 changes');

    await revertButton(page).click();
    await page
        .getByRole('dialog', { name: 'Revert the changes?' })
        .getByRole('button', { name: 'Revert 2 requests' })
        .click();

    await expect(checkpoint(page)).toHaveCount(0);
    await expect
        .poll(() => server.hunkDeletes)
        .toEqual([
            { id: 'h1', revert: true },
            { id: 'h2', revert: true },
        ]);
    await expect.poll(() => server.entryDeletes).toEqual(['e1', 'e2']);
    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
    ]);
});

test('range-survives-a-reload', async ({ page }) => {
    await openAgentMode(page, {
        runs: [
            { hunkId: 'h1', entryId: 'e1' },
            { hunkId: 'h2', entryId: 'e2' },
        ],
    });
    await setCheckpointMode(page, 'Several requests');
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');

    await page.reload();

    // после перезагрузки обе записи пришли из истории, а граница из localStorage
    await expect(
        checkpoint(page).locator('.agent-chat__request-text')
    ).toHaveText(['первый', 'второй']);
    await expect(revertButton(page)).toHaveText('Revert 2 requests');
    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
        'первый',
        'второй',
    ]);
});

test('changes-without-a-known-run-still-get-buttons', async ({ page }) => {
    // правки остались, а истории нет: например, её очистили
    const server = await openAgentMode(page, {
        hunks: [hunk('h1')],
        history: [],
    });

    await expect(checkpoint(page)).toBeVisible();
    await expect(revertButton(page)).toHaveText('Revert changes');
    await revertButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Revert the changes?' });
    await expect(dialog).toContainText(
        'The agent changes in the document will be undone. This cannot be undone'
    );
    await dialog.getByRole('button', { name: 'Revert changes' }).click();

    await expect(checkpoint(page)).toHaveCount(0);
    await expect
        .poll(() => server.hunkDeletes)
        .toEqual([{ id: 'h1', revert: true }]);
    await expect.poll(() => server.entryDeletes).toEqual([]);
});

test('dont-ask-again-skips-the-dialog-until-settings-bring-it-back', async ({
    page,
}) => {
    const server = await openAgentMode(page, {
        runs: [
            { hunkId: 'h1', entryId: 'e1' },
            { hunkId: 'h2', entryId: 'e2' },
            { hunkId: 'h3', entryId: 'e3' },
        ],
    });
    await submitPrompt(page, 'первый');
    await revertButton(page).click();
    const dialog = page.getByRole('dialog', { name: 'Revert the changes?' });
    await dialog.getByLabel("Don't ask again").check();
    await dialog.getByRole('button', { name: 'Revert 1 request' }).click();
    await expect(checkpoint(page)).toHaveCount(0);

    // лента после отката пересобрана, и номер нового запроса совпадёт со старым
    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
    ]);
    await submitPrompt(page, 'второй');
    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
        'второй',
    ]);
    await revertButton(page).click();
    await expect(checkpoint(page)).toHaveCount(0);
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => server.entryDeletes).toEqual(['e1', 'e2']);

    // вопрос возвращает галка в настройках
    await page.getByRole('button', { name: 'Agent settings' }).click();
    await page.getByLabel('Ask before reverting').check();
    await page.getByRole('button', { name: 'Close settings' }).click();
    await submitPrompt(page, 'третий');
    await revertButton(page).click();
    await expect(dialog).toBeVisible();
});

test('guest-gets-accept-only', async ({ page }) => {
    await openAgentMode(page, {
        authenticated: false,
        history: [],
        runs: [{ hunkId: 'h1' }],
    });

    await submitPrompt(page, 'добавь строку');

    // гостю откатывать нечем, как и в редакторе: только принять
    await expect(
        checkpoint(page).locator('.agent-chat__request-text')
    ).toHaveText(['добавь строку']);
    await expect(acceptButton(page)).toBeVisible();
    await expect(revertButton(page)).toHaveCount(0);

    await acceptButton(page).click();
    await expect(checkpoint(page)).toHaveCount(0);
});

test('editor-mode-chat-has-no-frame', async ({ page }) => {
    await openAgentMode(page, {
        hunks: [hunk('h1')],
        path: `/project/${uuid}`,
    });
    await page.getByRole('tab', { name: 'AI agent' }).click();

    await expect(page.locator('.agent-chat__request-text')).toHaveText([
        'старый запрос',
    ]);
    await expect(checkpoint(page)).toHaveCount(0);
});

test('checkpoint-mode-survives-a-reload', async ({ page }) => {
    await openAgentMode(page);
    await setCheckpointMode(page, 'Several requests');

    await page.reload();
    await page.getByRole('button', { name: 'Agent settings' }).click();

    await expect(
        page
            .getByRole('group', { name: 'Reverting changes' })
            .getByRole('button', { name: 'Several requests' })
    ).toHaveAttribute('aria-pressed', 'true');
});
