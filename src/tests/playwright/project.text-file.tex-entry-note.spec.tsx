import { expect, test, type Page } from '@playwright/test';
import { Program } from '../../model/domain.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-246: PDF собирается из сегментов, а не из открытого файла .tex. Над файлом
 * полоса говорит, подключён ли он в сегментах, и подключает его одной кнопкой
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({
    viewport: { width: 1280, height: 900 },
});

const CHAPTER = 'chapter.tex';
const CHAPTER_URL = '/files/chapter.tex';
const MAIN = 'main.tex';
const MAIN_URL = '/files/main.tex';

const program = (text: string): Program => ({
    segments: [{ id: 1, type: 'latex', text, parameters: { visible: true } }],
    parameters: { roundStrategy: 'noRound' },
});

async function openProjectFile(page: Page, segmentText: string, file: string) {
    // только моки: страница не ходит наружу
    await page.route(
        (url) => url.hostname !== 'localhost',
        (route) => route.abort()
    );
    const routeSetup = new RouteSetup(page);
    routeSetup.setupLatexProject();
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(
        200,
        'default',
        program(segmentText)
    );
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesCustom([
        { fileName: CHAPTER, url: CHAPTER_URL },
        { fileName: MAIN, url: MAIN_URL },
    ]);
    await routeSetup.setupEditableTextFile(CHAPTER, CHAPTER_URL, 'Глава');
    await routeSetup.setupEditableTextFile(MAIN, MAIN_URL, 'Свой main');
    await routeSetup.setupHunkRequestsWithState([]);

    await page.goto(`/project/${uuid}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({
        timeout: 15_000,
    });
    await page.locator('div.file-manager-button').click();
    await page
        .locator('.tree-row-label')
        .getByText(file, { exact: true })
        .click();
    await expect(page.locator('.text-file-editor-panel')).toBeVisible();
}

const note = (page: Page) => page.locator('.tex-entry-note');

test('tex-entry-note-includes-the-file-and-leads-to-its-segment', async ({
    page,
}) => {
    await openProjectFile(page, 'Введение\n\\end{document}', CHAPTER);

    await expect(note(page)).toContainText(
        'The PDF is built from the segments, and they do not include this file.'
    );
    await expect(note(page).locator('code')).toHaveText('\\input{chapter.tex}');

    await note(page).getByRole('button', { name: 'Include' }).click();

    // человек остаётся в файле, а полоса говорит, где файл теперь подключён
    await expect(note(page)).toContainText(
        'This file is included in segment №1.'
    );
    await note(page).getByRole('button', { name: 'Show' }).click();

    await expect(page.locator('.text-file-editor-panel')).toBeHidden();
    await expect(page.locator('.cm-content').first()).toContainText(
        'Введение\\input{chapter.tex}\\end{document}'
    );
});

test('tex-entry-note-warns-that-root-main-tex-is-replaced', async ({
    page,
}) => {
    await openProjectFile(page, 'Введение', MAIN);

    await expect(note(page)).toHaveClass(/tex-entry-note--replacedByMain/);
    await expect(note(page)).toContainText(
        'the server builds main.tex from the segments'
    );
    await expect(note(page).getByRole('button')).toHaveCount(0);
});
