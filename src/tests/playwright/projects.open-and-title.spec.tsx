import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const LONG_TITLE =
    'Лабораторная работа по общей физике: измерение ускорения свободного падения';

test.use({ viewport: { width: 1360, height: 900 } });

async function openProjects(page: Page, title = LONG_TITLE) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupProject();
    await routeSetup.setupListFilesRequest();
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.setupGetAllProjectsRequest(title);
    await page.goto('/projects');
    await page.locator('.project-title-text').first().waitFor();
}

const tooltip = (page: Page) => page.locator('#projects-title-tooltip');

// GH-207: длинное название обрезано, и полностью его видно при наведении
test('полное название длинного проекта всплывает при наведении', async ({
    page,
}) => {
    await openProjects(page);

    await page.locator('.project-title-text').first().hover();

    await expect(tooltip(page)).toBeVisible();
    await expect(tooltip(page)).toHaveText(LONG_TITLE);
});

test('у короткого названия подсказки нет', async ({ page }) => {
    await openProjects(page, 'Короткое');

    await page.locator('.project-title-text').first().hover();
    // подсказка всплывает сразу, ждать её дольше незачем
    await page.waitForTimeout(500);

    await expect(tooltip(page)).toHaveCount(0);
});

// GH-207: в шапке редактора название тоже обрезается, пока его не правят
test('полное название всплывает над названием в шапке редактора', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    routeSetup.setupProjectTitle(LONG_TITLE.repeat(2));
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupListFilesRequest(200, 'default');
    await page.goto(`/project/${uuid}`);

    await page.locator('input.change-title-input').hover();

    const headerTooltip = page.locator('#header-project-title-tooltip');
    await expect(headerTooltip).toBeVisible();
    await expect(headerTooltip).toHaveText(LONG_TITLE.repeat(2));
});

// GH-208: проект в списке это ссылка на его адрес, её меню и Ctrl открывают новую вкладку
test('название и дата проекта ведут ссылкой на его адрес', async ({ page }) => {
    await openProjects(page);

    const row = page.locator('tr').nth(1);
    const links = row.locator('a[href]');
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
        await expect(link).toHaveAttribute('href', `/project/${uuid}`);
    }
});

test('Ctrl и Cmd по названию открывают проект в новой вкладке', async ({
    page,
    context,
}) => {
    await openProjects(page);

    const popup = context.waitForEvent('page');
    await page
        .locator('.project-title-text')
        .first()
        .click({ modifiers: ['ControlOrMeta'] });

    const tab = await popup;
    await expect(tab).toHaveURL(new RegExp(`/project/${uuid}$`));
    // сама страница со списком осталась на месте
    await expect(page).toHaveURL(/\/projects$/);
});

// ссылку браузер открывает сам: страница не должна открыть вторую такую же вкладку
test('средняя кнопка по дате открывает ровно одну новую вкладку', async ({
    page,
    context,
}) => {
    await openProjects(page);

    const popup = context.waitForEvent('page');
    await page
        .locator('tr')
        .nth(1)
        .locator('a.projects-row-link')
        .click({ button: 'middle' });

    const tab = await popup;
    await expect(tab).toHaveURL(new RegExp(`/project/${uuid}$`));
    await page.waitForTimeout(500);
    expect(context.pages()).toHaveLength(2);
    await expect(page).toHaveURL(/\/projects$/);
});

const clickRowAwayFromLinks = async (
    page: Page,
    options: { button?: 'middle' } = {}
) => {
    const titleCell = page.locator('tr').nth(1).locator('td').first();
    const box = (await titleCell.boundingBox())!;
    await page.mouse.click(box.x + box.width - 4, box.y + box.height - 4, {
        button: options.button,
    });
};

test('средняя кнопка по пустому месту строки открывает новую вкладку', async ({
    page,
    context,
}) => {
    await openProjects(page);

    const popup = context.waitForEvent('page');
    await clickRowAwayFromLinks(page, { button: 'middle' });

    const tab = await popup;
    await expect(tab).toHaveURL(new RegExp(`/project/${uuid}$`));
    await expect(page).toHaveURL(/\/projects$/);
});

// мимо ссылок новую вкладку открывает сама страница
test('Ctrl по пустому месту строки тоже открывает новую вкладку', async ({
    page,
    context,
}) => {
    await openProjects(page);

    const popup = context.waitForEvent('page');
    await page.keyboard.down('ControlOrMeta');
    await clickRowAwayFromLinks(page);
    await page.keyboard.up('ControlOrMeta');

    const tab = await popup;
    await expect(tab).toHaveURL(new RegExp(`/project/${uuid}$`));
    await expect(page).toHaveURL(/\/projects$/);
});

test('простой щелчок открывает проект в той же вкладке', async ({
    page,
    context,
}) => {
    await openProjects(page);
    let opened = false;
    context.on('page', () => {
        opened = true;
    });

    await page.locator('.project-title-text').first().click();

    await expect(page).toHaveURL(new RegExp(`/project/${uuid}$`));
    expect(opened).toBe(false);
});
