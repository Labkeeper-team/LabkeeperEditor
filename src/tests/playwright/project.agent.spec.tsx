import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import {
    AgentHistoryEntry,
    CompileErrorResult,
    Program,
} from '../../model/domain.ts';

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
        historyDelayMs?: number;
    } = {}
) {
    const routeSetup = new RouteSetup(page);
    const authenticated = options.authenticated ?? true;
    await routeSetup.setupGetUserInfoRequest(authenticated);
    // согласие на передачу данных проверяется отдельной спекой, здесь оно дано
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default', options.program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest(options.history ?? []);
    if (options.historyDelayMs) {
        await page.route(`**/public/project/${uuid}/history`, async (route) => {
            await new Promise((done) =>
                setTimeout(done, options.historyDelayMs)
            );
            await route.fallback();
        });
    }
    const sent = await routeSetup.setupAgentSocket(options.frames ?? [], {
        dropConnection: options.dropConnection,
    });

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    return sent;
}

async function submitPrompt(page: Page, text = 'сделай таблицу') {
    await page.getByPlaceholder('Enter your prompt').fill(text);
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

test('agent-stop-reason-PromptTooLong-returns-the-prompt', async ({ page }) => {
    await openChat(page, { frames: [finished('PromptTooLong', null)] });
    await submitPrompt(page, 'очень длинный запрос');

    await expect(page.locator('.agent-chat__error-text')).toHaveText(
        'The request is too long. Shorten it and send it again'
    );
    // текст вернулся в поле, сокращать его не придётся по памяти
    await expect(page.getByPlaceholder('Enter your prompt')).toHaveValue(
        'очень длинный запрос'
    );
    await expect(page.getByPlaceholder('Enter your prompt')).toBeEditable();
});

test('agent-stop-reason-QuotaExceeded-keeps-the-answer', async ({ page }) => {
    await openChat(page, {
        frames: [finished('QuotaExceeded', 'добавил два сегмента')],
    });
    await submitPrompt(page);

    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'добавил два сегмента'
    );
    await expect(page.locator('.agent-chat__notice-text')).toContainText(
        'it tried to create a file larger than allowed'
    );
    await expect(page.locator('.agent-chat__error-text')).toHaveCount(0);
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

test('agent-response-renders-markdown', async ({ page }) => {
    const answer = [
        'Сделал **таблицу** и добавил `код`:',
        '',
        '- первый пункт',
        '- второй пункт',
        '',
        '| a | b |',
        '| - | - |',
        '| 1 | 2 |',
        '',
        '```',
        'x = 1',
        '```',
        '',
        '[документация](https://labkeeper.io/wiki)',
    ].join('\n');
    await openChat(page, { frames: [finished('Done', answer)] });
    await submitPrompt(page);

    const response = page.locator('.agent-chat__response-text');
    await expect(response.locator('strong')).toHaveText('таблицу');
    await expect(response.locator('li')).toHaveText([
        'первый пункт',
        'второй пункт',
    ]);
    await expect(response.locator('table td')).toHaveText(['1', '2']);
    await expect(response.locator('pre code')).toHaveText('x = 1');
    // ссылка из ответа не должна уводить со страницы с несохранённой работой
    const link = response.getByRole('link', { name: 'документация' });
    await expect(link).toHaveAttribute('href', 'https://labkeeper.io/wiki');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('agent-response-keeps-raw-html-and-images-inert', async ({ page }) => {
    const answer = [
        'сырой <b>html</b> <img src="x" onerror="window.__agentXss = 1">',
        '',
        '![пиксель](https://example.com/pixel.png)',
        '',
        '[опасно](javascript:window.__agentXss=2)',
    ].join('\n');
    await openChat(page, { frames: [finished('Done', answer)] });
    await submitPrompt(page);

    const response = page.locator('.agent-chat__response-text');
    await expect(response).toContainText('пиксель');
    // текст агента можно подтолкнуть через содержимое проекта: ни разметки,
    // ни картинок, которые браузер сам сходит загрузить
    await expect(response.locator('b')).toHaveCount(0);
    // но и не выбрасываем: агент мог писать про сам тег
    await expect(response).toContainText('<b>html</b>');
    await expect(response.locator('img')).toHaveCount(0);
    await expect(
        response.getByRole('link', { name: 'пиксель' })
    ).toHaveAttribute('href', 'https://example.com/pixel.png');
    await expect(
        response.getByRole('link', { name: 'опасно' })
    ).not.toHaveAttribute('href', /javascript:/);
    expect(
        await page.evaluate(
            () => (window as { __agentXss?: number }).__agentXss
        )
    ).toBeUndefined();
});

test('agent-response-does-not-break-formulas', async ({ page }) => {
    await openChat(page, {
        frames: [finished('Done', 'Площадь равна $a*b*c$ квадратных единиц')],
    });
    await submitPrompt(page);

    const response = page.locator('.agent-chat__response-text');
    // звёздочки внутри формулы не должны превратиться в курсив
    await expect(response.locator('em')).toHaveCount(0);
    await expect(response).toContainText('a*b*c');
});

// MathJax кладёт копию формулы для экранных дикторов внутрь самой формулы
const FORMULA = 'mjx-container:not(mjx-assistive-mml *)';

// MathJax тяжёлый, и на медленной машине грузится дольше обычного ожидания
const MATHJAX_LOAD = { timeout: 15000 };

test('agent-response-renders-formulas', async ({ page }) => {
    const answer = [
        'Строчная $E = mc^2$ и ещё \\( a^2 \\)',
        '',
        '\\[',
        '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1',
        '\\]',
        '',
        '```latex',
        '\\[ x \\]',
        '```',
    ].join('\n');
    await openChat(page, { frames: [finished('Done', answer)] });
    await submitPrompt(page);

    const response = page.locator('.agent-chat__response-text');
    await expect(response.locator(FORMULA)).toHaveCount(3, MATHJAX_LOAD);
    await expect(response.locator(`${FORMULA}[display="true"]`)).toHaveCount(1);
    // DeepSeek пишет \[ \], и markdown раньше съедал слеши, оставляя голые скобки
    await expect(response).not.toContainText('\\lim');
    // формула-блок стоит без серой подложки кода, а код остаётся кодом
    await expect(response.locator('pre mjx-container')).toHaveCount(0);
    await expect(response.locator('pre code')).toHaveText('\\[ x \\]');
});

test('answer-without-formulas-does-not-load-mathjax', async ({ page }) => {
    const mathJaxRequests: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/mathjax/')) {
            mathJaxRequests.push(request.url());
        }
    });
    await openChat(page, { frames: [finished('Done', 'Добавил **таблицу**')] });
    await submitPrompt(page);

    await expect(page.locator('.agent-chat__response-text strong')).toHaveText(
        'таблицу'
    );
    expect(mathJaxRequests).toEqual([]);
});

test('agent-formulas-cannot-leave-the-answer', async ({ page }) => {
    const outside: string[] = [];
    page.on('request', (request) => {
        if (request.url().includes('attacker.example')) {
            outside.push(request.url());
        }
    });
    const answer = [
        '$\\href{javascript:window.__agentXss=3}{x}$',
        '',
        '$\\style{cursor:url(https://attacker.example/c.png),auto}{y}$',
        '',
        '$\\def\\cdot{+}$ и потом $a \\cdot b$',
        '',
        '$\\raise{-30em}{\\rule{80em}{80em}}$',
        '',
        '$$',
        '\\newcommand{\\R}{\\mathbb{R}}',
        '$$',
    ].join('\n');
    await openChat(page, { frames: [finished('Done', answer)] });
    await submitPrompt(page);

    const response = page.locator('.agent-chat__response-text');
    await expect(response.locator(FORMULA)).toHaveCount(2, MATHJAX_LOAD);
    // ссылки, стили и определения агента остаются текстом
    await expect(response.locator('code')).toHaveText([
        '\\href{javascript:window.__agentXss=3}{x}',
        '\\style{cursor:url(https://attacker.example/c.png),auto}{y}',
        '\\def\\cdot{+}',
        '\\newcommand{\\R}{\\mathbb{R}}',
    ]);
    // отклонённая формула-блок остаётся блоком кода
    await expect(response.locator('pre code')).toHaveText(
        '\\newcommand{\\R}{\\mathbb{R}}'
    );
    // точка осталась точкой: определение из ответа не попало в общий MathJax
    await expect(response.locator('mjx-c.mjx-c22C5').first()).toBeAttached();
    // огромная формула не вылезает из ответа на карточку запроса над ним
    const covered = await page
        .locator('.agent-chat__request-text')
        .evaluate((node) => {
            node.scrollIntoView({ block: 'center' });
            const box = node.getBoundingClientRect();
            const top = document.elementFromPoint(
                box.left + box.width / 2,
                box.top + box.height / 2
            );
            return !node.contains(top);
        });
    expect(covered).toBe(false);
    expect(outside).toEqual([]);
    expect(
        await page.evaluate(
            () => (window as { __agentXss?: number }).__agentXss
        )
    ).toBeUndefined();
});

test('answer-with-a-math-fence-does-not-break-the-page', async ({ page }) => {
    await openChat(page, {
        frames: [finished('Done', 'Ответ:\n\n```math\nx^2\n```')],
    });
    await submitPrompt(page);

    const response = page.locator('.agent-chat__response-text');
    await expect(response.locator('pre code')).toHaveText('x^2');
    await expect(page.locator('.agent-chat')).toBeVisible();
});

const FILLER_HISTORY = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    request: `вопрос ${index}`,
    response: `ответ ${index}`,
    createdAt: '2026-09-08T10:00:00Z',
}));

