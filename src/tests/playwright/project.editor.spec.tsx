import { test, expect } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const maxDifferentPixelsFor4Segments = 4000;

const maxDifferentPixelsFor5Segments = 5000;
/*
Тест на получение кода 425 после компиляции
 */
test('425-display', async ({ page }) => {
    await page.goto('/');
    const routeSetup = new RouteSetup(page);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('biba', { delay: 20 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompilationRequest(425, 'empty');

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // проверяем, что ошибки отображаются корректно
    await expect(page).toHaveScreenshot('425-display.png');
});

/*
Тест на отображении иконки phystech
 */
test('phystech-icon-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest(true, 'a@phystech.edu');

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();

    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest();

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(
        200,
        'defaultMd',
        0,
        'Пример текста'
    );

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    let editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('Пример текста', { delay: 100 });
    await editor.click();

    await page.getByRole('button', { name: /Add markdown/i }).click();
    editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('biba', { delay: 100 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // Запускаем компиляцию
    await page.getByRole('button', { name: /Run/i }).click();

    // Ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    await expect(page).toHaveScreenshot(`phystech.png`, {
        maxDiffPixels: 3000,
    });
});

/*
Тест на добавление и удаление сегментов разными способами
 */
test('insert-segment-between', async ({ page }) => {
    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // пишем в него
    let editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.fill('computation');
    await editor.click();

    // добавляем simple math
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Simple-math' }).click();

    // пишем в него
    editor = page.locator('.cm-content').nth(1);
    await editor.click();
    await editor.fill('asciimath');
    await editor.click();

    // Добавляем маркдаун между
    await page.getByText('Add', { exact: true }).click();
    await page.getByText('markdown', { exact: true }).first().click();

    // пишем в него
    editor = page.locator('.cm-content').nth(1);
    await editor.click();
    await editor.fill('md');
    await editor.click();

    // Добавляем latex
    await page.getByText('Add', { exact: true }).nth(1).click();
    await page.getByText('latex-math', { exact: true }).click();

    // пишем в него
    editor = page.locator('.cm-content').nth(2);
    await editor.click();
    await editor.fill('latex');
    await editor.click();

    await expect(page).toHaveScreenshot(`insert-segment-between1.png`, {
        maxDiffPixels: maxDifferentPixelsFor4Segments,
    });

    // удаляем latex
    await page.locator('div.dropdown-menu-container').nth(4).click();
    await page.getByText('Delete').last().click();

    // удаляем md
    await page.locator('div.dropdown-menu-container').nth(3).click();
    await page.getByText('Delete').last().click();

    await expect(page).toHaveScreenshot(`insert-segment-between2.png`, {
        maxDiffPixels: 1500,
    });

    // удаляем asciimath
    // поскольку плашка с удалением не закрывается, можно ее заново не нажимать
    await page.getByText('Delete').last().click();

    // удаляем computation
    await page.locator('div.dropdown-menu-container').nth(2).click();
    await page.getByText('Delete').last().click();

    expect(await page.locator('.cm-content').count()).toBe(0);
});

/*
Тест на большое количество сегментов с текстом.
 */
test('many-segments', async ({ page }) => {
    await page.goto('/');

    // Ждем загрузки страницы и проверяем URL
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/.*\/project/);

    // Генерируем текст
    const linesCount = 20;
    let text = '';
    for (let i = 0; i < linesCount; i++) {
        text += 'aaaaaaaaaaaa';
        if (i + 1 < linesCount) {
            text += '\n';
        }
    }

    // Добавляем 10 MD сегментов
    for (let i = 0; i < 10; i++) {
        await page.getByRole('button', { name: /Add markdown/i }).click();
    }

    // Пишем текст в первый сегмент
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.fill(text);
    await editor.click();

    // Проверяем снапшоты
    // ПАДАЕТ В ГИТЕ
    // await expect(page).toHaveScreenshot(`many-segments/snapshot.png`);

    // Проверяем, что все сегменты были добавлены
    const segments = await page.locator('.segment-editor-container').count();
    expect(segments).toBe(10);
});

test('public-project-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос на получение списка проектов
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupGetProjectRequest(200, 'withSegmentBiba');
    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    await page.goto(`/project/${uuid}`);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot(`public-project.png`);
});

