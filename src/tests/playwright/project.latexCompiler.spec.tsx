import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

// Labkeeper-team/LabkeeperServer#669: движок сборки PDF выбирается рядом с экспортом архива

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

async function openProject(
    page: Page,
    projectType: 'latex' | 'markdown',
    onSave?: (body: unknown) => void
) {
    const routeSetup = new RouteSetup(page);
    if (projectType === 'latex') {
        routeSetup.setupLatexProject();
    }
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest(200, 'empty', (route) => {
        if (route.request().method() !== 'GET') {
            onSave?.(route.request().postDataJSON());
        }
    });
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await page.goto(`/project/${uuid}`);
    await page.locator('.ide-header').waitFor();
}

async function openSettings(page: Page) {
    await page
        .locator('.code-settings-header-container .dropdown-menu-container')
        .first()
        .click();
}

const compilerSection = (page: Page) =>
    page.getByTestId('project-latex-compiler');

test('в latex-проекте движок по умолчанию pdfLaTeX', async ({ page }) => {
    await openProject(page, 'latex');
    await openSettings(page);

    await expect(compilerSection(page)).toBeVisible();
    await expect(compilerSection(page).locator('.select-header')).toContainText(
        'pdfLaTeX'
    );
});

test('выбор XeLaTeX сохраняет программу с latexCompiler', async ({ page }) => {
    const saved: unknown[] = [];
    await openProject(page, 'latex', (body) => saved.push(body));
    await openSettings(page);

    await compilerSection(page).locator('.select-header').click();
    await compilerSection(page)
        .locator('.select-options li', { hasText: 'XeLaTeX' })
        .click();

    await expect(compilerSection(page).locator('.select-header')).toContainText(
        'XeLaTeX'
    );
    await expect
        .poll(() =>
            saved.some((body) =>
                JSON.stringify(body).includes('"latexCompiler":"xelatex"')
            )
        )
        .toBe(true);
});

test('в markdown-проекте выбора движка нет', async ({ page }) => {
    await openProject(page, 'markdown');
    await openSettings(page);

    await expect(
        page.locator('.project-export__option[data-export-format="labkeeper"]')
    ).toBeVisible();
    await expect(compilerSection(page)).toHaveCount(0);
});
