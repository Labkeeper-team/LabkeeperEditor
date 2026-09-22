import { test, expect, devices, Page, CDPSession } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

// defaultBrowserType нельзя менять внутри файла, остальное от Pixel 7 берём целиком
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const { defaultBrowserType, ...pixel7 } = devices['Pixel 7'];
test.use({ ...pixel7 });
// файл эмулирует Chrome на Android, в WebKit и Firefox нет ни CDP для щипка, ни такого устройства
test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'щипок синтезируется через CDP, он есть только в Chromium'
);

const PROGRAM = {
    segments: [
        {
            id: 1,
            type: 'latex' as const,
            parameters: { visible: true },
            text: '\\section{Title}\n\nsome text',
        },
        {
            id: 2,
            type: 'latex' as const,
            parameters: { visible: true },
            text: 'second segment\n\nmore',
        },
    ],
    parameters: { roundStrategy: 'noRound' as const },
};

// минимальный PDF на одну страницу A4, pdf.js его рисует; он весь в ASCII, так что строка годится как тело
const PDF =
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n' +
    'trailer<</Root 1 0 R>>\n%%EOF\n';

// клавиатура Android при interactive-widget=resizes-content сжимает окно, в эмуляции это смена его высоты
const FULL_HEIGHT = 839;
const KEYBOARD_OPEN_HEIGHT = 489;

