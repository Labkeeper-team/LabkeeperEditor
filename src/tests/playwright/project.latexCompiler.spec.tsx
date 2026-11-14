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
    // несобранный LaTeX-проект телефон открывает чатом агента, а меню живёт в шапке редактора
    if (projectType === 'latex' && (page.viewportSize()?.width ?? 0) <= 767) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'Editor' }).click();
    }
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

const compilerOption = (page: Page, name: RegExp) =>
    compilerSection(page).locator('.labkeeper-radio', { hasText: name });

test('в latex-проекте движок по умолчанию pdfLaTeX', async ({ page }) => {
    await openProject(page, 'latex');
    await openSettings(page);

    await expect(compilerSection(page)).toBeVisible();
    await expect(compilerOption(page, /^pdfLaTeX$/)).toHaveClass(/checked/);
    await expect(compilerOption(page, /^XeLaTeX/)).not.toHaveClass(/checked/);
});

test('зачем нужен XeLaTeX, всплывает при наведении', async ({ page }) => {
    await openProject(page, 'latex');
    await openSettings(page);

    await expect(compilerOption(page, /^XeLaTeX$/)).toBeVisible();
    await compilerOption(page, /^XeLaTeX$/).hover();
    const hint = page.locator('#project-latex-compiler-hint');
    await expect(hint).toBeVisible();
    await expect(hint).toContainText('fontspec');
});

test.describe('phone', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('описание движка видно под названием', async ({ page }) => {
        await openProject(page, 'latex');
        await openSettings(page);

        await expect(
            compilerSection(page).locator(
                '[data-latex-compiler="xelatex"] .project-latex-compiler__hint'
            )
        ).toContainText('fontspec');
    });
});

test('выбор XeLaTeX сохраняет программу с latexCompiler', async ({ page }) => {
    const saved: unknown[] = [];
    await openProject(page, 'latex', (body) => saved.push(body));
    await openSettings(page);

    await compilerOption(page, /^XeLaTeX/).click();

    await expect(compilerOption(page, /^XeLaTeX/)).toHaveClass(/checked/);
    await expect(compilerOption(page, /^pdfLaTeX$/)).not.toHaveClass(/checked/);
    // меню не закрывается и не съезжает: экспорт на месте
    await expect(
        page.locator('.project-export__option[data-export-format="labkeeper"]')
    ).toBeVisible();
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