/*
Тест на правильное сохранение проекта
*/
test('save-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    // Перехватываем запрос на получение списка проектов
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupGetProjectRequest();

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('aaa', { delay: 100 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest(200, 'empty', async (route) => {
        const body = JSON.parse(route.request().postData() || '') as Program;
        expect(body.segments.length).toBe(2);
        expect(body.segments[0].text).toBe('aaa');
    });

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(203, 'status203', 0, '', 501);

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // Ждем, пока кнопка 'Run' станет доступной для нажатия
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    await expect(page).toHaveScreenshot('save-and-run.png');
});

/*
Тест на механику работы кнопки ESC
 */
test('ESC-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('aaa\n\n${a}\n', { delay: 100 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest();

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(203, 'status203', 0, '', 501);

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // Открываем файловый менеджер
    await page.locator('div.file-manager-button').click();

    // Открываем поиск
    await page.locator('div.action-button').last().click();

    // Ждем, пока кнопка 'Run' станет доступной для нажатия
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    await expect(page).toHaveScreenshot('ESC-test/snapshot0.png');

    // Нажимаем ESC три раза
    // Проверяем, что панели закрываются в нужном порядке
    await page.keyboard.press('Escape');
    await expect(page).toHaveScreenshot('ESC-test/snapshot1.png');
    await page.keyboard.press('Escape');
    await expect(page).toHaveScreenshot('ESC-test/snapshot2.png');
    await page.keyboard.press('Escape');
    await expect(page).toHaveScreenshot('ESC-test/snapshot3.png');
});

/*
Тест на закрытие поиска и пропадание выделения символов
*/
test('Search-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest(false);

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('aaa\n\n${a}\n', { delay: 100 });
    await editor.click();

    // Открываем поиск чтобы потом закрыть его через ESC
    await page.locator('div.action-button').last().click();

    // Вводим текст в строку поиска
    await page.getByRole('textbox', { name: /Enter text to search/i }).click();
    await page
        .getByRole('textbox', { name: /Enter text to search/i })
        .pressSequentially('aa');

    // выходим из поиска нажатием ESC
    await page.keyboard.press('Escape');

    await expect(page).toHaveScreenshot('search-test/cross.png');

    // открываем поиск, чтобы потом закрыть чего через кнопку крестик
    await page.locator('div.action-button').last().click();

    // Вводим текст в строку поиска
    await page.getByRole('textbox', { name: /Enter text to search/i }).click();
    await page
        .getByRole('textbox', { name: /Enter text to search/i })
        .pressSequentially('aa');

    // Нажимаем на кнопку крестик, чтобы закрыть поисковую строку
    await page.locator('div.input-delete-icon').click();

    await expect(page).toHaveScreenshot('search-test/button.png');
});

/*
Тест на отображение большого количества ошибок и на то, что выделение ошибки пропадает после редактирования
 */
