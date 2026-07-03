import { test, expect } from '@playwright/test';
import { CompileError } from '../../model/domain.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

async function testError(page, error, name) {
    const routeSetUp = new RouteSetup(page);
    await routeSetUp.setupGetUserInfoRequest();
    await routeSetUp.setupGetDefaultProjectRequest();
    await routeSetUp.setupGetProjectRequest();
    await routeSetUp.setupGetAllProjectsRequest();
    await routeSetUp.setupListFilesRequest();
    await routeSetUp.setupSaveProgramRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // меняем тип на latex
    await page.locator('div.dropdown-menu-container').first().click();
    await page.getByText('markdown', { exact: true }).click();
    await page.getByText('Labkeeper').first().click();

    // Добавляем маркдаун
    await page
        .locator('.labkeeper_select.computation .select-header')
        .first()
        .click();
    await page
        .getByRole('listitem')
        .filter({ hasText: /^Markdown$/i })
        .click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('biba\nboba\n', { delay: 20 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('.labkeeper_select.computation .select-header')
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // Перехватываем запрос на компиляцию
    await routeSetUp.setupCompilationRequest(203, 'errorBody', [error]);

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    await expect(page).toHaveScreenshot(name + '.png', {
        maxDiffPixels: 1000,
    });
}

/*
Тест на отображение ошибки без детализации
 */
test('error-test-without-details', async ({ page }) => {
    await testError(
        page,
        {
            code: CompileError.CODE_NO_END_QUOTES,
            payload: {
                segmentId: 1,
                line: 1,
                variable: null,
                operators: null,
                quotaIndex: 0,
                value: null,
                limit: null,
                position: 0,
                functionName: null,
            },
        },
        'error-test-without-details'
    );
});

/*
Тест на отображение ошибки квоты
 */
test('error-test-quota', async ({ page }) => {
    await testError(
        page,
        {
            code: CompileError.QUOTA_EXCEEDED,
            payload: {
                segmentId: 1,
                line: 1,
                variable: null,
                operators: null,
                quotaIndex: 1,
                value: 3,
                limit: 3,
                position: 0,
                functionName: null,
            },
        },
        'error-test-quota'
    );
});

test('error-test-single-operator', async ({ page }) => {
    await testError(
        page,
        {
            code: CompileError.OPERATOR_EXPECTED,
            payload: {
                segmentId: 1,
                line: 1,
                variable: null,
                operators: ['('],
                quotaIndex: 0,
                value: 0,
                limit: 0,
                position: 0,
                functionName: null,
            },
        },
        'error-test-single-operator'
    );
});

test('error-test-many-operators', async ({ page }) => {
    await testError(
        page,
        {
            code: CompileError.OPERATOR_EXPECTED,
            payload: {
                segmentId: 1,
                line: 1,
                variable: null,
                operators: ['(', ')'],
                quotaIndex: 0,
                value: 0,
                limit: 0,
                position: 0,
                functionName: null,
            },
        },
        'error-test-many-operators'
    );
});

test('error-test-variable', async ({ page }) => {
    await testError(
        page,
        {
            code: CompileError.NO_SUCH_VARIABLE,
            payload: {
                segmentId: 1,
                line: 1,
                variable: 'my_var',
                operators: null,
                quotaIndex: 0,
                value: 0,
                limit: 0,
                position: 0,
                functionName: null,
            },
        },
        'error-test-variable'
    );
});

test('error-test-function', async ({ page }) => {
    await testError(
        page,
        {
            code: CompileError.NO_SUCH_FUNCTION,
            payload: {
                segmentId: 1,
                line: 1,
                variable: null,
                operators: null,
                quotaIndex: 0,
                value: 0,
                limit: 0,
                position: 0,
                functionName: 'my_func',
            },
        },
        'error-test-function'
    );
});
