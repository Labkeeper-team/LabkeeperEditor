import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const ARCHIVE_URL = 'https://files.labkeeper.test/tmp/exports/0f7a.zip';

test.use({ viewport: { width: 1360, height: 900 } });

async function openProject(page: Page, authenticated = true) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(authenticated);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    // архив лежит на домене хранилища, а оно отвечает с CORS, как files.labkeeper.io
    await page.route(ARCHIVE_URL, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/zip',
            headers: { 'access-control-allow-origin': '*' },
            body: Buffer.from('PK\u0005\u0006' + '\u0000'.repeat(18), 'latin1'),
        })
    );
    await page.goto(authenticated ? `/project/${uuid}` : '/');
    await page.locator('.ide-header').waitFor();
}

async function openSettings(page: Page) {
    // настройки проекта живут в первом выпадающем меню шапки редактора
    await page
        .locator('.code-settings-header-container .dropdown-menu-container')
        .first()
        .click();
}

const exportOption = (page: Page, format: 'labkeeper' | 'tex') =>
    page.locator(`.project-export__option[data-export-format="${format}"]`);

const hint = (page: Page) => page.locator('#project-export-hint');

// GH-211: кнопки короткие, а что окажется в архиве, всплывает при наведении
test('описание формата всплывает при наведении на кнопку', async ({ page }) => {
    await openProject(page);
    await openSettings(page);

    await expect(exportOption(page, 'labkeeper')).toHaveText(
        'Labkeeper archive'
    );
    await expect(exportOption(page, 'tex')).toHaveText('LaTeX archive');

    await exportOption(page, 'labkeeper').hover();
    await expect(hint(page)).toBeVisible();
    await expect(hint(page)).toContainText('your files');

    await exportOption(page, 'tex').hover();
    await expect(hint(page)).toContainText('spends tokens');
});

// на телефоне наведения нет, а меню во весь экран: описание прямо под названием
test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('описание формата видно под названием', async ({ page }) => {
        await openProject(page);
        await openSettings(page);

        await expect(exportOption(page, 'labkeeper')).toContainText(
            'your files'
        );
        await expect(exportOption(page, 'tex')).toContainText('spends tokens');
    });
});

for (const { format, path, fileName } of [
    { format: 'labkeeper', path: 'export', fileName: 'Default Project.zip' },
    {
        format: 'tex',
        path: 'export/tex',
        fileName: 'Default Project (LaTeX).zip',
    },
] as const) {
    test(`архив ${format} скачивается под названием проекта`, async ({
        page,
    }) => {
        let release: () => void = () => {};
        const answered = new Promise<void>((resolve) => (release = resolve));
        await page.route(
            `**/api/v4/public/project/${uuid}/${path}`,
            async (route) => {
                await answered;
                // как прод: адрес голой строкой, хотя заголовок говорит JSON
                await route.fulfill({
                    status: 201,
                    contentType: 'application/json;charset=UTF-8',
                    body: ARCHIVE_URL,
                });
            }
        );
        await openProject(page);
        await openSettings(page);

        await exportOption(page, format).click();

        // пока сервер собирает архив, видно, что работа идёт, и второй раз не нажать
        await expect(exportOption(page, format)).toContainText(
            'Preparing the archive'
        );
        await expect(exportOption(page, 'labkeeper')).toBeDisabled();
        await expect(exportOption(page, 'tex')).toBeDisabled();
        const download = page.waitForEvent('download');
        release();

        expect((await download).suggestedFilename()).toBe(fileName);
        await expect(exportOption(page, format)).toBeEnabled();
    });
}

test('гостю экспорт предлагает войти', async ({ page }) => {
    let exported = false;
    await page.route('**/api/v4/public/project/*/export**', (route) => {
        exported = true;
        return route.abort();
    });
    await openProject(page, false);
    await openSettings(page);

    await exportOption(page, 'labkeeper').click();

    await expect(page.locator('.auth-modal')).toBeVisible();
    expect(exported).toBe(false);
});