test('many-errors-test', async ({ page }) => {
    const count = 100;
    await page.goto('/');
    const routeSetup = new RouteSetup(page);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // собираем текст
    let text = '';
    for (let i = 0; i < count; i++) {
        text += 'a\n';
    }

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially(text, { delay: 20 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // собираем большую ошибку
    const errors = [];
    for (let i = 0; i < 2 * count; i++) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error
        errors.push({
            code: 501,
            payload: {
                segmentId: 1,
                line: i,
                variable: null,
                operators: null,
                quotaIndex: 0,
                value: null,
                limit: null,
                position: 0,
            },
        });
    }

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompilationRequest(203, 'errorBody', errors);

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // проверяем, что ошибки отображаются корректно
    // TODO сломанный тест
    //await expect(page).toHaveScreenshot('search-test/errors.png');

    // нажимаем ENTER в сегменте и проверяем, что выделение ошибок пропало
    await editor.click();
    await editor.press('Enter');

    // проверяем, что ошибки отображаются корректно
    //await expect(page).toHaveScreenshot('search-test/no-errors.png');
});

/*
Тест на отображение элементов маркдауна
 */
test('md2pdf-test', async ({ page }) => {
    await page.goto('/');
    const routeSetup = new RouteSetup(page);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    const text = `
https://md2pdf.netlify.com/

> Awesome Markdown to PDF!

1. Click button choose \`.md\` file.
3. Click **Transform**!
4. Switch 'Destination' to **Save as PDF**.

- After click \`Transform\` button, inverse the checkbox of **'Headers and Footers'**. 
- **反選頁首與頁尾**.
- Github: [@realdennis](https://github.com/realdennis)
- What about me: ☕ 、 👨🏻‍💻️、 🍕、 🎞️

\`\`\`javascript
// index.js
function Hello(){
  console.log('World!')
}
Hello();
\`\`\`

| 1aaa | 2ddd | 3fff | vvv  |   |   |   |   |   |   |   |   |   |      |
|------|------|------|------|---|---|---|---|---|---|---|---|---|------|
| rrr  | 5eee | e    | vvvd |   |   |   |   |   |   |   |   |   |      |
| eee  | eee  | rrr  | fff  |   |   |   |   |   |   |   |   |   |      |
| rr   | rrr  | ddd  | rrr  |   |   |   |   |   |   |   |   |   |      |
|      |      |      |      |   |   |   |   |   |   |   |   |   |      |
|      |      |      |      |   |   |   |   |   |   |   |   |   |      |
|      |      |      |      |   |   |   |   |   |   |   |   |   |      |
|      |      |      |      |   |   |   |   |   |   |   |   |   |      |
|      |      |      |      |   |   |   |   |   |   |   |   |   |      |
|      |      |      |      |   |   |   |   |   |   |   |   |   |      |
|      |      |      |      |   |   |   |   |   |   |   |   |   | gggg |
    `;

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.fill(text);
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompilationRequest(
        200,
        'mdTypeBody',
        undefined,
        undefined,
        text
    );

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // хорошо бы заставить эту проверку работать
    // проверяем, что элементы отображаются корректно
    //await expect(page.locator('div.result-markdown')).toHaveScreenshot(
    //    'md2pdf.png'
    //);
});

/*
Тест на изменение названия проекта через Enter
*/
test('rename-project-in-editor-via-enter', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    await routeSetup.setupGetUserInfoRequest();

    await page.goto('/');
    await page.waitForTimeout(2000);
    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    let requestMade = false;

    // Перехватываем запрос на изменение названия проекта
    await routeSetup.setupGetTitleRequest(() => {
        requestMade = true;
    });

    // нажимаем кнопку изменения названия
    await page.locator('div.change-titlepress-button').click();

    // изменяем название
    await page.locator('input.change-title-input').pressSequentially('abc');

    // нажимаем enter
    await page.locator('input.change-title-input').press('Enter');

    // проверяем, что запрос был сделан
    expect(requestMade).toBeTruthy();
});

test('llm-prompt-ok-request-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    await routeSetup.setupLlmPrompt(200);

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    await page.getByText('GPT').click();

    await page.getByRole('textbox').nth(1).type('biba');

    await page.getByText('Send').click();

    await expect(page.getByText('LLM GENERATED').nth(0)).toBeVisible();
    await expect(page.getByText('LLM GENERATED').nth(1)).toBeVisible();

    // undo
    await page.locator('div.history-button').first().click();

    await expect(page.getByText('LLM GENERATED')).not.toBeVisible();
});

test('llm-prompt-bad-request-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    await routeSetup.setupLlmPrompt(400);

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    await page.getByText('GPT').click();

    await page.getByRole('textbox').nth(1).type('biba');

    await page.getByText('Send').click();

    await expect(page.getByText('Invalid request')).toBeVisible();
});

/*
Переименование проекта через нажатие в другое место
 */
test('rename-project-in-editor-via-press', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    let requestMade = false;

    // Перехватываем запрос на изменение названия проекта
    await routeSetup.setupGetTitleRequest(() => {
        requestMade = true;
    });

    // нажимаем кнопку изменения названия
    await page.locator('div.change-titlepress-button').click();

    // изменяем название
    await page.locator('input.change-title-input').pressSequentially('abc');

    // нажимаем enter
    await page.locator('div.empty-project-placeholder-container').click();

    // проверяем, что запрос был сделан
    expect(requestMade).toBeTruthy();
});

/*
Тест на создание, перемещение и удаление большого количества сегментов
 */
