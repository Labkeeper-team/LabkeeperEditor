import { expect, test, type Page } from '@playwright/test';
import { Program } from '../../model/domain.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-246: над файлом .tex подсказка для новичка. Подключить файл она предлагает,
 * пока в проекте нет main.tex и сегменты не подключают ни одного файла, а над
 * main.tex в корне предупреждает, что сегменты при нём не учитываются
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({
    viewport: { width: 1280, height: 900 },
});

const CHAPTER = { fileName: 'chapter.tex', url: '/files/chapter.tex' };
const MAIN = { fileName: 'main.tex', url: '/files/main.tex' };

const program = (text: string): Program => ({
    segments: [{ id: 1, type: 'latex', text, parameters: { visible: true } }],
    parameters: { roundStrategy: 'noRound' },
});

async function openProject(
    page: Page,
    segmentText: string,
    files: (typeof CHAPTER)[]
) {
    // только моки: страница не ходит наружу
    await page.route(
        (url) => url.hostname !== 'localhost',
        (route) => route.abort()
    );
    const saved: Program[] = [];
    const routeSetup = new RouteSetup(page);
    routeSetup.setupLatexProject();
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(
        200,
        'default',
        program(segmentText)
    );
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest(200, 'empty', (route) => {
        saved.push(route.request().postDataJSON() as Program);
    });
    await routeSetup.setupListFilesCustom(files);
    for (const file of files) {
        await routeSetup.setupEditableTextFile(
            file.fileName,
            file.url,
            `Текст ${file.fileName}`
        );
    }
    await routeSetup.setupHunkRequestsWithState([]);

    await page.goto(`/project/${uuid}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({
        timeout: 15_000,
    });
    await page.locator('div.file-manager-button').click();
    return saved;
}

/** Открывает файл и ждёт его текст: только после этого можно судить, что полосы нет */
async function openFile(page: Page, file: string) {
    await page
        .locator('.tree-row-label')
        .getByText(file, { exact: true })
        .click();
    await expect(
        page.locator('.text-file-editor-panel .cm-content')
    ).toContainText(`Текст ${file}`);
}

const note = (page: Page) => page.locator('.tex-entry-note');

test('tex-entry-note-offers-a-beginner-to-include-the-file', async ({
    page,
}) => {
    const saved = await openProject(page, 'Введение\n\\end{document}', [
        CHAPTER,
    ]);
    await openFile(page, CHAPTER.fileName);

    await expect(note(page)).toContainText(
        'The PDF is built from the segments, and they do not include this file.'
    );
    await expect(note(page).locator('code')).toHaveText('\\input{chapter.tex}');

    await note(page).getByRole('button', { name: 'Include' }).click();

    // сегменты теперь подключают файл: человек остаётся в нём, полоса уходит
    await expect(note(page)).toHaveCount(0);
    await expect(page.locator('.text-file-editor-panel')).toBeVisible();
    await expect
        .poll(() => saved[saved.length - 1]?.segments[0].text)
        .toBe('Введение\n\\input{chapter.tex}\n\\end{document}');
});

test('tex-entry-note-is-not-shown-once-segments-include-files', async ({
    page,
}) => {
    await openProject(page, 'Введение\n\\input{other}', [CHAPTER]);
    await openFile(page, CHAPTER.fileName);

    await expect(note(page)).toHaveCount(0);
});

test('tex-entry-note-warns-that-main-tex-turns-segments-off', async ({
    page,
}) => {
    await openProject(page, 'Введение', [CHAPTER, MAIN]);
    await openFile(page, MAIN.fileName);

    await expect(note(page)).toHaveClass(/tex-entry-note--mainIgnoresSegments/);
    await expect(note(page)).toHaveText(
        'We do not recommend using main.tex: while it is in the project, the PDF is built from it and the segments are ignored.'
    );
    await expect(note(page).getByRole('button')).toHaveCount(0);

    // при main.tex подключать другие файлы к сегментам незачем
    await openFile(page, CHAPTER.fileName);
    await expect(note(page)).toHaveCount(0);
});
