import { expect, test } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

/*
403 при получении проекта незалогиненным пользователем
 */
test('project-403-test', async ({ page }) => {
    let rejectedRequests = 0;
    const routeSetup = new RouteSetup(page);

    // Блокируем все запросы по умолчанию
    await routeSetup.setupApi(() => {
        rejectedRequests++;
    });

    // Разрешаем только необходимые запросы
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.setupGetProjectRequest(403, 'empty');

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    await page.goto(`/project/${uuid}`);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');

    // ждем появления toast с ошибкой
    await expect(page.locator('div.Toastify__toast').first()).toBeVisible();

    // Проверяем, что не было отклоненных запросов
    expect(rejectedRequests).toBe(0);
});

/*
404 при получении проекта незалогиненным пользователем
 */
test('project-404-test', async ({ page }) => {
    let rejectedRequests = 0;
    const routeSetup = new RouteSetup(page);

    // Блокируем все запросы по умолчанию
    await routeSetup.setupApi(() => {
        rejectedRequests++;
    });

    // Разрешаем только необходимые запросы
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.setupGetProjectRequest(404, 'empty');

    await page.goto(`/project/${uuid}`);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');

    // ждем появления toast с ошибкой
    await expect(page.locator('div.Toastify__toast').first()).toBeVisible();

    // Проверяем, что не было отклоненных запросов
    expect(rejectedRequests).toBe(0);
});

/*
Публичный проект: в localStorage для проекта задан режим latex, после захода нажимается кнопка компиляции
 */
test('public-project-latex-mode-from-localstorage-compilation', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);

    // Устанавливаем в localStorage режим latex для данного проекта до загрузки страницы (формат redux-persist)
    await page.addInitScript((projectUuid) => {
        const PERSIST_KEY = 'persist:PERSISTENCE';
        const state = {
            language: JSON.stringify('en'),
            lastProgram: JSON.stringify({
                segments: [],
                parameters: { roundStrategy: 'firstMeaningDigit' },
            }),
            instructionExpanded: JSON.stringify(true),
            projectCompileModes: JSON.stringify({ [projectUuid]: 'latex' }),
        };
        localStorage.setItem(PERSIST_KEY, JSON.stringify(state));
    }, uuid);

    await routeSetup.setupApi(() => {});

    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.setupGetProjectRequest(
        200,
        'withTwoSegmentsBibaAndAEqualTen'
    );

    await page.goto(`/project/${uuid}`);

    await page.waitForLoadState('domcontentloaded');

    // В режиме latex вызывается компиляция в PDF; перехватываем и возвращаем 401
    await routeSetup.setupCompileProjectPdfRequest(401);

    await page.getByRole('button', { name: /Run/i }).click();

    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    await expect(page.getByText('Authorization')).toBeVisible();
});

/*
Успешная компиляция публичного проекта незалогиненным пользователем
 */
test('public-project-unauth-user-compilation-ok', async ({ page }) => {
    let rejectedRequests = 0;
    const routeSetup = new RouteSetup(page);

    // Блокируем все запросы по умолчанию
    await routeSetup.setupApi(() => {
        rejectedRequests++;
    });

    // Разрешаем только необходимые запросы
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.setupGetProjectRequest(
        200,
        'withTwoSegmentsBibaAndAEqualTen'
    );

    await page.goto(`/project/${uuid}`);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(
        200,
        'defaultMd',
        0,
        '# biba\n\n'
    );

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // проверяем, что элементы отображаются корректно
    await expect(page).toHaveScreenshot('public-compile-ok.png');

    // Проверяем, что не было отклоненных запросов
    expect(rejectedRequests).toBe(0);
});

/*
Ошибка на запрет использования файлов анонимным юзером (308)
 */
test('public-project-unauth-user-compilation-308', async ({ page }) => {
    let rejectedRequests = 0;
    const routeSetup = new RouteSetup(page);

    // Блокируем все запросы по умолчанию
    await routeSetup.setupApi(() => {
        rejectedRequests++;
    });

    // Разрешаем только необходимые запросы
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.setupGetProjectRequest(
        200,
        'withTwoSegmentsBibaAndAEqualTen'
    );

    await page.goto(`/project/${uuid}`);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(203, 'status203', 0, '', 308);

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // проверяем, что элементы отображаются корректно
    await expect(page).toHaveScreenshot('public-compile-308.png');

    // Проверяем, что не было отклоненных запросов
    expect(rejectedRequests).toBe(0);
});

/*
Успешная компиляция публичного проекта другим пользователем
 */
test('public-project-different-user-compilation-ok', async ({ page }) => {
    let rejectedRequests = 0;
    const routeSetup = new RouteSetup(page);

    // Блокируем все запросы по умолчанию
    await routeSetup.setupApi(() => {
        rejectedRequests++;
    });

    // Разрешаем только необходимые запросы
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(
        200,
        'withTwoSegmentsBibaAndAEqualTen'
    );

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    await page.goto(`/project/${uuid}`);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');

    // перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(
        200,
        'defaultMd',
        0,
        '# biba\n\n'
    );

    // Открываем файловый менеджер
    await page.locator('div.file-manager-button').click();

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // проверяем, что элементы отображаются корректно
    await expect(page).toHaveScreenshot('different-user-public-compile-ok.png');

    // Проверяем, что не было отклоненных запросов
    expect(rejectedRequests).toBe(0);
});
