import { expect, test, type Locator, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * Панель помощи под результатом: слайды с подсказками. Текст слайда не
 * обрезается, стрелки не лежат на тексте и картинке, а сама панель видна и
 * под вкладкой агента
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

async function openProject(page: Page, path = `/project/${uuid}`) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
    await expect(help(page)).toBeVisible();
}

const help = (page: Page) => page.locator('.labkeeper-instruction-container');
const slides = (page: Page) => help(page).locator('.instruction-slide');
const nextButton = (page: Page) =>
    help(page).locator('.nav-button.right .image-button');
const prevButton = (page: Page) =>
    help(page).locator('.nav-button.left .image-button');

/** Слайд, который сейчас на экране: остальные лежат рядом за краем панели */
async function waitForSlide(page: Page, index: number) {
    await expect
        .poll(async () => {
            const panel = await help(page).boundingBox();
            const slide = await slides(page).nth(index).boundingBox();
            return panel && slide ? Math.round(slide.x - panel.x) : null;
        })
        .toBe(0);
    return slides(page).nth(index);
}

type Box = { x: number; y: number; width: number; height: number };

const intersects = (a: Box, b: Box) =>
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height;

async function box(locator: Locator): Promise<Box> {
    const result = await locator.boundingBox();
    expect(result).not.toBeNull();
    return result!;
}

for (const [locale, title, points] of [
    [
        'ru-RU',
        'Создайте ваш первый документ',
        [
            'Добавьте сегмент: Markdown, LaTeX или «Вычисление» — и напишите текст, формулу или расчёт.',
            'Или опишите документ ИИ-агенту: он напишет проект сам.',
            'Нажмите «Выполнить»: справа появится результат, его можно сохранить в PDF.',
        ],
    ],
    [
        'en-US',
        'Create your first document',
        [
            'Add a Markdown, LaTeX, or Computation segment and write text, a formula, or a calculation.',
            'Or describe the document to the AI agent: it will write the project for you.',
            'Press Run: the result appears on the right and can be saved as a PDF.',
        ],
    ],
] as const) {
    test.describe(locale, () => {
        test.use({ locale });

        test('первый слайд зовёт создать первый документ', async ({ page }) => {
            await openProject(page);
            const first = await waitForSlide(page, 0);

            await expect(first.locator('.instruction-slide__title')).toHaveText(
                title
            );
            await expect(first.locator('.instruction-slide__point')).toHaveText(
                [...points]
            );
        });

        test('на каждом слайде текст виден целиком, а стрелки не лежат ни на тексте, ни на картинке', async ({
            page,
        }) => {
            await openProject(page);
            const count = await slides(page).count();
            expect(count).toBeGreaterThan(5);
            const titleTops: number[] = [];

            for (let index = 0; index < count; index++) {
                const slide = await waitForSlide(page, index);
                const list = slide.locator('.instruction-slide__points');
                // пункты не уходят под прокрутку
                expect(
                    await list.evaluate(
                        (node) => node.scrollHeight - node.clientHeight
                    ),
                    `слайд ${index}`
                ).toBeLessThanOrEqual(0);

                const text = await box(
                    slide.locator('.instruction-slide__text')
                );
                const image = await box(
                    slide.locator('.instruction-slide__image')
                );
                const panel = await box(help(page));
                for (const arrow of [prevButton(page), nextButton(page)]) {
                    const arrowBox = await box(arrow);
                    expect(intersects(arrowBox, text), `слайд ${index}`).toBe(
                        false
                    );
                    expect(intersects(arrowBox, image), `слайд ${index}`).toBe(
                        false
                    );
                }
                // картинка целиком внутри панели и не заходит на текст
                expect(image.x + image.width).toBeLessThanOrEqual(
                    panel.x + panel.width
                );
                expect(intersects(text, image), `слайд ${index}`).toBe(false);
                const titleBox = await box(
                    slide.locator('.instruction-slide__title')
                );
                titleTops.push(Math.round(titleBox.y - panel.y));

                if (index < count - 1) {
                    await nextButton(page).click();
                }
            }

            // заголовок на всех слайдах стоит на одной высоте
            expect(new Set(titleTops).size).toBe(1);
        });
    });
}

test('в узкой колонке слайд отдаёт всю ширину тексту', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openProject(page);
    const first = await waitForSlide(page, 0);

    await expect(first.locator('.instruction-slide__image')).toBeHidden();
    await expect(first.locator('.instruction-slide__title')).toBeVisible();
});

// Задача 155: под вкладкой агента помощь пропадала вместе с результатом
test('помощь видна и под вкладкой агента, на том же месте', async ({
    page,
}) => {
    await openProject(page);
    await page.getByRole('tab', { name: 'PDF visualization' }).click();
    await expect(page.locator('.agent-chat')).toHaveCount(0);
    const underPdf = await box(help(page));

    await page.getByRole('tab', { name: 'AI agent' }).click();

    await expect(page.locator('.agent-chat')).toBeVisible();
    await expect(help(page)).toBeVisible();
    await expect(slides(page).first()).toBeVisible();
    expect(await box(help(page))).toEqual(underPdf);
    // чат заканчивается над помощью, а не под ней
    const chat = await box(page.locator('.agent-chat'));
    expect(chat.y + chat.height).toBeLessThanOrEqual(underPdf.y + 0.5);
});

test('помощь под агентом сворачивается и разворачивается', async ({ page }) => {
    await openProject(page);
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect(slides(page).first()).toBeVisible();

    await help(page).locator('.expnad-container').click();

    await expect(slides(page)).toHaveCount(0);
    await expect(help(page)).toBeVisible();
});

// Под чатом помощь отнимает у него около 260px. Где ленте и полю запроса без
// того тесно, она остаётся только под результатом
test.describe('низкое окно', () => {
    test.use({ viewport: { width: 1360, height: 650 } });

    test('под чатом помощи нет, под результатом есть', async ({ page }) => {
        await openProject(page);
        await page.getByRole('tab', { name: 'AI agent' }).click();
        await expect(page.locator('.agent-chat')).toBeVisible();
        await expect(help(page)).toBeHidden();

        await page.getByRole('tab', { name: 'PDF visualization' }).click();

        await expect(help(page)).toBeVisible();
    });
});

test.describe('телефон', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('на экране агента помощи нет, на экране PDF есть', async ({
        page,
    }) => {
        const routeSetup = new RouteSetup(page);
        await routeSetup.setupGetUserInfoRequest(true);
        await routeSetup.acceptCrossBorderConsentLocally();
        await routeSetup.setupGetProjectRequest(200, 'default');
        await routeSetup.setupGetAllProjectsRequest();
        await routeSetup.setupSaveProgramRequest();
        await routeSetup.setupListFilesRequest(200, 'emptyFiles');
        await routeSetup.setupAgentHistoryRequest([]);
        await routeSetup.setupAgentSocket([]);
        await page.goto(`/project/${uuid}`);
        const switcher = page.locator('.mobile-view-switcher-bar__toggle');

        await switcher.click();
        await page.getByRole('option', { name: 'AI agent' }).click();
        await expect(page.locator('.agent-chat')).toBeVisible();
        await expect(help(page)).toBeHidden();

        await switcher.click();
        await page.getByRole('option', { name: 'PDF' }).click();
        await expect(help(page)).toBeVisible();
    });
});
