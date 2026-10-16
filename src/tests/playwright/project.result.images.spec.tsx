import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const svg = (width: number, height: number) =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#4469e0"/></svg>`;

// иконка меньше сегмента, картинка шире любого окна и она же с шириной из тега
const TEXT = [
    '![icon](/gh176/icon.svg)',
    '![photo](/gh176/photo.svg)',
    '<img src="/gh176/photo.svg" alt="sized" width="200">',
].join('\n\n');

const PROGRAM: Program = {
    segments: [
        { id: 1, type: 'md', text: TEXT, parameters: { visible: true } },
    ],
    parameters: { roundStrategy: 'noRound' },
};

test.use({ viewport: { width: 1360, height: 900 } });

async function openCompiledImages(page: Page) {
    await page.route('**/gh176/icon.svg', (route) =>
        route.fulfill({ contentType: 'image/svg+xml', body: svg(32, 32) })
    );
    await page.route('**/gh176/photo.svg', (route) =>
        route.fulfill({ contentType: 'image/svg+xml', body: svg(3000, 1500) })
    );
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    // markdown рисуется в браузере без сборки, а печать в PDF берёт этот же вид
    const images = page.locator('#result-segment-0 img');
    await expect(images).toHaveCount(3);
    await expect
        .poll(() =>
            images.evaluateAll((list) =>
                (list as HTMLImageElement[]).every(
                    (image) => image.complete && image.naturalWidth > 0
                )
            )
        )
        .toBe(true);
}

/** Размер картинки на экране и ширина текста сегмента, в которую она должна влезть */
const measure = (page: Page, alt: string) =>
    page.locator(`#result-segment-0 img[alt="${alt}"]`).evaluate((image) => {
        const content = image.closest('.result-markdown') as HTMLElement;
        // в пикселях раскладки: на узком окне страница масштабируется, и getBoundingClientRect дал бы уменьшенные
        const img = image as HTMLImageElement;
        return {
            width: img.offsetWidth,
            height: img.offsetHeight,
            room: content.clientWidth,
        };
    });

test('small-markdown-image-keeps-its-own-size', async ({ page }) => {
    await openCompiledImages(page);

    const icon = await measure(page, 'icon');
    // раньше любую картинку растягивало до 500px
    expect({ width: icon.width, height: icon.height }).toEqual({
        width: 32,
        height: 32,
    });
});

test('wide-markdown-image-fits-the-segment-and-keeps-proportions', async ({
    page,
}) => {
    await openCompiledImages(page);

    const before = await measure(page, 'photo');
    expect(before.width).toBe(before.room);
    expect(before.height).toBe(Math.round(before.width / 2));

    // окно уже, колонка результата уже: картинка идёт следом и не искажается
    await page.setViewportSize({ width: 1000, height: 900 });
    // колонка доезжает до новой ширины не сразу: ждём, пока картинка встанет по ней
    await expect
        .poll(async () => {
            const after = await measure(page, 'photo');
            return (
                after.width < before.width &&
                after.width === after.room &&
                after.height === Math.round(after.width / 2)
            );
        })
        .toBe(true);
});

test('markdown-image-width-from-the-html-tag-is-kept', async ({ page }) => {
    await openCompiledImages(page);

    const sized = await measure(page, 'sized');
    expect({ width: sized.width, height: sized.height }).toEqual({
        width: 200,
        height: 100,
    });
});
