import { expect, test, type ConsoleMessage, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { AgentHistoryEntry } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const MAIN_SCRIPT = '**/mathjax/tex-mml-chtml.js';
const COLOR_EXTENSION = '**/mathjax/input/tex/extensions/color.js';
// MathJax кладёт копию формулы для экранных дикторов внутрь самой формулы
const FORMULA = 'mjx-container:not(mjx-assistive-mml *)';
// так beforeSend в main.tsx отмечает событие, которое ушло бы в Sentry
const SENTRY_EVENT = 'Error event is dropped due to dev hostname';
// так reportToSentry пишет в консоль отчёт загрузчика
const LOAD_FAILED = '[error] mathjax-load-failed';
// паузы между попытками загрузчика
const RETRY_PAUSES = [1000, 3000, 10000];
// MathJax тяжёлый, и на медленной машине грузится дольше обычного ожидания
const MATHJAX_LOAD = { timeout: 20000 };

const HISTORY: AgentHistoryEntry[] = [
    {
        id: '1',
        request: 'формулы',
        response: 'Строчная $E = mc^2$ и ещё $a^2 + b^2$',
        createdAt: '2026-09-08T10:00:00Z',
    },
    {
        id: '2',
        request: 'ещё',
        response: 'Блок\n\n$$\\int_0^1 x\\,dx = \\frac12$$',
        createdAt: '2026-09-08T10:01:00Z',
    },
];

test.use({ viewport: { width: 1360, height: 900 } });

/** Чат с тремя формулами в истории и счётчики всего, что уходит мимо формул */
async function openChatWithFormulas(
    page: Page,
    frames: Record<string, unknown>[] = []
) {
    const seen = {
        pageErrors: [] as string[],
        sentryEvents: 0,
        loadFailures: [] as ConsoleMessage[],
        mainScript: 0,
    };
    page.on('pageerror', (error) => seen.pageErrors.push(error.message));
    page.on('console', (message) => {
        if (message.text().includes(SENTRY_EVENT)) {
            seen.sentryEvents += 1;
        }
        if (message.text().startsWith(LOAD_FAILED)) {
            seen.loadFailures.push(message);
        }
    });
    page.on('request', (request) => {
        if (request.url().endsWith('/mathjax/tex-mml-chtml.js')) {
            seen.mainScript += 1;
        }
    });
    // без настоящего DSN Sentry молчит, а с этим доходит до beforeSend и там останавливается
    await page.route(`**/project/${uuid}`, async (route) => {
        if (route.request().resourceType() !== 'document') {
            await route.fallback();
            return;
        }
        const response = await route.fetch();
        const html = (await response.text()).replace(
            'IO_LABKEEPER_FRONTEND_SENTRY_DSN',
            'http://public@localhost:9/1'
        );
        await route.fulfill({ response, body: html });
    });
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest(HISTORY);
    await routeSetup.setupAgentSocket(frames);
    await page.goto(`/project/${uuid}`);
    await page.getByRole('tab', { name: 'AI agent' }).click();
    return seen;
}

/** Часы страницы проходят все паузы загрузчика, и каждая попытка успевает провалиться */
async function failAllAttempts(page: Page, seen: { mainScript: number }) {
    // тег скрипта убран, значит попытка уже провалилась и следующая ждёт своего таймера
    const failedAttempts = async () => [
        seen.mainScript,
        await page.locator('script[src$="/mathjax/tex-mml-chtml.js"]').count(),
    ];
    await expect.poll(failedAttempts).toEqual([1, 0]);
    for (const [index, pause] of RETRY_PAUSES.entries()) {
        await page.clock.runFor(pause);
        await expect.poll(failedAttempts).toEqual([index + 2, 0]);
    }
}

async function submitPrompt(page: Page) {
    await page.getByPlaceholder('Enter your promt').fill('ещё формулу');
    await page.getByRole('button', { name: 'Send' }).click();
}

/** Причина из отчёта загрузчика, как её увидел бы Sentry */
const loadFailureCause = async (message: ConsoleMessage) =>
    ((await message.args()[1].jsonValue()) as { cause: string }).cause;

test('formulas-are-typeset-after-a-failed-mathjax-download-without-reload', async ({
    page,
}) => {
    let aborted = false;
    await page.route(MAIN_SCRIPT, async (route) => {
        if (!aborted) {
            aborted = true;
            await route.abort('failed');
            return;
        }
        await route.fallback();
    });
    const seen = await openChatWithFormulas(page);

    const transcript = page.locator('.agent-chat__transcript');
    await expect(transcript.locator(FORMULA)).toHaveCount(3, MATHJAX_LOAD);
    for (const formula of await transcript.locator(FORMULA).all()) {
        await expect(formula).toBeVisible();
    }
    expect(seen.mainScript).toBe(2);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.sentryEvents).toBe(0);
});