async function openLatexProjectWithPdf(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    routeSetup.setupLatexProject();
    await routeSetup.setupGetProjectRequest(200, 'default', PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesCustom([
        { fileName: 'main.pdf', url: '/files/main.pdf' },
    ]);
    await routeSetup.setupAgentHistoryRequest([]);
    await page.route(
        (url) => url.pathname === '/files/main.pdf',
        (route) => route.fulfill({ contentType: 'application/pdf', body: PDF })
    );
    await page.goto(`/project/${uuid}`);
    await page.locator('[data-pdf-page="0"] canvas').waitFor();
}

async function openEditorAndFocusSegment(page: Page) {
    await openLatexProjectWithPdf(page);
    await page.locator('.mobile-view-switcher-bar__toggle').click();
    await page.getByRole('option', { name: 'Editor' }).click();
    await page.locator('.cm-content').nth(1).click();
}

const readViewport = (page: Page) =>
    page.evaluate(() => ({
        scale: window.visualViewport!.scale,
        innerHeight: window.innerHeight,
        appHeight: parseFloat(
            document.documentElement.style.getPropertyValue('--inner-height')
        ),
    }));

const topOf = (page: Page, selector: string) =>
    page
        .locator(selector)
        .first()
        .evaluate((el) => Math.round(el.getBoundingClientRect().top));

// дробные высоты на разных DPR округляются по-разному, поэтому допуск в пиксель
function expectNear(actual: number, expected: number) {
    expect(
        Math.abs(actual - expected),
        `${actual} вместо ${expected}`
    ).toBeLessThanOrEqual(1);
}

async function expectAppHeight(page: Page, expected: number) {
    await expect
        .poll(
            async () =>
                Math.abs((await readViewport(page)).appHeight - expected),
            { message: `на сколько --inner-height отходит от ${expected}` }
        )
        .toBeLessThanOrEqual(1);
}

async function pinchZoom(page: Page, cdp: CDPSession, scaleFactor: number) {
    const before = (await readViewport(page)).scale;
    // приложение подписано на resize раньше, так что к этому событию его обработчик уже отработал
    const resized = page.evaluate(
        () =>
            new Promise<void>((resolve) =>
                window.visualViewport!.addEventListener(
                    'resize',
                    () => resolve(),
                    { once: true }
                )
            )
    );
    // синтез жеста щипка на windows-раннере не срабатывает, а масштаб страницы задаётся напрямую в любой среде
    await cdp.send('Emulation.setPageScaleFactor', {
        pageScaleFactor: before * scaleFactor,
    });
    await resized;
    // без этой проверки тест прошёл бы и там, где масштаб не сменился
    await expect
        .poll(async () => (await readViewport(page)).scale)
        .toBeGreaterThan(before * scaleFactor * 0.95);
}

test('pdf-layout-survives-pinch-zoom-on-android', async ({ page }) => {
    await openLatexProjectWithPdf(page);
    const saveTop = await topOf(page, '.save-to-pdf-button');
    const instructionTop = await topOf(
        page,
        '.labkeeper-instruction-container'
    );
    const cdp = await page.context().newCDPSession(page);

    await pinchZoom(page, cdp, 2);

    expectNear((await readViewport(page)).appHeight, FULL_HEIGHT);
    expectNear(await topOf(page, '.save-to-pdf-button'), saveTop);
    expectNear(
        await topOf(page, '.labkeeper-instruction-container'),
        instructionTop
    );
});

test('editor-follows-keyboard-on-android', async ({ page }) => {
    await openEditorAndFocusSegment(page);
    const switcherTop = await topOf(page, '.mobile-view-switcher-bar');

    await page.setViewportSize({ width: 412, height: KEYBOARD_OPEN_HEIGHT });
    await expectAppHeight(page, KEYBOARD_OPEN_HEIGHT);
    expect(await topOf(page, '.mobile-view-switcher-bar')).toBe(switcherTop);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    // курсор остался над клавиатурой
    const cursorTop = await topOf(page, '.cm-editor.cm-focused .cm-cursor');
    expect(cursorTop).toBeGreaterThan(switcherTop);
    expect(cursorTop).toBeLessThan(KEYBOARD_OPEN_HEIGHT);

    await page.setViewportSize({ width: 412, height: FULL_HEIGHT });
    await expectAppHeight(page, FULL_HEIGHT);
    expect(await topOf(page, '.mobile-view-switcher-bar')).toBe(switcherTop);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
});

test('keyboard-after-pinch-zoom-keeps-full-height', async ({ page }) => {
    await openEditorAndFocusSegment(page);
    const cdp = await page.context().newCDPSession(page);

    await pinchZoom(page, cdp, 2);
    await page.setViewportSize({ width: 412, height: KEYBOARD_OPEN_HEIGHT });

    await expectAppHeight(page, KEYBOARD_OPEN_HEIGHT);
});

// в режиме «Версия для ПК» Chrome ставит раскладку шириной 980, и visualViewport.scale меньше 1 уже в покое
test('desktop-site-layout-fills-the-screen-and-ignores-pinch', async ({
    page,
}) => {
    await openLatexProjectWithPdf(page);
    await page.evaluate(() =>
        document
            .querySelector('meta[name=viewport]')!
            .setAttribute('content', 'width=980')
    );
    await expect
        .poll(() => page.evaluate(() => document.documentElement.clientWidth))
        .toBe(980);
    const { innerHeight } = await readViewport(page);
    expect(innerHeight).toBeGreaterThan(FULL_HEIGHT * 2);
    await expectAppHeight(page, innerHeight);
    const cdp = await page.context().newCDPSession(page);

    await pinchZoom(page, cdp, 2);

    expectNear((await readViewport(page)).appHeight, innerHeight);
});

// на iOS window.scrollY при щипке ведёт визуальный вьюпорт, в Chromium его так и подменяем
test('pinch-zoom-pan-is-not-reset-where-scroll-follows-the-visual-viewport', async ({
    page,
}) => {
    await page.addInitScript(() => {
        // сдвиг панорамы задаёт тест: жест прокрутки через CDP тоже работает не везде
        const panned = window as unknown as { panOffset: number };
        panned.panOffset = 0;
        Object.defineProperty(window, 'scrollY', {
            configurable: true,
            get: () => panned.panOffset,
        });
        const resets: number[] = [];
        (window as unknown as { resets: number[] }).resets = resets;
        const scrollTo = window.scrollTo.bind(window);
        window.scrollTo = ((...args: [number, number]) => {
            // первые кадры щипка ещё почти без зума, там сброс прежний
            if (window.visualViewport!.scale > 1.01) {
                resets.push(window.visualViewport!.offsetTop);
            }
            scrollTo(...args);
        }) as typeof window.scrollTo;
    });
    await openLatexProjectWithPdf(page);
    const cdp = await page.context().newCDPSession(page);

    await pinchZoom(page, cdp, 2);
    // панорама увеличенной страницы: на iOS scrollY становится сдвигом, и визуальный вьюпорт шлёт scroll
    await page.evaluate(() => {
        (window as unknown as { panOffset: number }).panOffset = 200;
        window.visualViewport!.dispatchEvent(new Event('scroll'));
    });

    expect(
        await page.evaluate(
            () => (window as unknown as { resets: number[] }).resets
        )
    ).toEqual([]);
});
