import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Hunk, Program } from '../../model/domain.ts';

/**
 * Кнопки правок агента в дереве файлов. У файла с несколькими правками они
 * обязаны принимать и откатывать все сразу: раньше запись о файле строилась
 * по группе ханков, и кнопка видела только первую
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const FILE = 'report.tex';
const FILE_URL = '/files/report.tex';

test.use({ viewport: { width: 1360, height: 900 } });

const emptyProgram: Program = {
    segments: [],
    parameters: { roundStrategy: 'noRound' },
} as unknown as Program;

// Две независимые правки одного файла: сервер отдаёт их отдельными ханками
const TWO_EDITS: Hunk[] = [
    {
        id: 'hunk-top',
        type: 'addLinesToFile',
        fileName: FILE,
        startLine: 1,
        endLine: 1,
        text: 'первая вставка',
    },
    {
        id: 'hunk-bottom',
        type: 'addLinesToFile',
        fileName: FILE,
        startLine: 4,
        endLine: 4,
        text: 'вторая вставка',
    },
];

function recordHunkDeletes(page: Page) {
    const deletes: { hunkId: string; revert: string | null }[] = [];
    page.on('request', (request) => {
        if (request.method() !== 'DELETE') {
            return;
        }
        const url = new URL(request.url());
        const hunkId = url.pathname.split('/hunk/')[1];
        if (hunkId) {
            deletes.push({ hunkId, revert: url.searchParams.get('revert') });
        }
    });
    return deletes;
}

async function openWithFileHunks(page: Page, hunks: Hunk[], deleteDelayMs = 0) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', emptyProgram);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesCustom([{ fileName: FILE, url: FILE_URL }]);
    await routeSetup.setupStaticFileContent(
        FILE_URL,
        ['первая вставка', 'alpha', 'beta', 'вторая вставка'].join('\n')
    );
    await routeSetup.setupHunkRequestsWithState(hunks, { deleteDelayMs });

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('div.file-manager-button').click();
    await expect(page.locator('.tree-row-hunk-actions')).toBeVisible();
}

const acceptInTree = (page: Page) => page.locator('.tree-hunk-btn--accept');
const revertInTree = (page: Page) => page.locator('.tree-hunk-btn--revert');

test('кнопка «Принять» в дереве принимает все правки файла', async ({
    page,
}) => {
    const deletes = recordHunkDeletes(page);
    await openWithFileHunks(page, TWO_EDITS);

    await acceptInTree(page).click();

    await expect
        .poll(() => deletes.map((d) => d.hunkId).sort())
        .toEqual(['hunk-bottom', 'hunk-top']);
    // принятие идёт без флага отката
    expect(deletes.every((d) => d.revert !== 'true')).toBe(true);
    await expect(page.locator('.tree-row-hunk-actions')).toHaveCount(0);
});

test('кнопка «Отклонить» в дереве откатывает все правки файла', async ({
    page,
}) => {
    const deletes = recordHunkDeletes(page);
    await openWithFileHunks(page, TWO_EDITS);

    await revertInTree(page).click();

    await expect
        .poll(() => deletes.map((d) => d.hunkId).sort())
        .toEqual(['hunk-bottom', 'hunk-top']);
    expect(deletes.every((d) => d.revert === 'true')).toBe(true);
    await expect(page.locator('.tree-row-hunk-actions')).toHaveCount(0);
});

// Пока не завершилась последняя правка файла, кнопка обязана оставаться занятой:
// иначе по ней жмут второй раз, пока первая половина ещё в полёте
test('индикатор ожидания держится до последней правки файла', async ({
    page,
}) => {
    await openWithFileHunks(page, TWO_EDITS, 1500);

    await acceptInTree(page).click();

    const spinner = page.locator('.tree-hunk-btn__spinner--accept');
    await expect(spinner).toBeVisible();
    await expect(acceptInTree(page)).toBeDisabled();
    await expect(revertInTree(page)).toBeDisabled();
    // обе правки доехали, строка файла больше не предлагает действий
    await expect(page.locator('.tree-row-hunk-actions')).toHaveCount(0, {
        timeout: 15000,
    });
});

// Файл с одной правкой вёл себя правильно и раньше: проверяем, что не сломали
test('файл с одной правкой принимается как прежде', async ({ page }) => {
    const deletes = recordHunkDeletes(page);
    await openWithFileHunks(page, [TWO_EDITS[0]]);

    await acceptInTree(page).click();

    await expect.poll(() => deletes.map((d) => d.hunkId)).toEqual(['hunk-top']);
});