const TALL_FORMULA =
    '\\[\n\\begin{pmatrix} 1 \\\\ 2 \\\\ 3 \\\\ 4 \\\\ 5 \\\\ 6 \\end{pmatrix}\n\\]';

const TALL_ANSWER = {
    id: 'last',
    request: 'матрица',
    response: `${TALL_FORMULA}\n\n${TALL_FORMULA}\n\n${TALL_FORMULA}`,
    createdAt: '2026-09-08T10:00:00Z',
};

const distanceToBottom = (page: Page) =>
    page
        .locator('.agent-chat__transcript')
        .evaluate(
            (node) => node.scrollHeight - node.scrollTop - node.clientHeight
        );

test('history-stays-at-the-end-after-formulas-render', async ({ page }) => {
    // пока история едет, лента показывает заглушку загрузки, а потом другой элемент
    await openChat(page, {
        history: [...FILLER_HISTORY, TALL_ANSWER],
        historyDelayMs: 1000,
    });

    const transcript = page.locator('.agent-chat__transcript');
    await expect(transcript.locator(FORMULA)).toHaveCount(3, MATHJAX_LOAD);
    // формулы набираются уже после того, как лента докрутилась вниз
    await expect.poll(() => distanceToBottom(page)).toBeLessThanOrEqual(1);
});

