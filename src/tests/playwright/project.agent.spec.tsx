import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { AgentHistoryEntry, Program } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

/** Пустая программа сама по себе гасит кнопку Run, поэтому для замка нужен сегмент */
const RUNNABLE_PROGRAM: Program = {
    segments: [
        {
            id: 1,
            type: 'computational',
            text: 'a = 10',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' },
};

test.use({ viewport: { width: 1360, height: 900 } });

type Frame = Record<string, unknown>;

const finished = (stopReason: string, message: string | null = 'готово') => ({
    type: 'agentFinished',
    message,
    stopReason,
});

const toolCall = (toolName: string) => ({ type: 'toolCall', toolName });

async function openChat(
    page: Page,
    options: {
        frames?: Frame[];
        dropConnection?: boolean;
        history?: AgentHistoryEntry[];
        authenticated?: boolean;
        program?: Program;
    } = {}
) {
    const routeSetup = new RouteSetup(page);
    const authenticated = options.authenticated ?? true;
    await routeSetup.setupGetUserInfoRequest(authenticated);
    await routeSetup.setupGetProjectRequest(200, 'default', options.program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest(options.history ?? []);
    const sent = await routeSetup.setupAgentSocket(options.frames ?? [], {
        dropConnection: options.dropConnection,
    });

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    return sent;
}

async function submitPrompt(page: Page, text = 'сделай таблицу') {
    await page.getByPlaceholder('Enter your promt').fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
}

test('agent-tab-switches-with-pdf', async ({ page }) => {
    await openChat(page);

    await expect(page.locator('.agent-chat')).toBeVisible();
    await expect(page.locator('.result-container')).toBeHidden();

    await page.getByRole('tab', { name: 'PDF visualization' }).click();

    await expect(page.locator('.agent-chat')).toHaveCount(0);
    await expect(page.locator('.result-container')).toBeVisible();
});

test('agent-start-sends-prompt-and-settings', async ({ page }) => {
    const sent = await openChat(page);

    await page
        .getByRole('group', { name: 'Max Iterations' })
        .getByRole('button', { name: '12' })
        .click();
    await submitPrompt(page, 'перепиши введение');

    await expect(page.locator('.agent-chat__request-text')).toHaveText(
        'перепиши введение'
    );
    // кадр уходит уже после отрисовки запроса, поэтому дожидаемся его отдельно
    await expect.poll(() => sent.length).toBe(1);
    expect(sent).toEqual([
        {
            type: 'startAgent',
            prompt: 'перепиши введение',
            numberIterations: 12,
            maxTokens: 10000,
        },
    ]);
});

test('agent-events-render-in-order-with-spinner-on-last', async ({ page }) => {
    await openChat(page, {
        frames: [
            { type: 'modelFinished', totalTokens: 10, elapsedTimeMillis: 5 },
            toolCall('list_workspace'),
            toolCall('read_segment'),
        ],
    });

    await submitPrompt(page);

    const rows = page.locator('.agent-chat__event-label');
    await expect(rows).toHaveText([
        'Calling the model',
        'Reading the project structure',
        'Reading a segment',
    ]);
    // бегунок висит только на последней строке
    const spinners = page.locator('.agent-chat__event .agent-chat__spinner');
    await expect(spinners).toHaveCount(1);
    await expect(
        page
            .locator('.agent-chat__event')
            .last()
            .locator('.agent-chat__spinner')
    ).toBeVisible();
});

test('agent-locks-editor-and-run-while-running', async ({ page }) => {
    await openChat(page, {
        frames: [toolCall('read_segment')],
        program: RUNNABLE_PROGRAM,
    });
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    await expect(page.getByRole('button', { name: /Run/i })).toBeDisabled();

    const editor = page.locator('.cm-content').first();
    const before = await editor.innerText();
    await editor.click();
    await editor.pressSequentially('никуда не попадёт', { delay: 10 });

    expect(await editor.innerText()).toBe(before);
    await expect(page.locator('div.Toastify__toast').first()).toContainText(
        'The project cannot be edited while the agent is running'
    );
});

test('agent-unlocks-after-finish', async ({ page }) => {
    await openChat(page, {
        frames: [finished('Done')],
        program: RUNNABLE_PROGRAM,
    });
    await submitPrompt(page);

    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'готово'
    );
    await expect(page.getByRole('button', { name: /Run/i })).toBeEnabled();
});

test('agent-unlocks-after-drop', async ({ page }) => {
    await openChat(page, { dropConnection: true, program: RUNNABLE_PROGRAM });
    await submitPrompt(page);

    await expect(page.locator('.agent-chat__error-text')).toHaveText(
        'The connection to the agent was lost. Please try again'
    );
    await expect(page.getByRole('button', { name: /Run/i })).toBeEnabled();
});

const ERROR_STOP_REASONS: [string, string][] = [
    ['PaymentRequired', 'You have reached the limit on using the assistant.'],
    [
        'Locked',
        'The agent is already running in another tab, or the project is being changed. Wait for it to finish and try again',
    ],
    ['UnknownError', 'Something went wrong. Please try again'],
];

for (const [stopReason, text] of ERROR_STOP_REASONS) {
    test(`agent-stop-reason-${stopReason}-shows-text`, async ({ page }) => {
        await openChat(page, { frames: [finished(stopReason, null)] });
        await submitPrompt(page);

        await expect(page.locator('.agent-chat__error-text')).toHaveText(text);
    });
}

const PARTIAL_STOP_REASONS: [string, string][] = [
    [
        'IterationLimit',
        'The agent ran out of steps. What it managed to change is already in the project. Try raising the iteration limit or splitting the task',
    ],
    [
        'ContextOverflow',
        'The task did not fit into the context. Shorten the request or raise the context size',
    ],
    [
        'Timeout',
        'The server stopped the agent on time, but it managed to write a result. The changes are already in the project',
    ],
];

for (const [stopReason, text] of PARTIAL_STOP_REASONS) {
    test(`agent-stop-reason-${stopReason}-shows-text`, async ({ page }) => {
        await openChat(page, { frames: [finished(stopReason)] });
        await submitPrompt(page);

        // ответ показываем, а оговорку рядом, и это не ошибка
        await expect(page.locator('.agent-chat__response-text')).toHaveText(
            'готово'
        );
        await expect(page.locator('.agent-chat__notice-text')).toHaveText(text);
        await expect(page.locator('.agent-chat__error-text')).toHaveCount(0);
    });
}

test('agent-stop-reason-Done-shows-text', async ({ page }) => {
    await openChat(page, { frames: [finished('Done')] });
    await submitPrompt(page);

    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'готово'
    );
    await expect(page.locator('.agent-chat__error-text')).toHaveCount(0);
    await expect(page.locator('.agent-chat__notice-text')).toHaveCount(0);
});

test('agent-stop-reason-UnauthorizedLimitExceeded-shows-text', async ({
    page,
}) => {
    await openChat(page, {
        authenticated: false,
        frames: [
            {
                type: 'agentFinishedUnauthorized',
                message: null,
                stopReason: 'UnauthorizedLimitExceeded',
            },
        ],
    });
    await submitPrompt(page);

    await expect(page.locator('.agent-chat__error-text')).toHaveText(
        'You have reached the limit for unregistered users. Sign in to continue'
    );
    // по ТЗ тут же показываем окно входа
    await expect(page.locator('.auth-modal')).toBeVisible();
});

test('chat-column-does-not-break-on-a-narrow-window', async ({ page }) => {
    await openChat(page, { history: [] });

    for (const width of [1280, 1024, 900]) {
        await page.setViewportSize({ width, height: 800 });
        await expect(page.locator('.agent-chat')).toBeVisible();
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
    }
});

test('agent-payment-required-offers-tokens', async ({ page }) => {
    await openChat(page, { frames: [finished('PaymentRequired', null)] });
    await submitPrompt(page);

    await page
        .getByRole('button', { name: 'Proceed to purchase tokens' })
        .click();

    await expect(page).toHaveURL(/\/tokens/);
});

test('agent-history-loads-into-chat', async ({ page }) => {
    await openChat(page, {
        history: [
            {
                id: '1',
                request: 'что тут написано',
                response: 'тут таблица',
                createdAt: '2026-09-08T10:00:00Z',
            },
        ],
    });

    await expect(page.locator('.agent-chat__request-text')).toHaveText(
        'что тут написано'
    );
    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'тут таблица'
    );
});

