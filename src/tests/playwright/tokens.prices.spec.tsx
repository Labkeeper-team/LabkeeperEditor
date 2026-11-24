import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-280: на странице токенов были цены только запроса к агенту и сборки.
 * Теперь есть и распознавание картинок и сканов, и голосовой ввод
 */

test.use({ viewport: { width: 1440, height: 900 } });

const PRICES = {
    latexCompilationTokenCostPerSecond: 0.5,
    markdownCompilationTokenCostPerSecond: 0.25,
    gptTextPromptTokenCost: 1,
    textRecognitionTokenCostPerPage: 2,
    speechRecognitionTokenCostPer15Seconds: 0.4,
    speechRecognitionMaxDurationSeconds: 30,
};

async function openTokens(page: Page, servicePrices: object) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    await page.route('**/api/v4/public/billing/pricing**', (route) =>
        route.fulfill({
            json: {
                servicePrices,
                tokenPrices: [],
                userRegularRefill: {
                    refillTokensAmount: 5,
                    refillPeriodSeconds: 86400,
                },
                newUserInitialTokensCount: 10,
            },
        })
    );
    await page.goto('/tokens');
    await expect(page.locator('.tokens-page__usage')).toBeVisible();
}

const usageItem = (page: Page, heading: string) =>
    page.locator('.tokens-page__usage-item').filter({
        has: page.locator('.tokens-page__usage-item-heading', {
            hasText: heading,
        }),
    });

test('у каждого раздела свои цены, включая картинки и голос', async ({
    page,
}) => {
    await openTokens(page, PRICES);

    await expect(page.locator('.tokens-page__usage-item-heading')).toHaveText([
        'AI assistant (GPT) usage',
        'Server-side compilation',
        'Image and scan recognition',
        'Voice input',
    ]);
    const rates = (heading: string) =>
        usageItem(page, heading).locator('.tokens-page__usage-item-rate');
    await expect(rates('AI assistant (GPT) usage')).toHaveText([
        'Text GPT prompt: 1 token per 1 request.',
    ]);
    await expect(rates('Server-side compilation')).toHaveText([
        'LaTeX compilation: 0.5 tokens per 1 second of server time.',
        'Markdown compilation: 0.25 tokens per 1 second of server time.',
    ]);
    await expect(rates('Image and scan recognition')).toHaveText([
        'Recognition: 2 tokens per 1 image or PDF page.',
    ]);
    await expect(rates('Voice input')).toHaveText([
        'Voice input: 0.4 tokens per every started 15 seconds of recording.',
        'One recording lasts up to 30 seconds.',
    ]);
});

test('по-русски цены картинок и голоса тоже видны', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('labkeeper_lang', 'ru');
    });
    await openTokens(page, PRICES);

    await expect(
        usageItem(page, 'Распознавание изображений и сканов').locator(
            '.tokens-page__usage-item-rate'
        )
    ).toHaveText([
        'Распознавание: 2 токена за 1 изображение или страницу PDF.',
    ]);
    await expect(
        usageItem(page, 'Голосовой ввод').locator(
            '.tokens-page__usage-item-rate'
        )
    ).toHaveText([
        'Голосовой ввод: 0,4 токена за каждые начатые 15 секунд записи.',
        'Одна запись длится до 30 секунд.',
    ]);
});

test('цены, которых сервер не прислал, не выдумываются', async ({ page }) => {
    await openTokens(page, {
        latexCompilationTokenCostPerSecond: 0.5,
        markdownCompilationTokenCostPerSecond: 0.25,
        gptTextPromptTokenCost: 1,
    });

    await expect(usageItem(page, 'Voice input')).toBeVisible();
    await expect(
        usageItem(page, 'Image and scan recognition').locator(
            '.tokens-page__usage-item-rate'
        )
    ).toHaveCount(0);
    await expect(
        usageItem(page, 'Voice input').locator('.tokens-page__usage-item-rate')
    ).toHaveCount(0);
});
