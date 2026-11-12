import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import {
    AgentHistoryEntry,
    Hunk,
    Program,
    Project,
} from '../../model/domain.ts';

/**
 * GH-256: гость поработал с агентом и вошёл. Программа гостя становится
 * проектом, а вместе с ней в проект переезжают правки агента и переписка
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

const AGENT_PROGRAM: Program = {
    segments: [
        {
            id: 1,
            type: 'md',
            text: 'Вступление\nСтрока от агента',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' },
};

const AGENT_HUNK: Hunk = {
    id: 'guest-hunk-1',
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 2,
    endLine: 2,
    text: 'Строка от агента',
};

type DefaultProjectBody = {
    program: Program;
    hunks?: Hunk[];
    history?: AgentHistoryEntry[];
};

const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');

/**
 * Сервер: user-info отвечает гостем, пока опыт не «впустит» его. Проект по
 * умолчанию создаётся из присланной программы, а его правки и история это
 * присланные гостем, как их сохранил бы настоящий сервер
 */
async function setupServer(page: Page) {
    const state = {
        authenticated: false,
        posted: [] as DefaultProjectBody[],
    };
    const routeSetup = new RouteSetup(page);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentSocket([
        {
            type: 'agentFinishedUnauthorized',
            message: 'Добавил строку',
            stopReason: 'Done',
            program: AGENT_PROGRAM,
            hunks: [AGENT_HUNK],
            contextTokens: 1200,
            maxContextTokens: 100000,
        },
    ]);
    await page.route('**/api/v4/public/user-info**', (route) =>
        route.fulfill({
            json: {
                isAuthenticated: state.authenticated,
                email: state.authenticated ? 'a@gmail.com' : '',
                id: state.authenticated ? 111 : -1,
                privacyPolicyAccepted: state.authenticated,
                crossBorderDataTransferPolicyAccepted: true,
                tokenBalance: 0,
            },
        })
    );
    const project = (): Project => ({
        projectId: uuid,
        userId: 111,
        title: 'Default Project',
        lastModified: new Date().toISOString(),
        isPublic: false,
        projectType: 'markdown',
        program: state.posted.at(-1)?.program ?? AGENT_PROGRAM,
    });
    await page.route('**/api/v4/public/project/default**', async (route) => {
        state.posted.push(route.request().postDataJSON());
        await route.fulfill({ json: project() });
    });
    await page.route(`**/api/v4/public/project/${uuid}`, (route) =>
        route.fulfill({ json: project() })
    );
    await page.route(`**/api/v4/public/project/${uuid}/hunk`, (route) =>
        route.fulfill({
            json: {
                hunks: (state.posted.at(-1)?.hunks ?? []).map((hunk) => ({
                    ...hunk,
                    id: `server-${hunk.id}`,
                })),
            },
        })
    );
    await page.route(`**/api/v4/public/project/${uuid}/history`, (route) =>
        route.fulfill({
            json: {
                history: (state.posted.at(-1)?.history ?? []).map(
                    (entry, index) => ({
                        ...entry,
                        id: `0000000${index}-0000-4000-8000-000000000000`,
                    })
                ),
            },
        })
    );
    return state;
}

const persisted = (page: Page) =>
    page.evaluate(() => {
        const raw = window.localStorage.getItem('persist:PERSISTENCE');
        const slice = raw ? (JSON.parse(raw) as Record<string, string>) : {};
        return {
            hunks: JSON.parse(slice.guestAgentHunks ?? '[]') as Hunk[],
            history: JSON.parse(
                slice.guestAgentHistory ?? '[]'
            ) as AgentHistoryEntry[],
        };
    });

test('guest-agent-changes-and-chat-move-into-the-project-after-sign-in', async ({
    page,
}) => {
    const server = await setupServer(page);
    await page.goto('/project/default');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await promptField(page).fill('добавь строку');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'Добавил строку'
    );
    // правка и прогон гостя пережили бы и перезагрузку, и уход на OAuth
    await expect
        .poll(async () => (await persisted(page)).hunks)
        .toEqual([AGENT_HUNK]);

    // вход: OAuth возвращает человека на главную, и приложение стартует заново
    server.authenticated = true;
    await page.goto('/');

    await expect.poll(() => server.posted.length).toBe(1);
    const [body] = server.posted;
    expect(body.program.segments.map((segment) => segment.text)).toEqual([
        'Вступление\nСтрока от агента',
    ]);
    expect(body.hunks).toEqual([AGENT_HUNK]);
    expect(body.history).toEqual([
        {
            id: expect.stringMatching(/^[0-9a-f-]{36}$/),
            request: 'добавь строку',
            response: 'Добавил строку',
            createdAt: expect.any(String),
            contextTokens: 1200,
            maxContextTokens: 100000,
        },
    ]);

    // в проекте правка агента с кнопками, а в чате прежняя переписка
    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(
        page.locator('.segment-editor-container .cm-hunk-btn--accept')
    ).toBeVisible();
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect(page.locator('.agent-chat__transcript')).toContainText(
        'добавь строку'
    );
    await expect(page.locator('.agent-chat__transcript')).toContainText(
        'Добавил строку'
    );
    // перенесено один раз: следующий вход их уже не пришлёт
    expect(await persisted(page)).toEqual({ hunks: [], history: [] });
});

test('a-failed-guest-run-does-not-reach-the-project-history', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentSocket([
        {
            type: 'agentFinishedUnauthorized',
            message: null,
            stopReason: 'UnauthorizedLimitExceeded',
        },
    ]);
    await page.goto('/project/default');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await promptField(page).fill('добавь строку');
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(page.locator('.agent-chat__error').first()).toBeVisible();

    expect((await persisted(page)).history).toEqual([]);
});