test('chat-keeps-following-after-history-is-cleared', async ({ page }) => {
    const frames = Array.from({ length: 90 }, () => toolCall('read_segment'));
    await openChat(page, { history: FILLER_HISTORY, frames });
    await expect(page.locator('.agent-chat__pair')).toHaveCount(12);
    await expect.poll(() => distanceToBottom(page)).toBeLessThanOrEqual(1);

    // лента сжимается, и браузер сам сдвигает прокрутку вверх
    await page.getByRole('button', { name: 'Clear history' }).click();
    await expect(page.locator('.agent-chat__pair')).toHaveCount(0);
    await submitPrompt(page);

    await expect(page.locator('.agent-chat__event')).toHaveCount(90);
    await expect.poll(() => distanceToBottom(page)).toBeLessThanOrEqual(1);
});

test('wide inline formula can be scrolled', async ({ page }) => {
    const answer = `Сумма $${'a_1 + '.repeat(60)}b$ получилась длинной`;
    await openChat(page, { frames: [finished('Done', answer)] });
    await submitPrompt(page);

    const response = page.locator('.agent-chat__response-text');
    await expect(response.locator(FORMULA)).toHaveCount(1, MATHJAX_LOAD);
    const scrolled = await response.evaluate((node) => {
        node.scrollLeft = node.scrollWidth;
        return node.scrollLeft;
    });
    // конец формулы не обрезан, до него можно докрутить
    expect(scrolled).toBeGreaterThan(0);
});

test('agent-history-response-renders-markdown', async ({ page }) => {
    await openChat(page, {
        history: [
            {
                id: '1',
                request: 'что сделал',
                response: 'Добавил **два** сегмента',
                createdAt: '2026-09-08T10:00:00Z',
            },
        ],
    });

    await expect(page.locator('.agent-chat__response-text strong')).toHaveText(
        'два'
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

/** Свой проект без открытия вкладки руками: что показано сразу при входе */
async function openProjectAsIs(page: Page, neverCompiled: boolean) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    if (neverCompiled) {
        routeSetup.setupNeverCompiledProject();
    }
    await routeSetup.setupGetProjectRequest(200, 'default', RUNNABLE_PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('.cm-content').first().waitFor({ state: 'attached' });
}

test('never-compiled-project-opens-on-the-agent', async ({ page }) => {
    await openProjectAsIs(page, true);

    // справа смотреть нечего, поэтому сразу агент
    await expect(page.locator('.agent-chat')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'AI agent' })).toHaveAttribute(
        'aria-selected',
        'true'
    );
});

test('compiled-project-opens-on-the-result', async ({ page }) => {
    await openProjectAsIs(page, false);

    await expect(page.locator('.result-container')).toBeVisible();
    await expect(page.locator('.agent-chat')).toHaveCount(0);
});

test.describe('project entry on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('never-compiled-project-opens-the-agent-screen', async ({ page }) => {
        await openProjectAsIs(page, true);

        await expect(page.locator('.agent-chat')).toBeVisible();
        // переключатель экранов подписан тем, что открыто
        await expect(
            page.locator('.mobile-view-switcher-bar__label')
        ).toHaveText('AI agent');
    });
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