test('agent-history-clear-empties-chat', async ({ page }) => {
    await openChat(page, {
        history: [
            {
                id: '1',
                request: 'что тут написано',
                response: 'тут таблица',
                createdAt: '2026-09-08T10:00:00Z',
            },
        ],
    });
    await expect(page.locator('.agent-chat__pair')).toHaveCount(1);

    await page.getByRole('button', { name: 'Clear history' }).click();

    await expect(page.locator('.agent-chat__pair')).toHaveCount(0);
    await expect(page.locator('.agent-chat__disclaimer')).toBeVisible();
});

test('agent-tab-is-hidden-on-a-foreign-project', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(
        200,
        'withTwoSegmentsBibaAndAEqualTen'
    );
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');

    // чужой проект менять нельзя, значит и агенту там делать нечего
    await expect(page.getByRole('tab', { name: 'AI agent' })).toHaveCount(0);
    await expect(page.locator('.result-container')).toBeVisible();
});

test('agent-history-clear-hidden-for-unauthorized', async ({ page }) => {
    await openChat(page, { authenticated: false });

    await expect(
        page.getByRole('button', { name: 'Clear history' })
    ).toHaveCount(0);
});

test('unauthorized-agent-applies-returned-program', async ({ page }) => {
    await openChat(page, {
        authenticated: false,
        frames: [
            {
                type: 'agentFinishedUnauthorized',
                message: 'добавил сегмент',
                stopReason: 'Done',
                program: {
                    segments: [
                        {
                            id: 1,
                            type: 'md',
                            text: 'сегмент от агента',
                            parameters: { visible: true },
                        },
                    ],
                    parameters: { roundStrategy: 'noRound' },
                },
                hunks: [],
            },
        ],
    });

    await submitPrompt(page);

    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'добавил сегмент'
    );
    await expect(page.locator('.cm-content').first()).toContainText(
        'сегмент от агента'
    );
});

