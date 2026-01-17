import { test, expect } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

/*
Тест на переименование через кнопку enter
 */
test('rename-project-via-enter', async ({ page }) => {
    const routeSetup = new RouteSetup(page);

    // Перехватываем запрос default project и get project
    await routeSetup.setupProject();

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    // Перехватываем запрос на получение списка проектов
    await routeSetup.setupGetAllProjectsRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    await page.locator('button.image-button').first().click();

    await page.locator('div.change-icon-container').first().click();

    await page.locator('input.input-base').first().pressSequentially('abc');

    let requestMade = false;
    // Перехватываем запрос на изменение названия проекта
    await routeSetup.setupGetTitleRequest(() => {
        requestMade = true;
    });

    await page.locator('input.input-base').first().press('Enter');

    // проверяем, что запрос был сделан
    expect(requestMade).toBeTruthy();
});

/*
Тест на переименование через кнопку нажатие в другое место
 */
test('rename-project-via-press', async ({ page }) => {
    const routeSetup = new RouteSetup(page);

    // Перехватываем запрос default project и get project
    await routeSetup.setupProject();

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    // Перехватываем запрос на получение списка проектов
    await routeSetup.setupGetAllProjectsRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    await page.locator('button.image-button').first().click();

    await page.locator('div.change-icon-container').first().click();

    await page.locator('input.input-base').first().pressSequentially('abc');

    let requestMade = false;
    // Перехватываем запрос на изменение названия проекта
    await routeSetup.setupGetTitleRequest(() => {
        requestMade = true;
    });

    await page.locator('div.project-content-container').click();

    // проверяем, что запрос был сделан
    expect(requestMade).toBeTruthy();
});