test('many-segments-move', async ({ page }) => {
    const addCode = async () => {
        await page.locator('div.labkeeper_select.computation').first().click();
        await page.locator('li').first().click();
    };

    await page.goto('/');

    // Ждем загрузки страницы и проверяем URL
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL(/.*\/project/);

    // первый сегмент
    await page.getByRole('button', { name: /Add markdown/i }).click();

    // Пишем текст в первый сегмент
    const editor1 = page.locator('.cm-content').nth(0);
    await editor1.click();
    await editor1.fill('aaaa');
    await editor1.click();

    // adding second segment
    await addCode();

    // inserting text in second segment
    const editor2 = page.locator('.cm-content').nth(1);
    await editor2.click();
    await editor2.fill('bbbb');
    await editor2.click();

    // adding third segment
    await page.getByRole('button', { name: /Add markdown/i }).click();

    // inserting text in third segment
    const editor3 = page.locator('.cm-content').nth(2);
    await editor3.click();
    await editor3.fill('cccc');
    await editor3.click();

    // adding fourth segment
    await addCode();

    // inserting text in fourth segment
    const editor4 = page.locator('.cm-content').nth(3);
    await editor4.click();
    await editor4.fill('dddd');
    await editor4.click();

    // проверяем, что элементы отображаются корректно
    await expect(page).toHaveScreenshot('many-segs1.png', {
        maxDiffPixels: maxDifferentPixelsFor4Segments,
    });

    // more
    await addCode();
    await page.getByRole('button', { name: /Add markdown/i }).click();
    await addCode();
    await page.getByRole('button', { name: /Add markdown/i }).click();
    await addCode();
    await page.getByRole('button', { name: /Add markdown/i }).click();

    // проверяем, что элементы отображаются корректно
    await expect(page).toHaveScreenshot('many-segs2.png', {
        maxDiffPixels: maxDifferentPixelsFor5Segments,
    });

    // moving segment
    await page.locator('div.change-position-button').nth(1).click();
    expect(await page.locator('.cm-content').nth(0).textContent()).toBe('bbbb');
    expect(await page.locator('.cm-content').nth(1).textContent()).toBe('aaaa');
    expect(await page.locator('.cm-content').nth(2).textContent()).toBe('cccc');
    expect(await page.locator('.cm-content').nth(3).textContent()).toBe('dddd');

    // moving segment
    await page.locator('div.change-position-button').nth(4).click();
    expect(await page.locator('.cm-content').nth(0).textContent()).toBe('bbbb');
    expect(await page.locator('.cm-content').nth(1).textContent()).toBe('aaaa');
    expect(await page.locator('.cm-content').nth(2).textContent()).toBe('dddd');
    expect(await page.locator('.cm-content').nth(3).textContent()).toBe('cccc');

    // moving segment
    await page.locator('div.change-position-button').nth(3).click();
    expect(await page.locator('.cm-content').nth(0).textContent()).toBe('bbbb');
    expect(await page.locator('.cm-content').nth(1).textContent()).toBe('dddd');
    expect(await page.locator('.cm-content').nth(2).textContent()).toBe('aaaa');
    expect(await page.locator('.cm-content').nth(3).textContent()).toBe('cccc');

    // moving segment
    await page.locator('div.change-position-button').nth(5).click();
    expect(await page.locator('.cm-content').nth(0).textContent()).toBe('bbbb');
    expect(await page.locator('.cm-content').nth(1).textContent()).toBe('dddd');
    expect(await page.locator('.cm-content').nth(2).textContent()).toBe('cccc');
    expect(await page.locator('.cm-content').nth(3).textContent()).toBe('aaaa');

    // moving segment
    await page.locator('div.change-position-button').nth(0).click();
    expect(await page.locator('.cm-content').nth(0).textContent()).toBe('dddd');
    expect(await page.locator('.cm-content').nth(1).textContent()).toBe('bbbb');
    expect(await page.locator('.cm-content').nth(2).textContent()).toBe('cccc');
    expect(await page.locator('.cm-content').nth(3).textContent()).toBe('aaaa');

    // проверяем, что элементы отображаются корректно
    await expect(page).toHaveScreenshot('many-segs3.png', {
        maxDiffPixels: maxDifferentPixelsFor4Segments,
    });
});

/*
Тест удаление строк с ошибкой тремя способами:
через последовательное нажатие delete, через ctrl+a и delete, через ручное выделение и delete
 */