test('formulas-stay-text-while-mathjax-is-down-and-are-typeset-when-it-is-back', async ({
    page,
}) => {
    await page.clock.install();
    await page.route(MAIN_SCRIPT, (route) => route.abort('failed'));
    const seen = await openChatWithFormulas(page, [
        { type: 'agentFinished', message: 'Ответ $x^3$', stopReason: 'Done' },
    ]);
    await failAllAttempts(page, seen);

    const transcript = page.locator('.agent-chat__transcript');
    await expect(transcript.getByText('E = mc^2')).toBeVisible();
    await expect(transcript.locator(FORMULA)).toHaveCount(0);
    await expect.poll(() => seen.sentryEvents).toBe(1);
    expect(seen.loadFailures).toHaveLength(1);
    expect(await loadFailureCause(seen.loadFailures[0])).toBe(
        'MathJax gave up after 4 attempts, last failure: download'
    );
    // новый ответ, пока MathJax нет, виден текстом сразу и не качает MathJax заново
    await submitPrompt(page);
    await expect(transcript.getByText('x^3')).toBeVisible();
    expect(seen.mainScript).toBe(4);

    // сеть вернулась: через минуту после отказа формулы набираются без перезагрузки
    await page.unroute(MAIN_SCRIPT);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.clock.runFor(60000);
    await expect(transcript.locator(FORMULA)).toHaveCount(4, MATHJAX_LOAD);
    // формула, уже показанная текстом, после набора не должна спрятаться
    for (const formula of await transcript.locator(FORMULA).all()) {
        await expect(formula).toBeVisible();
    }
    expect(seen.mainScript).toBe(5);
    expect(seen.sentryEvents).toBe(1);
    expect(seen.pageErrors).toEqual([]);
});

test('formulas-are-text-while-offline-and-are-typeset-when-the-network-is-back', async ({
    page,
    context,
}) => {
    let offline = false;
    // сеть пропадает, когда чат начинает качать MathJax: без сети WebKit и Firefox не отдают даже подменённую историю
    await page.route(MAIN_SCRIPT, async (route) => {
        if (!offline) {
            offline = true;
            await context.setOffline(true);
            await route.abort('internetdisconnected');
            return;
        }
        await route.fallback();
    });
    const seen = await openChatWithFormulas(page);

    const transcript = page.locator('.agent-chat__transcript');
    await expect(transcript.getByText('E = mc^2')).toBeVisible();
    await expect(transcript.locator(FORMULA)).toHaveCount(0);
    // сеть вернулась: формулы набираются без перезагрузки, и отчёта нет, потому что это не отказ MathJax
    await context.setOffline(false);
    await expect(transcript.locator(FORMULA)).toHaveCount(3, MATHJAX_LOAD);
    for (const formula of await transcript.locator(FORMULA).all()) {
        await expect(formula).toBeVisible();
    }
    expect(seen.mainScript).toBe(2);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.sentryEvents).toBe(0);
});

test('a-page-instead-of-mathjax-leaves-formulas-as-text-and-is-reported-once', async ({
    page,
}) => {
    await page.clock.install();
    // так отвечает, например, портал авторизации в публичной сети
    await page.route(MAIN_SCRIPT, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<!doctype html><html><body>Sign in to Wi-Fi</body></html>',
        })
    );
    const seen = await openChatWithFormulas(page);
    await failAllAttempts(page, seen);

    const transcript = page.locator('.agent-chat__transcript');
    await expect(transcript.getByText('E = mc^2')).toBeVisible();
    await expect(transcript.locator(FORMULA)).toHaveCount(0);
    await expect.poll(() => seen.loadFailures.length).toBe(1);
    expect(await loadFailureCause(seen.loadFailures[0])).toBe(
        'MathJax gave up after 4 attempts, last failure: not-mathjax'
    );
    // браузер сам сообщает, что страница не скрипт, а формулы ошибок не бросают
    for (const error of seen.pageErrors) {
        expect(error).toMatch(/Unexpected token|expected expression/);
    }
});

// Chromium при уходе со страницы не шлёт error незавершённым загрузкам, WebKit и Firefox шлют
test('leaving-while-mathjax-downloads-reports-nothing', async ({
    page,
    browserName,
}) => {
    test.skip(browserName === 'chromium', 'Chromium не обрывает загрузки');
    let requested = false;
    // ответ не приходит, пока страница не уйдёт
    await page.route(MAIN_SCRIPT, () => {
        requested = true;
    });
    const seen = await openChatWithFormulas(page);
    await expect.poll(() => requested).toBe(true);

    await page.goto('/projects');
    // старый документ успел бы отправить отчёт, если бы он был
    await page.waitForTimeout(2000);

    expect(seen.pageErrors).toEqual([]);
    expect(seen.sentryEvents).toBe(0);
});

test('leaving-while-a-formula-loads-an-extension-reports-nothing', async ({
    page,
    browserName,
}) => {
    test.skip(browserName === 'chromium', 'Chromium не обрывает загрузки');
    let requested = false;
    await page.route(COLOR_EXTENSION, () => {
        requested = true;
    });
    const seen = await openChatWithFormulas(page, [
        {
            type: 'agentFinished',
            message: 'Ответ $\\color{red}{x} + 1$',
            stopReason: 'Done',
        },
    ]);
    const transcript = page.locator('.agent-chat__transcript');
    await expect(transcript.locator(FORMULA)).toHaveCount(3, MATHJAX_LOAD);
    // расширение \color MathJax догружает, только когда встречает его в формуле
    await submitPrompt(page);
    await expect.poll(() => requested).toBe(true);

    await page.goto('/projects');
    await page.waitForTimeout(2000);

    expect(seen.pageErrors).toEqual([]);
    expect(seen.sentryEvents).toBe(0);
});
