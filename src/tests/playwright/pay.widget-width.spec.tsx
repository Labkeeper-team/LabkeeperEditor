import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const WIDGET = '[id^="yoomoney-payment-form-"]';

/** Страница оплаты с неоплаченной покупкой, вместо ЮKassa заглушка с iframe на всю ширину контейнера, как у настоящего виджета */
async function openPayPage(page: Page) {
    await page.route('**/checkout-widget/v1/checkout-widget.js', (route) =>
        route.fulfill({
            contentType: 'application/javascript',
            body: `window.YooMoneyCheckoutWidget = class {
                on() {}
                destroy() {}
                render(id) {
                    const frame = document.createElement('iframe');
                    frame.style.width = '100%';
                    frame.style.height = '600px';
                    frame.style.border = '0';
                    document.getElementById(id).appendChild(frame);
                    return Promise.resolve();
                }
            };`,
        })
    );
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(true);
    await page.route('**/api/v4/public/billing/purchases**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
                purchases: [
                    {
                        id: 'p1',
                        tokenPriceId: 't1',
                        token: 'widget-token',
                        yookassa: { widgetToken: 'widget-token' },
                        status: 'pending',
                        createdAt: '2026-10-15T10:00:00Z',
                        updatedAt: '2026-10-15T10:00:00Z',
                    },
                ],
            }),
        })
    );
    await page.goto('/pay');
    await expect(page.locator(`${WIDGET} iframe`)).toBeAttached();
}

const widgetBox = (page: Page) =>
    page.locator(`${WIDGET} iframe`).evaluate((frame) => {
        const box = frame.getBoundingClientRect();
        return {
            left: Math.round(box.left),
            right: Math.round(box.right),
            viewport: document.documentElement.clientWidth,
            scrollWidth: document.documentElement.scrollWidth,
        };
    });

for (const width of [360, 375, 390, 430]) {
    test(`pay-widget-takes-the-whole-phone-width-${width}`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 800 });
        await openPayPage(page);

        // раньше поля страницы и карточки отнимали у виджета около сотни пикселей
        const box = await widgetBox(page);
        expect(box).toEqual({
            left: 0,
            right: box.viewport,
            viewport: box.viewport,
            scrollWidth: box.viewport,
        });
    });
}

test('pay-widget-stays-inside-the-card-on-a-desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await openPayPage(page);

    const card = await page.locator('.pay-page__card').boundingBox();
    const box = await widgetBox(page);
    // карточка 560px с полями 28px и рамкой, как была
    expect(card?.width).toBe(560);
    expect(box.right - box.left).toBe(560 - 2 * 28 - 2);
});
