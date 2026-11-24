import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Program } from '../../model/domain.ts';
import { PERSISTENCE_VERSION } from '../../view/store/persistMigrations.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-278: документ требует XeTeX, а проект собирается pdfLaTeX. Панель ошибок
 * говорит об этом и одной кнопкой переключает движок и собирает заново
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const pdf = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);

test.use({ viewport: { width: 1360, height: 900 } });

// ответ препрода 24.11.2026 на \usepackage{fontspec} под pdfLaTeX
const FONTSPEC_ERROR = {
    code: 700,
    payload: {
        line: 101,
        segmentId: null,
        position: 0,
        latexErrorMessage:
            'Fatal Package fontspec Error: The fontspec package requires either XeTeX or',
        latexFile:
            'usr/local/texlive/2025/texmf-dist/tex/latex/fontspec/fontspec.sty',
    },
};

const PROGRAM: Program = {
    segments: [
        {
            id: 1,
            type: 'latex',
            text: '\\documentclass{beamer}\n\\usepackage{fontspec}\n\\usepackage{polyglossia}\n\\begin{document}\nПривет\n\\end{document}',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound', latexCompiler: 'pdflatex' },
};

const hint = (page: Page) => page.locator('.problem-viewer-xelatex');
const switchButton = (page: Page) =>
    page.getByRole('button', { name: 'Switch to XeLaTeX' });

/** Первая сборка падает на fontspec, следующие удаются; программы складывает */
function fontspecThenPdf(programs: unknown[]) {
    return async (route: Route) => {
        programs.push(route.request().postDataJSON());
        if (programs.length === 1) {
            await route.fulfill({
                status: 203,
                json: { errors: [FONTSPEC_ERROR], unfinishedPdfUri: null },
            });
            return;
        }
        await route.fulfill({ json: { pdfUri: '/files/xelatex.pdf' } });
    };
}

/** Программа гостя, сохранённая в браузере прошлым заходом */
const seedGuestProgram = (page: Page) =>
    page.addInitScript(
        ({ stored, version }) => {
            if (window.localStorage.getItem('persist:PERSISTENCE')) return;
            window.localStorage.setItem(
                'persist:PERSISTENCE',
                JSON.stringify({
                    lastProgram: JSON.stringify(stored),
                    _persist: JSON.stringify({ version, rehydrated: true }),
                })
            );
        },
        { stored: PROGRAM, version: PERSISTENCE_VERSION }
    );

test.beforeEach(async ({ page }) => {
    await page.route('**/files/xelatex.pdf', (route) =>
        route.fulfill({ contentType: 'application/pdf', body: pdf })
    );
});

test('после ошибки fontspec кнопка переключает проект на XeLaTeX и собирает заново', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    routeSetup.setupLatexProject();
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default', PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    const saved: string[] = [];
    await routeSetup.setupSaveProgramRequest(200, 'empty', (route) => {
        if (route.request().method() !== 'GET') {
            saved.push(route.request().postData() ?? '');
        }
    });
    const compiles: unknown[] = [];
    await page.route(
        `**/api/v4/public/project/${uuid}/compile/pdf**`,
        fontspecThenPdf(compiles)
    );
    await page.goto(`/project/${uuid}`);

    await page.locator('.run-button').click();

    await expect(hint(page)).toContainText('The document requires XeLaTeX');
    // список ошибок раскрылся сам; свёрнутым он подсказку не прячет
    await page
        .locator('.labkeeper-problem-viewer-container .sector-header-container')
        .click();
    await expect(page.locator('.problem-list-container-expanded')).toHaveCount(
        0
    );
    await expect(hint(page)).toBeVisible();

    await switchButton(page).click();

    await expect.poll(() => compiles.length).toBe(2);
    // на сервер ушла программа с XeLaTeX раньше, чем вторая сборка
    expect(
        saved.some((body) => body.includes('"latexCompiler":"xelatex"'))
    ).toBe(true);
    await expect(hint(page)).toHaveCount(0);
    await expect(page.locator('.header-problem-title')).toHaveText(
        'Problems(0)'
    );
});

test('у гостя в /project/default кнопка собирает документ уже XeLaTeX', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    await seedGuestProgram(page);
    const programs: Program[] = [];
    await page.route(
        '**/api/v4/public/compile/pdf**',
        fontspecThenPdf(programs)
    );
    await page.goto('/project/default');

    await page.locator('.run-button').click();
    await switchButton(page).click();

    await expect.poll(() => programs.length).toBe(2);
    expect(programs[0].parameters.latexCompiler).toBe('pdflatex');
    expect(programs[1].parameters.latexCompiler).toBe('xelatex');
    await expect(hint(page)).toHaveCount(0);
});

test('после другой ошибки LaTeX подсказки нет', async ({ page }) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupApi();
    await routeSetup.setupGetUserInfoRequest(false);
    await page.route('**/api/v4/public/compile/pdf**', (route) =>
        route.fulfill({
            status: 203,
            json: {
                errors: [
                    {
                        code: 700,
                        payload: {
                            ...FONTSPEC_ERROR.payload,
                            latexErrorMessage:
                                "LaTeX Error: File `missing.sty' not found.",
                        },
                    },
                ],
            },
        })
    );
    await seedGuestProgram(page);
    await page.goto('/project/default');

    await page.locator('.run-button').click();

    await expect(page.locator('.header-problem-title')).toHaveText(
        'Problems(1)'
    );
    await expect(hint(page)).toHaveCount(0);
});