const NO_SUCH_VARIABLE = {
    code: 301,
    payload: { segmentId: 1, line: 0, position: 4, variable: 'x' },
} as unknown as CompileErrorResult;

/** Проект с ошибкой компиляции: Run отдаёт ошибку, чат ещё не открыт */
async function openWithCompileError(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default', RUNNABLE_PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);
    await routeSetup.setupCompilationRequest(203, 'errorBody', [
        NO_SUCH_VARIABLE,
    ]);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
}

const sendErrorsButton = (page: Page) =>
    page.getByRole('button', { name: 'Send to agent' });

test('compile-errors-go-to-the-agent-prompt', async ({ page }) => {
    await openWithCompileError(page);
    await expect(sendErrorsButton(page)).toHaveCount(0);
    await page.getByRole('button', { name: /Run/i }).click();
    await expect(sendErrorsButton(page)).toBeVisible();
    const expandedPanel = page.locator('.problem-list-container-expanded');
    const expandedBefore = await expandedPanel.count();

    await sendErrorsButton(page).click();

    // чат был закрыт, кнопка его открывает
    await expect(page.locator('.agent-chat')).toBeVisible();
    await expect(page.getByPlaceholder('Enter your prompt')).toHaveValue(
        'Fix the compilation errors:\n- Segment №1, line 1.4: No such variable x'
    );
    // кнопка живёт в заголовке панели, но сворачивать панель не должна
    await expect(expandedPanel).toHaveCount(expandedBefore);
});

test('compile-errors-do-not-overwrite-a-typed-prompt', async ({ page }) => {
    await openWithCompileError(page);
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await page.getByPlaceholder('Enter your prompt').fill('мой запрос');
    await page.getByRole('button', { name: /Run/i }).click();

    await sendErrorsButton(page).click();

    await expect(page.locator('div.Toastify__toast').first()).toContainText(
        'The agent prompt already has text'
    );
    await expect(page.getByPlaceholder('Enter your prompt')).toHaveValue(
        'мой запрос'
    );
});

test.describe('compile errors on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('compile-errors-open-the-agent-screen', async ({ page }) => {
        await openWithCompileError(page);
        await page.getByRole('button', { name: /Run/i }).click();
        // после компиляции телефон показывает результат, панель ошибок в редакторе
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'Editor' }).click();

        await sendErrorsButton(page).click();

        await expect(page.locator('.agent-chat')).toBeVisible();
        await expect(page.getByPlaceholder('Enter your prompt')).toHaveValue(
            /No such variable x/
        );
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });
});

test.describe('compile errors in a russian browser', () => {
    test.use({ locale: 'ru-RU' });

    test('compile-errors-follow-the-chosen-language', async ({ page }) => {
        await openWithCompileError(page);
        // браузер русский, английский выбран в шапке уже после загрузки
        await page
            .locator('.labkeeper_header__language .select-header')
            .click();
        await page
            .getByRole('listitem')
            .filter({ hasText: /^English$/ })
            .click();
        await page.getByRole('button', { name: /Run/i }).click();

        await sendErrorsButton(page).click();

        await expect(page.getByPlaceholder('Enter your prompt')).toHaveValue(
            'Fix the compilation errors:\n- Segment №1, line 1.4: No such variable x'
        );
    });
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

const THREE_SEGMENTS: Program = {
    segments: [1, 2, 3].map((id) => ({
        id,
        type: 'md',
        text: `сегмент ${id}\nвторая строка\nтретья строка`,
        parameters: { visible: true },
    })),
    parameters: { roundStrategy: 'noRound' },
};

/** Агент правит два сегмента: первый и третий, третий последним */
const CHANGES = [
    {
        id: 'h1',
        type: 'addLinesToSegment',
        segmentId: 1,
        startLine: 1,
        endLine: 1,
    },
    {
        id: 'h3',
        type: 'addLinesToSegment',
        segmentId: 3,
        startLine: 2,
        endLine: 2,
    },
];

async function runAgent(page: Page, frames: Frame[], changes: object[]) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default', THREE_SEGMENTS);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    const sent = await routeSetup.setupAgentSocket(frames);
    // до запуска агента правок нет, после старта они появляются
    await page.route(`**/public/project/${uuid}/hunk`, async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }
        await route.fulfill({ json: { hunks: sent.length ? changes : [] } });
    });

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    const switcher = page.locator('.mobile-view-switcher-bar__toggle');
    if (await switcher.isVisible()) {
        await switcher.click();
        await page.getByRole('option', { name: 'AI agent' }).click();
    } else {
        await page.getByRole('tab', { name: 'AI agent' }).click();
    }
    await submitPrompt(page);
}

