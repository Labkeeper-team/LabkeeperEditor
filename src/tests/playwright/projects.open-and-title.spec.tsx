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
