import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-235: у экранной клавиатуры телефона одна клавиша ввода. Раньше она
 * сразу отправляла запрос агенту, и перенести строку было нечем. Теперь без
 * мыши и тачпада Enter переносит строку, а отправляет кнопка
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

async function openChat(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    const sent = await routeSetup.setupAgentSocket([]);
    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    // на узком экране колонки переключает выпадающий список, а не вкладки
    if ((page.viewportSize()?.width ?? 0) <= 767) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'AI agent' }).click();
    } else {
        await page.getByRole('tab', { name: 'AI agent' }).click();
    }
    await page.locator('.agent-chat__field').waitFor();
    return sent;
}

const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');
const promptLines = (page: Page) =>
    page.locator('.agent-chat__input .cm-line').allTextContents();

for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
]) {
    test.describe(`phone ${size.width}x${size.height}`, () => {
        // Firefox не умеет isMobile, ему хватает сенсорного экрана без мыши
        test.use({
            viewport: size,
            hasTouch: true,
            isMobile: async ({ browserName }, provide) =>
                provide(browserName !== 'firefox'),
        });

        test('enter-breaks-the-line-and-the-button-sends', async ({ page }) => {
            const sent = await openChat(page);

            await promptField(page).tap();
            await page.keyboard.type('первая строка');
            await page.keyboard.press('Enter');
            // на Android CodeMirror придерживает Enter до изменения DOM, ждём переноса
            await expect
                .poll(() => promptLines(page))
                .toEqual(['первая строка', '']);
            await page.keyboard.type('вторая строка');

            await expect
                .poll(() => promptLines(page))
                .toEqual(['первая строка', 'вторая строка']);
            expect(sent).toEqual([]);

            await page.getByRole('button', { name: 'Send' }).tap();

            await expect.poll(() => sent.length).toBe(1);
            expect(JSON.stringify(sent[0])).toContain(
                'первая строка\\nвторая строка'
            );
        });
    });
}

test.describe('desktop', () => {
    test.use({ viewport: { width: 1360, height: 900 } });

    // с клавиатурой всё как раньше: Enter отправляет, Shift+Enter переносит
    test('enter-sends-with-a-keyboard', async ({ page, hasTouch }) => {
        test.skip(hasTouch, 'проект сенсорного устройства без мыши');
        const sent = await openChat(page);

        await promptField(page).click();
        await page.keyboard.type('первая');
        await page.keyboard.press('Shift+Enter');
        await page.keyboard.type('вторая');
        await page.keyboard.press('Enter');

        await expect.poll(() => sent.length).toBe(1);
        expect(JSON.stringify(sent[0])).toContain('первая\\nвторая');
    });
});