test('unauthorized-agent-sends-program-with-segment-ids', async ({ page }) => {
    const sent = await openChat(page, {
        authenticated: false,
        program: {
            segments: [
                { type: 'md', text: 'раз', parameters: { visible: true } },
                { type: 'md', text: 'два', parameters: { visible: true } },
            ],
            parameters: { roundStrategy: 'noRound' },
        },
    });

    await submitPrompt(page, 'поправь');

    await expect.poll(() => sent.length).toBe(1);
    const frame = sent[0] as {
        type: string;
        program: { segments: { id: number }[] };
    };
    expect(frame.type).toBe('startAgentUnauthorized');
    expect(frame.program.segments.map((segment) => segment.id)).toEqual([1, 2]);
});

test('compilation-switches-viewer-back-to-pdf', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', RUNNABLE_PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);
    await routeSetup.setupCompileProjectRequest(200, 'defaultMd');

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect(page.locator('.agent-chat')).toBeVisible();

    await page.getByRole('button', { name: /Run/i }).click();

    // ТЗ: после компиляции открывать pdf
    await expect(page.locator('.agent-chat')).toHaveCount(0);
    await expect(page.locator('.result-container')).toBeVisible();
});

test('mobile-chat-tab-is-last', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.mobile-view-switcher-bar__toggle').click();

    const options = page.locator('.mobile-view-switcher-bar__option');
    await expect(options).toHaveText(['Files', 'Editor', 'PDF', 'AI agent']);

    // на мобильном роль переключателя играет этот список, таб-бар в колонке скрыт
    await options.last().click();
    await expect(page.locator('.agent-chat')).toBeVisible();
});

