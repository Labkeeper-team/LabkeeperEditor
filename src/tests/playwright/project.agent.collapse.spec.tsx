import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { AgentHistoryEntry } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

type Frame = Record<string, unknown>;

const modelCall = {
    type: 'modelFinished',
    totalTokens: 10,
    elapsedTimeMillis: 5,
};
const toolCall = (toolName: string) => ({ type: 'toolCall', toolName });
const finished = (stopReason: string, message: string | null = 'готово') => ({
    type: 'agentFinished',
    message,
    stopReason,
});

/** Первый прогон с тремя строками шагов и ответом, второй идёт, пока тест не кончится */
const FIRST_RUN: Frame[] = [
    modelCall,
    toolCall('list_workspace'),
    toolCall('read_segment'),
    finished('Done', 'первый ответ'),
];
const FIRST_RUN_STEPS = [
    'Calling the model',
    'Reading the project structure',
    'Reading a segment',
];
const RUNNING: Frame[] = [toolCall('read_file')];

async function openChat(
    page: Page,
    runs: Frame[][],
    history: AgentHistoryEntry[] = []
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest(history);
    await routeSetup.setupAgentSocketRuns(runs);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    // на узком экране колонки переключает выпадающий список, а не вкладки
    if ((page.viewportSize()?.width ?? 0) <= 767) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'AI agent' }).click();
        return;
    }
    await page.getByRole('tab', { name: 'AI agent' }).click();
}

const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');
const sendButton = (page: Page) =>
    page.getByRole('button', { name: 'Send', exact: true });
const stopButton = (page: Page) =>
    page.getByRole('button', { name: 'Stop', exact: true });
const stepLabels = (page: Page) => page.locator('.agent-chat__event-label');
const toggles = (page: Page) =>
    page.getByRole('button', { name: /^Agent steps: / });

async function submitPrompt(page: Page, text: string) {
    await promptField(page).fill(text);
    await sendButton(page).click();
    await expect(
        page.locator('.agent-chat__request-text', { hasText: text })
    ).toBeVisible();
}

/** Два прогона: первый закончен, второй только начал читать файл */
async function startSecondRun(page: Page) {
    await submitPrompt(page, 'первый');
    await expect(
        page.locator('.agent-chat__response-text', { hasText: 'первый ответ' })
    ).toBeVisible();
    await expect(stepLabels(page)).toHaveText(FIRST_RUN_STEPS);
    await submitPrompt(page, 'второй');
    await expect(stopButton(page)).toBeVisible();
}

test('past-steps-collapse-while-the-next-run-is-going', async ({ page }) => {
    await openChat(page, [FIRST_RUN, RUNNING]);

    await startSecondRun(page);

    // от первого прогона остались запрос и ответ, строки текущего на виду
    await expect(stepLabels(page)).toHaveText(['Reading a file']);
    await expect(
        page.locator('.agent-chat__response-text', { hasText: 'первый ответ' })
    ).toBeVisible();
    await expect(toggles(page)).toHaveText(['Agent steps: 3']);
    await expect(toggles(page)).toHaveAttribute('aria-expanded', 'false');
    // кнопка стоит под запросом своего прогона
    await expect(
        page.locator(
            '.agent-chat__request:has-text("первый") + .agent-chat__steps-toggle'
        )
    ).toBeVisible();
});

test('steps-toggle-expands-and-collapses-a-past-run', async ({ page }) => {
    await openChat(page, [FIRST_RUN, RUNNING]);
    await startSecondRun(page);
    const toggle = toggles(page);

    await toggle.click();

    await expect(stepLabels(page)).toHaveText([
        ...FIRST_RUN_STEPS,
        'Reading a file',
    ]);
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await toggle.click();

    await expect(stepLabels(page)).toHaveText(['Reading a file']);
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
});

test('expanded-run-collapses-again-on-the-next-request', async ({ page }) => {
    await openChat(page, [
        FIRST_RUN,
        [toolCall('read_file'), finished('Done', 'второй ответ')],
        RUNNING,
    ]);
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');
    await expect(
        page.locator('.agent-chat__response-text', { hasText: 'второй ответ' })
    ).toBeVisible();
    await toggles(page).click();
    await expect(stepLabels(page)).toHaveCount(4);

    await submitPrompt(page, 'третий');

    await expect(toggles(page)).toHaveText([
        'Agent steps: 3',
        'Agent steps: 1',
    ]);
    for (const toggle of await toggles(page).all()) {
        await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    }
    await expect(stepLabels(page)).toHaveText(['Reading a file']);
});