const segment = (page: Page, index: number) =>
    page.locator('.segment-editor-container').nth(index);

test.describe('agent run on a phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('finished-run-opens-the-last-change', async ({ page }) => {
        await runAgent(
            page,
            [toolCall('add_lines_to_segment'), finished('Done')],
            CHANGES
        );

        // чат и редактор тут разные экраны, после прогона открываем редактор
        await expect(
            page.locator('.mobile-view-switcher-bar__label')
        ).toHaveText('Editor');
        await expect(segment(page, 2)).toHaveClass(/is-active/);
        await expect(segment(page, 2)).toBeInViewport();
    });

    test('answer-without-changes-stays-in-the-chat', async ({ page }) => {
        await runAgent(page, [finished('Done', 'тут три сегмента')], []);

        await expect(page.locator('.agent-chat__response-text')).toHaveText(
            'тут три сегмента'
        );
        await expect(
            page.locator('.mobile-view-switcher-bar__label')
        ).toHaveText('AI agent');
    });
});

test('finished-run-on-a-desktop-does-not-move-the-editor', async ({ page }) => {
    await runAgent(
        page,
        [toolCall('add_lines_to_segment'), finished('Done')],
        CHANGES
    );
    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'готово'
    );

    // на десктопе редактор виден и так, и уже стоит на правке с шага агента
    await expect(segment(page, 0)).toHaveClass(/is-active/);
    await expect(page.locator('.agent-chat')).toBeVisible();
});

test('repeated-edit-of-one-segment-reaches-the-editor', async ({ page }) => {
    const added = (endLine: number, text: string) => ({
        id: 'same',
        type: 'addLinesToSegment',
        segmentId: 1,
        startLine: 2,
        endLine,
        text,
    });
    // вторую строку сервер дописывает в тот же hunk и id не меняет
    const server = [
        { text: 'первая', hunks: [] },
        { text: 'первая\nвторая', hunks: [added(2, 'вторая')] },
        {
            text: 'первая\nвторая\nтретья',
            hunks: [added(3, 'вторая\nтретья')],
        },
    ];
    let step = 0;
    const saved: Program[] = [];
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest(200, 'empty', (route) =>
        saved.push(route.request().postDataJSON())
    );
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    const sent = await routeSetup.setupAgentSocket([
        toolCall('add_lines_to_segment'),
        toolCall('add_lines_to_segment'),
        finished('Done'),
    ]);
    await page.route(`**/public/project/${uuid}/hunk`, async (route) => {
        if (route.request().method() !== 'GET') {
            await route.continue();
            return;
        }
        // каждый вызов агента продвигает сервер на шаг
        if (sent.length) {
            step = Math.min(step + 1, server.length - 1);
        }
        await route.fulfill({ json: { hunks: server[step].hunks } });
    });
    await page.route(`**/public/project/${uuid}/get**`, (route) =>
        route.fulfill({
            json: {
                projectId: uuid,
                userId: 1,
                title: 'Default Project',
                lastModified: '2026-09-16T10:00:00Z',
                isPublic: false,
                projectType: 'markdown',
                program: {
                    segments: [
                        {
                            id: 1,
                            type: 'md',
                            text: server[step].text,
                            parameters: { visible: true },
                        },
                    ],
                    parameters: { roundStrategy: 'noRound' },
                },
                lastProgramResult: { segments: [] },
            },
        })
    );

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await submitPrompt(page, 'добавь две строки');
    await expect(page.locator('.agent-chat__response-text')).toHaveText(
        'готово'
    );

    await expect(segment(page, 0).locator('.cm-line')).toHaveText([
        'первая',
        'вторая',
        'третья',
    ]);
    await expect(segment(page, 0).locator('.cm-hunk-added-line')).toHaveCount(
        2
    );
    await expect(page.locator('.agent-chat__event-label')).toHaveText([
        'Changes have been made to segment №1',
        'Changes have been made to segment №1',
    ]);

    // следующий запрос сперва сохраняет программу, старый текст затёр бы правку агента
    const savesBefore = saved.length;
    await submitPrompt(page, 'проверь');
    await expect.poll(() => saved.length).toBeGreaterThan(savesBefore);
    expect(saved.map((program) => program.segments[0].text)).not.toContain(
        'первая\nвторая'
    );
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
