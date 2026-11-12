import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/** Меню настроек проекта в шапке редактора */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

async function openProject(page: Page, width: number) {
    await page.setViewportSize({ width, height: 943 });
    const routeSetup = new RouteSetup(page);
    routeSetup.setupLatexProject();
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await page.goto(`/project/${uuid}`);
    await page.locator('.ide-header').waitFor();
}

const menu = (page: Page) =>
    page
        .locator('.dropdown-menu-content-container')
        .filter({ has: page.locator('.project-settings-dropdown') });

async function openSettings(page: Page) {
    await page
        .locator('.code-settings-header-container .dropdown-menu-container')
        .first()
        .click();
    await expect(menu(page)).toBeVisible();
}

const box = async (page: Page, selector: string) => {
    const found = await page.locator(selector).first().boundingBox();
    expect(found, selector).not.toBeNull();
    return found!;
};

// GH-236: меню прижато к кнопке справа и растёт влево. С открытым менеджером
// файлов колонка редактора уже меню, и его левый край уходил под её обрезку
test('settings-menu-fits-the-editor-column-with-the-file-manager-open', async ({
    page,
}) => {
    await openProject(page, 1280);
    await page.locator('div.file-manager-button').click();
    await expect(page.locator('.manager-container')).toBeVisible();
    await openSettings(page);

    const column = await box(page, '.ide-container');
    const opened = await box(
        page,
        '.dropdown-menu-content-container:has(.project-settings-dropdown)'
    );
    expect(opened.x).toBeGreaterThanOrEqual(column.x);
    // пункты переносятся внутри меню, а не торчат из него
    const overflow = await menu(page).evaluate(
        (element) => element.scrollWidth - element.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(
        menu(page).getByText('First significant digit of the error')
    ).toBeVisible();
});

test('settings-menu-keeps-its-width-where-it-fits', async ({ page }) => {
    await openProject(page, 1700);
    await openSettings(page);

    await expect(menu(page)).not.toHaveClass(/--constrained/);
});

// GH-240: подсказка лежит внутри меню, а оно на широком экране держит пункты в
// одну строку. Текст подсказки шёл одной строкой и обрезался краем
test('export-hint-wraps-inside-its-width-on-a-wide-screen', async ({
    page,
}) => {
    await openProject(page, 1700);
    await openSettings(page);

    await page
        .locator('.project-export__option[data-export-format="labkeeper"]')
        .hover();
    const hint = page.locator('#project-export-hint');
    await expect(hint).toBeVisible();

    const { overflow, right } = await hint.evaluate((element) => ({
        overflow: element.scrollWidth - element.clientWidth,
        right: element.getBoundingClientRect().right,
    }));
    expect(overflow).toBeLessThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(1700);
});

// GH-254: окно сузили, пока меню открыто, и оно оставалось прежней ширины
test('settings-menu-narrows-with-the-window-while-it-is-open', async ({
    page,
}) => {
    await openProject(page, 1280);
    await page.locator('div.file-manager-button').click();
    await expect(page.locator('.manager-container')).toBeVisible();
    // без движения мыши: Chromium после смены размера сам двигает указатель,
    // и меню закрывается по mouseleave. Safari так не делает, и меню остаётся
    await page
        .locator('.code-settings-header-container .dropdown-menu-container')
        .first()
        .dispatchEvent('click');
    await expect(menu(page)).toBeVisible();

    await page.setViewportSize({ width: 900, height: 943 });

    await expect
        .poll(async () => {
            const column = await box(page, '.ide-container');
            const opened = await box(
                page,
                '.dropdown-menu-content-container:has(.project-settings-dropdown)'
            );
            return opened.x >= column.x;
        })
        .toBe(true);
    const overflow = await menu(page).evaluate(
        (element) => element.scrollWidth - element.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
});

// GH-254: в колонке редактора Safari 17 рисовал поверх подсказки панель
// агента, и текст обрывался на краю колонки. Подсказка живёт вне колонки
test('export-hint-lives-outside-the-editor-column', async ({ page }) => {
    await openProject(page, 1280);
    await page.locator('div.file-manager-button').click();
    await openSettings(page);

    await page
        .locator('.project-export__option[data-export-format="tex"]')
        .hover();
    const hint = page.locator('#project-export-hint');
    await expect(hint).toBeVisible();

    expect(
        await hint.evaluate(
            (element) => element.closest('.ide-container') === null
        )
    ).toBe(true);
    const column = await box(page, '.ide-container');
    const shown = await hint.boundingBox();
    // подсказка справа от меню и выходит за колонку: значит, её не обрезает и не накрывает соседняя панель
    expect(shown!.x + shown!.width).toBeGreaterThan(column.x + column.width);
});