test('failed-and-stopped-runs-collapse-too', async ({ page }) => {
    await openChat(page, [
        [toolCall('read_segment'), finished('UnknownError', null)],
        [toolCall('list_workspace')],
        RUNNING,
    ]);
    await submitPrompt(page, 'первый');
    await expect(page.locator('.agent-chat__error-text')).toBeVisible();

    await submitPrompt(page, 'второй');
    await expect(stepLabels(page)).toHaveText([
        'Reading the project structure',
    ]);
    await stopButton(page).click();
    await expect(page.locator('.agent-chat__notice-text')).toBeVisible();

    await submitPrompt(page, 'третий');

    await expect(stepLabels(page)).toHaveText(['Reading a file']);
    await expect(toggles(page)).toHaveText([
        'Agent steps: 1',
        'Agent steps: 1',
    ]);
    // ошибка и оговорка о прерывании остаются на виду
    await expect(page.locator('.agent-chat__error-text')).toHaveText(
        'Something went wrong. Please try again'
    );
    await expect(page.locator('.agent-chat__notice-text')).toHaveText(
        'The run was stopped. The agent changed nothing'
    );
});

test('expanded-steps-survive-a-trip-to-the-pdf-tab', async ({ page }) => {
    await openChat(page, [FIRST_RUN, RUNNING]);
    await startSecondRun(page);
    await toggles(page).click();
    await expect(stepLabels(page)).toHaveCount(4);

    // вкладка PDF размонтирует чат целиком
    await page.getByRole('tab', { name: 'PDF visualization' }).click();
    await expect(page.locator('.agent-chat')).toHaveCount(0);
    await page.getByRole('tab', { name: 'AI agent' }).click();

    await expect(toggles(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(stepLabels(page)).toHaveText([
        ...FIRST_RUN_STEPS,
        'Reading a file',
    ]);
});

// сброс развёрнутости самой очисткой в ленте не наблюдаем, его проверяет jest
test('run-after-clearing-does-not-inherit-an-expanded-id', async ({ page }) => {
    const twoSteps = [
        toolCall('read_segment'),
        toolCall('read_file'),
        finished('Done'),
    ];
    await openChat(page, [FIRST_RUN, [finished('Done')], twoSteps, RUNNING]);
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');
    await expect(sendButton(page)).toBeVisible();
    await toggles(page).click();
    await expect(toggles(page)).toHaveAttribute('aria-expanded', 'true');

    await page.getByRole('button', { name: 'Clear history' }).click();

    await expect(page.locator('.agent-chat__request')).toHaveCount(0);
    await expect(toggles(page)).toHaveCount(0);

    // id сообщений идут заново, и первый новый прогон получает id развёрнутого прежде
    await submitPrompt(page, 'третий');
    await expect(stepLabels(page)).toHaveCount(2);
    await expect(sendButton(page)).toBeVisible();
    await submitPrompt(page, 'четвёртый');

    await expect(toggles(page)).toHaveText(['Agent steps: 2']);
    await expect(toggles(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(stepLabels(page)).toHaveText(['Reading a file']);
});

const FILLER_HISTORY = Array.from({ length: 12 }, (_, index) => ({
    id: String(index),
    request: `вопрос ${index}`,
    response: `ответ ${index}`,
    createdAt: '2026-09-08T10:00:00Z',
}));

const distanceToBottom = (page: Page) =>
    page
        .locator('.agent-chat__transcript')
        .evaluate(
            (node) => node.scrollHeight - node.scrollTop - node.clientHeight
        );

const afterTwoFrames = (page: Page) =>
    page.evaluate(
        () =>
            new Promise((done) =>
                requestAnimationFrame(() => requestAnimationFrame(done))
            )
    );

test('toggle-stays-put-when-expanding-at-the-bottom', async ({ page }) => {
    const sixSteps = Array.from({ length: 6 }, () => toolCall('read_segment'));
    await openChat(
        page,
        [
            [...sixSteps, finished('Done', 'первый ответ')],
            [finished('Done', 'второй ответ')],
        ],
        FILLER_HISTORY
    );
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');
    await expect(
        page.locator('.agent-chat__response-text', { hasText: 'второй ответ' })
    ).toBeVisible();
    // лента прилипла к низу: так она ведёт себя после каждого прогона
    await expect.poll(() => distanceToBottom(page)).toBeLessThanOrEqual(1);
    const toggle = toggles(page);
    const before = (await toggle.boundingBox())!.y;

    await toggle.click();
    await expect(stepLabels(page)).toHaveCount(6);
    await afterTwoFrames(page);

    // без отпускания низа лента уводила кнопку вверх на высоту шести строк
    const after = (await toggle.boundingBox())!.y;
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});

/** Длинная лента у низа, у первого прогона шесть строк шагов под кнопкой, третий прогон ждёт запроса */
async function twoRunsAtTheBottom(page: Page) {
    const sixSteps = Array.from({ length: 6 }, () => toolCall('read_segment'));
    await openChat(
        page,
        [
            [...sixSteps, finished('Done', 'первый ответ')],
            [finished('Done', 'второй ответ')],
            [finished('Done', 'третий ответ')],
        ],
        FILLER_HISTORY
    );
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');
    await expect(
        page.locator('.agent-chat__response-text', { hasText: 'второй ответ' })
    ).toBeVisible();
    await expect.poll(() => distanceToBottom(page)).toBeLessThanOrEqual(1);
}

async function expandSteps(page: Page) {
    await toggles(page).click();
    await expect(stepLabels(page)).toHaveCount(6);
    await afterTwoFrames(page);
}

async function runThirdRequest(page: Page) {
    await submitPrompt(page, 'третий');
    await expect(
        page.locator('.agent-chat__response-text', { hasText: 'третий ответ' })
    ).toBeVisible();
    await afterTwoFrames(page);
}

const scrollTop = (page: Page) =>
    page.locator('.agent-chat__transcript').evaluate((node) => node.scrollTop);

test('next-request-follows-after-expanding-at-the-bottom', async ({ page }) => {
    await twoRunsAtTheBottom(page);
    await expandSteps(page);
    // развёрнутые строки ушли под край, и низ отпущен
    expect(await distanceToBottom(page)).toBeGreaterThan(40);

    await runThirdRequest(page);

    // человек ленту не листал, а новый запрос сам свернул шаги: лента едет за ним, как без кнопки
    await expect.poll(() => distanceToBottom(page)).toBeLessThanOrEqual(1);
});

test('next-request-keeps-the-place-scrolled-to-after-a-toggle', async ({
    page,
}) => {
    await twoRunsAtTheBottom(page);
    await expandSteps(page);
    // человек ушёл читать начало ленты
    await page
        .locator('.agent-chat__transcript')
        .evaluate((node) => node.scrollTo(0, 0));
    await afterTwoFrames(page);

    await runThirdRequest(page);

    expect(await scrollTop(page)).toBeLessThanOrEqual(1);
});

test('next-request-keeps-the-place-when-toggled-away-from-the-bottom', async ({
    page,
}) => {
    await twoRunsAtTheBottom(page);
    // человек отлистал немного вверх, кнопка ещё на виду
    await page
        .locator('.agent-chat__transcript')
        .evaluate((node) => node.scrollBy(0, -100));
    await afterTwoFrames(page);
    const place = await scrollTop(page);
    await expandSteps(page);

    await runThirdRequest(page);

    expect(Math.abs((await scrollTop(page)) - place)).toBeLessThanOrEqual(1);
});

test('toggle-stays-put-while-the-current-run-goes-on', async ({ page }) => {
    const sixSteps = Array.from({ length: 6 }, () => toolCall('read_segment'));
    await openChat(
        page,
        [[...sixSteps, finished('Done', 'первый ответ')], RUNNING],
        FILLER_HISTORY
    );
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');
    await expect(stepLabels(page)).toHaveText(['Reading a file']);
    await expect.poll(() => distanceToBottom(page)).toBeLessThanOrEqual(1);
    const toggle = toggles(page);
    await toggle.click();
    await expect(stepLabels(page)).toHaveCount(7);
    await afterTwoFrames(page);
    const before = (await toggle.boundingBox())!.y;

    // лента пополняется без нового запроса: прерванный прогон дописывает оговорку
    await stopButton(page).click();
    await expect(page.locator('.agent-chat__notice-text')).toBeAttached();
    await afterTwoFrames(page);

    const after = (await toggle.boundingBox())!.y;
    expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
});

test('short-chat-still-follows-the-next-run-after-a-toggle', async ({
    page,
}) => {
    const manySteps = Array.from({ length: 30 }, () =>
        toolCall('read_segment')
    );
    await openChat(page, [
        FIRST_RUN,
        [finished('Done', 'второй ответ')],
        [...manySteps, finished('Done', 'третий ответ')],
    ]);
    await submitPrompt(page, 'первый');
    await submitPrompt(page, 'второй');
    await expect(sendButton(page)).toBeVisible();
    // лента ещё короткая: листать нечего, и прокрутка человека флаг низа не вернёт
    await toggles(page).click();
    await expect(stepLabels(page)).toHaveCount(3);
    await expect
        .poll(() =>
            page
                .locator('.agent-chat__transcript')
                .evaluate((node) => node.scrollHeight - node.clientHeight)
        )
        .toBeLessThanOrEqual(0);

    await submitPrompt(page, 'третий');

    await expect(
        page.locator('.agent-chat__response-text', { hasText: 'третий ответ' })
    ).toBeVisible();
    await expect.poll(() => distanceToBottom(page)).toBeLessThanOrEqual(1);
});

test.describe('steps toggle on a phone', () => {
    // Firefox не умеет isMobile, ему хватает сенсорного экрана без мыши
    test.use({
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: async ({ browserName }, provide) =>
            provide(browserName !== 'firefox'),
    });

    test('steps-toggle-is-a-finger-sized-target', async ({ page }) => {
        await openChat(page, [FIRST_RUN, RUNNING]);
        await startSecondRun(page);
        const toggle = toggles(page);

        // зона нажатия не меньше 44px, как у остальных кнопок на телефоне
        expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await toggle.tap();

        await expect(toggle).toHaveAttribute('aria-expanded', 'true');
        await expect(stepLabels(page)).toHaveCount(4);
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });
});
