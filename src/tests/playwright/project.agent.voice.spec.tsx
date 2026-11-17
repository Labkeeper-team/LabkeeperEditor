import { expect, test, type Page, type Request } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-271: голосовой ввод в поле агента. Chromium пишет звук с поддельного
 * микрофона, поэтому запись настоящая: она идёт через Web Audio в PCM
 * 16 кГц, ведь Ogg этот браузер не пишет. Сервер распознавания подменён
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({
    viewport: { width: 1360, height: 900 },
    launchOptions: {
        args: [
            '--use-fake-ui-for-media-stream',
            '--use-fake-device-for-media-stream',
        ],
    },
    permissions: ['microphone'],
});

const PRICES = {
    latexCompilationTokenCostPerSecond: 1,
    markdownCompilationTokenCostPerSecond: 1,
    gptTextPromptTokenCost: 1,
    speechRecognitionTokenCostPer15Seconds: 0.4,
    speechRecognitionMaxDurationSeconds: 30,
};

async function openChat(
    page: Page,
    { authenticated = true, limitSeconds = 30 } = {}
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(authenticated);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await page.route('**/api/v4/public/billing/pricing**', (route) =>
        route.fulfill({
            json: {
                servicePrices: {
                    ...PRICES,
                    speechRecognitionMaxDurationSeconds: limitSeconds,
                },
                tokenPrices: [],
            },
        })
    );
    await page.goto(`/project/${uuid}`);
    // на телефоне вкладки уходят в переключатель под шапкой
    if ((page.viewportSize()?.width ?? 1360) <= 767) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'AI agent' }).click();
    } else {
        await page.getByRole('tab', { name: 'AI agent' }).click();
    }
}

/** Сервер распознавания: отвечает заданным, запросы складывает */
async function speechServer(
    page: Page,
    answer: { status?: number; text?: string } = {}
) {
    const requests: Request[] = [];
    await page.route('**/api/v4/public/speech/recognize**', async (route) => {
        requests.push(route.request());
        await route.fulfill(
            answer.status && answer.status !== 200
                ? { status: answer.status, json: {} }
                : { json: { text: answer.text ?? 'добавь таблицу' } }
        );
    });
    return requests;
}

const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');
const voiceButton = (page: Page) => page.locator('.agent-voice');
const toast = (page: Page) => page.locator('div.Toastify__toast').first();

test('голос дописывается в поле агента, а агенту сам не уходит', async ({
    page,
}) => {
    await openChat(page);
    const requests = await speechServer(page);
    let agentStarted = false;
    page.on('websocket', () => (agentStarted = true));
    await promptField(page).fill('Сделай отчёт');

    await page.getByRole('button', { name: 'Voice input' }).click();
    // идёт запись: кнопка красная и показывает время до предела
    await expect(voiceButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(voiceButton(page)).toContainText('/ 0:30');
    await expect(voiceButton(page)).toContainText('0:01');
    await page
        .getByRole('button', { name: 'Stop recording and transcribe' })
        .click();

    await expect(promptField(page)).toHaveText('Сделай отчёт добавь таблицу');
    await expect(voiceButton(page)).toHaveAttribute('aria-pressed', 'false');
    expect(requests).toHaveLength(1);
    const url = new URL(requests[0].url());
    expect(Object.fromEntries(url.searchParams)).toEqual({
        format: 'lpcm',
        sampleRateHertz: '16000',
        lang: 'en-US',
    });
    // секунда речи в 16 кГц и 16 битах это 32 000 байт
    const body = requests[0].postDataBuffer()!;
    expect(body.length).toBeGreaterThan(32_000);
    expect(body.toString('latin1')).toContain('filename="voice.pcm"');
    expect(agentStarted).toBe(false);
});

test('запись останавливается сама у предела из цен', async ({ page }) => {
    await openChat(page, { limitSeconds: 2 });
    const requests = await speechServer(page, { text: 'привет' });

    await page.getByRole('button', { name: 'Voice input' }).click();
    await expect(voiceButton(page)).toContainText('/ 0:02');

    await expect(promptField(page)).toHaveText('привет', { timeout: 10_000 });
    expect(requests).toHaveLength(1);
});

test('гостю голосовой ввод предлагает войти', async ({ page }) => {
    await openChat(page, { authenticated: false });
    const requests = await speechServer(page);

    await page.getByRole('button', { name: 'Voice input' }).click();

    await expect(page.locator('.auth-modal')).toBeVisible();
    await expect(voiceButton(page)).toHaveAttribute('aria-pressed', 'false');
    expect(requests).toHaveLength(0);
});

test('без доступа к микрофону объясняем, что делать', async ({ page }) => {
    await page.addInitScript(() => {
        navigator.mediaDevices.getUserMedia = () =>
            Promise.reject(
                new DOMException('Permission denied', 'NotAllowedError')
            );
    });
    await openChat(page);

    await page.getByRole('button', { name: 'Voice input' }).click();

    await expect(toast(page)).toContainText('No access to the microphone');
    await expect(voiceButton(page)).toHaveAttribute('aria-pressed', 'false');
});

test('без токенов поле не меняется, а причина названа', async ({ page }) => {
    await openChat(page);
    await speechServer(page, { status: 402 });
    await promptField(page).fill('Сделай отчёт');

    await page.getByRole('button', { name: 'Voice input' }).click();
    await expect(voiceButton(page)).toContainText('0:01');
    await page
        .getByRole('button', { name: 'Stop recording and transcribe' })
        .click();

    await expect(toast(page)).toContainText(
        'Not enough tokens for speech recognition'
    );
    await expect(promptField(page)).toHaveText('Сделай отчёт');
});

test.describe('телефон', () => {
    test.use({ viewport: { width: 320, height: 640 } });

    // в ряду кнопок места нет: микрофон в углу поля, отправка остаётся в ряду
    test('микрофон в углу поля, текст его обходит, а отправка в своём ряду', async ({
        page,
    }) => {
        await openChat(page);
        await speechServer(page);
        await promptField(page).fill('Сделай отчёт по лабораторной работе');

        const box = async (selector: string) =>
            (await page.locator(selector).boundingBox())!;
        const field = await box('.agent-chat__field');
        const voice = await box('.agent-voice');
        const text = await box('.agent-chat__input .cm-line');
        const submit = await box('.agent-chat__submit');
        const mode = await box('.agent-chat__mode');

        expect(voice.width).toBeGreaterThanOrEqual(44);
        expect(voice.y - field.y).toBeLessThan(12);
        expect(text.x + text.width).toBeLessThanOrEqual(voice.x);
        expect(
            Math.abs(submit.y + submit.height / 2 - (mode.y + mode.height / 2))
        ).toBeLessThan(4);

        await voiceButton(page).click();
        await expect(voiceButton(page)).toContainText('0:01');
        await voiceButton(page).click();
        await expect(promptField(page)).toHaveText(
            'Сделай отчёт по лабораторной работе добавь таблицу'
        );
    });
});