const LEAVE_CONFIRM = 'The agent is still running. Leave the page anyway?';

async function openMyProjects(page: Page) {
    await page.locator('.header-menu-select .select-header').click();
    await page
        .getByRole('listitem')
        .filter({ hasText: /^My projects$/ })
        .click();
}

test('agent-run-warns-before-closing-the-tab', async ({ page }) => {
    await openChat(page, {
        frames: [toolCall('read_segment')],
        program: RUNNABLE_PROGRAM,
    });
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    // тип забираем наружу: упавший expect внутри обработчика оставил бы
    // панель висеть и тест умер бы по таймауту вместо внятного сообщения
    const dialogs: string[] = [];
    page.once('dialog', async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.dismiss();
    });
    await page.evaluate(() => window.location.reload());

    await expect.poll(() => dialogs).toEqual(['beforeunload']);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);
});

test('unauthorized-agent-run-warns-before-closing-the-tab', async ({
    page,
}) => {
    // у гостя несохранённых изменений не бывает по определению селектора,
    // так что панель тут держится только на прогоне
    await openChat(page, {
        frames: [toolCall('read_segment')],
        program: RUNNABLE_PROGRAM,
        authenticated: false,
    });
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    const dialogs: string[] = [];
    page.once('dialog', async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.dismiss();
    });
    await page.evaluate(() => window.location.reload());

    await expect.poll(() => dialogs).toEqual(['beforeunload']);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);
});

test('agent-run-confirms-navigation-inside-the-app', async ({ page }) => {
    await openChat(page, {
        frames: [toolCall('read_segment')],
        program: RUNNABLE_PROGRAM,
    });
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    const messages: string[] = [];
    let leave = false;
    page.on('dialog', async (dialog) => {
        messages.push(dialog.message());
        await (leave ? dialog.accept() : dialog.dismiss());
    });

    await openMyProjects(page);
    await expect.poll(() => messages).toEqual([LEAVE_CONFIRM]);
    // отказ оставляет не только адрес, но и саму страницу нетронутой
    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(page.locator('.cm-content').first()).toBeVisible();
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    leave = true;
    await openMyProjects(page);
    await expect(page).toHaveURL('/projects');
    // ровно по одному вопросу на нажатие, лишних окон нет
    expect(messages).toEqual([LEAVE_CONFIRM, LEAVE_CONFIRM]);
});

test('finished-agent-does-not-block-navigation', async ({ page }) => {
    await openChat(page, {
        frames: [finished('Done')],
        program: RUNNABLE_PROGRAM,
    });
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'готово'
    );

    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.accept();
    });

    // без перезагрузки: она стёрла бы состояние чата и проверять было бы нечего
    await openMyProjects(page);

    await expect(page).toHaveURL('/projects');
    expect(dialogs).toEqual([]);
});

test('finished-agent-does-not-warn-before-closing-the-tab', async ({
    page,
}) => {
    await openChat(page, {
        frames: [finished('Done')],
        program: RUNNABLE_PROGRAM,
    });
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'готово'
    );

    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.accept();
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.cm-content').first()).toBeVisible();

    expect(dialogs).toEqual([]);
});

test('agent-run-confirms-the-back-button', async ({ page }) => {
    await openChat(page, {
        frames: [toolCall('read_segment')],
        program: RUNNABLE_PROGRAM,
    });
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    const messages: string[] = [];
    let leave = false;
    page.on('dialog', async (dialog) => {
        messages.push(dialog.message());
        await (leave ? dialog.accept() : dialog.dismiss());
    });

    const back = page.locator('button.image-button.outline.rotate').first();
    await back.click();

    // отказ не должен ничего сбросить: уход отсюда чистит проект до перехода
    await expect.poll(() => messages).toEqual([LEAVE_CONFIRM]);
    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(page.locator('.cm-content').first()).toBeVisible();
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    leave = true;
    await back.click();

    await expect(page).toHaveURL('/projects');
    // вопрос ровно один на нажатие: к переходу агент уже погашен
    expect(messages).toEqual([LEAVE_CONFIRM, LEAVE_CONFIRM]);
});

