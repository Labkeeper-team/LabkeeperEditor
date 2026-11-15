import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import type { Program } from '../../model/domain.ts';

// Labkeeper-team/LabkeeperServer#669: движок сборки PDF выбирается рядом с экспортом архива

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

async function openProject(
    page: Page,
    projectType: 'latex' | 'markdown',
    onSave?: (body: unknown) => void,
    program?: Program
) {
    const routeSetup = new RouteSetup(page);
    if (projectType === 'latex') {
        routeSetup.setupLatexProject();
    }
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetDefaultProjectRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', program);
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

// a body without \begin{document}: only then does the editor offer the header card
const BODY_ONLY_PROGRAM: Program = {
    segments: [
        {
            id: 1,
            type: 'latex',
            text: 'Hello',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' },
};

test('header card follows the selected LaTeX engine', async ({ page }) => {
    await openProject(page, 'latex', undefined, BODY_ONLY_PROGRAM);
    const headerCard = page.locator('.latex-header-segment');
    await expect(headerCard).toBeVisible();
    await expect(headerCard).not.toContainText('fontspec');

    await openSettings(page);
    await compilerOption(page, /^XeLaTeX/).click();
    await page.keyboard.press('Escape');

    await expect(headerCard).toContainText('\\usepackage{fontspec}');
    await headerCard.click();

    const header = page
        .locator('.segment-editor-container .cm-content')
        .first();
    await expect(header).toContainText('\\usepackage{fontspec}');
    await expect(header).toContainText('\\setmainfont{CMU Serif}');
    await expect(header).not.toContainText('inputenc');
    await expect(header).not.toContainText('T2A');
});

test('в markdown-проекте выбора движка нет', async ({ page }) => {
    await openProject(page, 'markdown');
    await openSettings(page);

    await expect(
        page.locator('.project-export__option[data-export-format="labkeeper"]')
    ).toBeVisible();
    await expect(compilerSection(page)).toHaveCount(0);
});