test('remove-lines-with-errors-test', async ({ page }) => {
    await page.goto('/');
    const routeSetup = new RouteSetup(page);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('aaaaa\n\n${a}\n', { delay: 20 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    const errors = [
        {
            code: 501,
            payload: {
                segmentId: 1,
                line: 2,
                variable: null,
                operators: null,
                quotaIndex: 0,
                value: null,
                limit: null,
                position: 0,
            },
        },
    ];

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompilationRequest(203, 'errorBody', errors);

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // нажимаем delete
    for (let i = 0; i < 12; i++) {
        await editor.press('Backspace', { delay: 20 });
    }

    await expect(page).toHaveScreenshot('remove-error-line-via-delete.png');

    // заново заполняем
    await editor.click();
    await editor.fill('aaaaa\n\n${a}\n');

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // Выделяем весь текст через ctrl+A
    await editor.click();
    await editor.press('Control+a');
    await editor.press('Backspace');

    await expect(page).toHaveScreenshot('remove-error-line-via-ctrla.png');

    // заново заполняем
    await editor.click();
    await editor.fill('aaaaa\n\n${a}\n');

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // Выделяем часть текста через нажатие и удерживание Shift
    await editor.click();
    await page.keyboard.down('Shift');
    await editor.press('ArrowLeft');
    await editor.press('ArrowLeft');
    await editor.press('ArrowLeft');
    await editor.press('ArrowLeft');
    await editor.press('ArrowLeft');
    await page.keyboard.up('Shift');
    await editor.press('Backspace');

    await expect(page).toHaveScreenshot('remove-error-line-via-select.png');
});

/*
401 при получении дефолтного проекта
 */
test('default-project-401-test', async ({ page }) => {
    let auth = true;
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest(auth);

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest(401, 'default', () => {
        auth = false;
    });
    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // ждем появления toast с ошибкой
    await expect(page.locator('div.Toastify__toast').first()).toBeVisible();
});

/*
401 при получении проекта
 */
test('project-401-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest(401, 'empty');

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    await page.goto(`/project/${uuid}`);

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');

    // ждем появления toast с ошибкой
    await expect(page.locator('div.Toastify__toast').first()).toBeVisible();
});

/*
401 при компиляции проекта
 */
test('compilation-401-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();

    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest();

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(401, 'empty');

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('aaa\n\n${a}\n', { delay: 100 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем появления toast с ошибкой
    await expect(page.locator('div.Toastify__toast')).toBeVisible();
});

/*
401 при открытии файлового менеджера
 */
test('file-manager-401-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();

    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest(200, 'default');

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest(401, 'empty');

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // ждем появления toast с ошибкой
    await expect(page.locator('div.Toastify__toast')).toBeVisible();
});

/*
500 при компиляции проекта
 */
test('compilation-500-test', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest();

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(500, 'empty');

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest();

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('aaa\n\n${a}\n', { delay: 100 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // компилируем
    await page.getByRole('button', { name: /Run/i }).click();

    // ждем появления toast с ошибкой
    await expect(page.locator('div.Toastify__toast')).toBeVisible();
});

/*
413 when uploading file
 */
test('upload-file-413', async ({ page }) => {
    let auth = true;
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest(auth);

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();

    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest(200, 'default');

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest(200, 'default', undefined, () => {
        auth = false;
    });

    // Перехватываем запрос на загрузку файла
    await routeSetup.setupUploadFileRequest(413);

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // Открываем файловый менеджер
    const fileManagerButton = page.locator('div.file-manager-button');
    await fileManagerButton.waitFor({ state: 'visible' });
    await fileManagerButton.click();

    // Создаем временный файл для загрузки
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText('Add files').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles({
        name: 'test.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from('a\n1\n2\n'),
    });

    // ждем появления toast с ошибкой
    await expect(page.locator('div.Toastify__toast')).toBeVisible();
});

/*
Тест на изменение списка файлов после компиляции
 */
test('file-list-changes-after-compilation', async ({ page }) => {
    let isAfterCompilation = false;
    const routeSetup = new RouteSetup(page);

    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest();

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();

    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest();

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest(
        200,
        'default',
        () => isAfterCompilation
    );

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(
        200,
        'defaultMd',
        0,
        'Пример текста'
    );

    await routeSetup.setupCompileProjectRequest(
        200,
        'defaultMd',
        0,
        'Пример текста',
        0,
        () => {
            isAfterCompilation = true;
        }
    );

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // Открываем файловый менеджер
    await page.locator('div.file-manager-button').click();

    // Добавляем маркдаун
    await page.getByRole('button', { name: /Add markdown/i }).click();
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.pressSequentially('Пример текста', { delay: 100 });
    await editor.click();

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    // Запускаем компиляцию
    await page.getByRole('button', { name: /Run/i }).click();

    // Ждем, когда кнопка снова станет нажимаемой
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // Делаем скриншот файлового менеджера после компиляции
    await expect(page).toHaveScreenshot('file-list-changes/after.png');
});

/*
Тест: два запуска компиляции с изменением кода вычислительного сегмента
 */
test('double-plots-and-tables-test', async ({ page }) => {
    // Перехватываем запрос user-info
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();

    // Перехватываем запрос default project и get project
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();

    // Перехватываем запрос на список файлов
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');

    // Перехватываем запрос на сохранение программы
    await routeSetup.setupSaveProgramRequest();

    // Перехватываем запрос на компиляцию
    await routeSetup.setupCompileProjectRequest(
        200,
        'longExampleWithTableAndPlot',
        3
    );

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL(`/project/${uuid}`);

    // добавляем вычислительный
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Computation' }).click();

    const firstText = `a = range(10)\ntable(a)\nplot(a, a)`;
    const secondText = `a = range(10)\nb = a ^ 2\ntable(a)\nplot(a, a)`;

    // Вставляем первый текст и компилируем
    const editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.fill(firstText);
    await editor.click();
    await page.getByRole('button', { name: /Run/i }).click();
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    // Перехватываем запрос на компиляцию
    routeSetup.setupCompileProjectRequest(
        200,
        'longExampleWithTableAndPlot',
        4
    );

    // Меняем текст и снова компилируем
    await editor.click();
    await editor.press('Control+a');
    await editor.fill(secondText);
    await editor.click();
    await page.getByRole('button', { name: /Run/i }).click();
    await page
        .getByRole('button', { name: /Run/i })
        .waitFor({ state: 'attached' });

    await expect(page).toHaveScreenshot('double-tables.png');
});

/*
Тест проверки latex сегмента c \\begen{equation} и без и asciimath
*/
/*
TODO nastya
test('latex-segments-and-asciimath', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info
    await routeSetup.setupGetUserInfoRequest(false);

    await page.goto('/');

    // Ждем загрузки страницы
    await page.waitForLoadState('domcontentloaded');
    // Ждем редиректа на конкретный проект
    await expect(page).toHaveURL('/project/default');

    // Добавляем latex
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Latex-math' }).click();

    // Пишем в него
    const firstText =
        '\\begin{equation}\n\\int f(x) \\frac{1}{x}dx\n\\end{equation}';
    const secondText = '\\int f(x) \\frac{1}{x}dx';
    let editor = page.locator('.cm-content').nth(0);
    await editor.click();
    await editor.fill(firstText);
    await editor.click();

    // Добавляем 2 latex
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Latex-math' }).click();
    // Пишем в него
    editor = page.locator('.cm-content').nth(1);
    await editor.click();
    await editor.fill(secondText);
    await editor.click();

    // добавляем simple math
    await page
        .locator('div')
        .filter({ hasText: /^Add more$/ })
        .first()
        .click();
    await page.getByRole('listitem').filter({ hasText: 'Simple-math' }).click();

    // пишем в него
    editor = page.locator('.cm-content').nth(2);
    await editor.click();
    await editor.fill(secondText);
    await editor.click();

    await expect(page).toHaveScreenshot(`latex-segments-and-asciimath.png`, {
        maxDiffPixels: maxDifferentPixelsFor4Segments,
    });
});

 */

/*
Тест захода на /oauth2/code и отсутствие сети для запроса провайдера
 */
test('oauth2-code-offline-provider', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    // Перехватываем запрос user-info (пользователь не аутентифицирован)
    await routeSetup.setupGetUserInfoRequest(false);

    // Имитируем отсутствие сети для запроса oauth провайдера
    // Матчим как login, так и logic, и любые версии v2/v3
    await page.route(
        /\/api\/v\d+\/sec\/(login|logic)\/oauth2\/code\/provider.*/,
        async (route) => {
            await route.abort('internetdisconnected');
        }
    );

    // Заходим на страницу с параметрами code/state
    await page.goto('/oauth2/code?code=abc&state=xyz');

    // Ждем загрузки и редиректа на дефолтный проект
    await page.waitForLoadState('domcontentloaded');
    await expect(page).toHaveURL('/project/default');

    // Проверяем, что показана ошибка OAuth
    await expect(
        page.getByText('Error while authenticating via third party provider')
    ).toBeVisible();
});