test('agent-run-confirms-browser-history-navigation', async ({ page }) => {
    await openChat(page, {
        frames: [toolCall('read_segment')],
        program: RUNNABLE_PROGRAM,
    });
    // нужна запись позади проекта, иначе «назад» уводит с сайта совсем,
    // а это уже другой рубеж и другая панель
    await openMyProjects(page);
    await expect(page).toHaveURL('/projects');
    await page.goBack();
    await expect(page).toHaveURL(`/project/${uuid}`);

    await page.getByRole('tab', { name: 'AI agent' }).click();
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    const messages: string[] = [];
    let leave = false;
    page.on('dialog', async (dialog) => {
        messages.push(dialog.message());
        await (leave ? dialog.accept() : dialog.dismiss());
    });
    await page.goForward();

    await expect.poll(() => messages).toEqual([LEAVE_CONFIRM]);
    // отказ не должен рассинхронить адрес со страницей
    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    // а согласие должно уводить с первого раза, а не обещать и оставлять на месте
    leave = true;
    await page.goForward();
    await expect(page).toHaveURL('/projects');
    expect(messages).toEqual([LEAVE_CONFIRM, LEAVE_CONFIRM]);
});

test('history-entry-with-the-same-address-does-not-ask', async ({ page }) => {
    await openChat(page, {
        frames: [toolCall('read_segment')],
        program: RUNNABLE_PROGRAM,
    });
    await submitPrompt(page);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);

    // приложение кладёт адрес проекта в историю дважды, поэтому первое «назад»
    // ведёт на него же. Спрашивать про уход оттуда, откуда не уходят, нельзя:
    // человек соглашается и остаётся на месте
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.accept();
    });
    await page.goBack();

    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(page.locator('.agent-chat__event')).toHaveCount(1);
    expect(dialogs).toEqual([]);
});

test.describe('русская локаль', () => {
    test.use({ locale: 'ru-RU' });

    test('leave-confirm-comes-from-the-dictionary', async ({ page }) => {
        const routeSetup = new RouteSetup(page);
        await routeSetup.setupGetUserInfoRequest();
        await routeSetup.setupGetProjectRequest(
            200,
            'default',
            RUNNABLE_PROGRAM
        );
        await routeSetup.setupGetAllProjectsRequest();
        await routeSetup.setupSaveProgramRequest();
        await routeSetup.setupListFilesRequest(200, 'emptyFiles');
        await routeSetup.setupAgentHistoryRequest([]);
        await routeSetup.setupAgentSocket([toolCall('read_segment')]);

        await page.goto(`/project/${uuid}`);
        await page.waitForLoadState('domcontentloaded');
        await page.getByRole('tab', { name: 'Агент' }).click();
        await page
            .getByPlaceholder('Опишите, что сделать с проектом')
            .fill('сделай таблицу');
        await page.getByRole('button', { name: 'Отправить' }).click();
        await expect(page.locator('.agent-chat__event')).toHaveCount(1);

        const messages: string[] = [];
        page.on('dialog', async (dialog) => {
            messages.push(dialog.message());
            await dialog.dismiss();
        });
        await page.locator('.header-menu-select .select-header').click();
        await page
            .getByRole('listitem')
            .filter({ hasText: /^Мои проекты$/ })
            .click();

        await expect
            .poll(() => messages)
            .toEqual(['Агент ещё работает. Точно уйти со страницы?']);
        await expect(page).toHaveURL(`/project/${uuid}`);
    });
});
