import { expect, test, type Page } from '@playwright/test';
import type { Hunk, Program, ProjectType } from '../../model/domain.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-284: агент меняет параметры проекта: округление, движок LaTeX и тип.
 * Места в документе у такой правки нет: карточка с прежними и новыми
 * значениями стоит в начале документа и в меню проекта, а кнопка меню
 * отмечена точкой
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1280, height: 900 } });

// так их присылает препрод: нетронутые поля приходят со значением null
const projectHunk = (previousParameters: Hunk['previousParameters']): Hunk => ({
    id: 'project-params',
    type: 'changeProjectParameters',
    previousParameters: {
        visible: null,
        hideValue: null,
        roundStrategy: null,
        latexCompiler: null,
        projectType: null,
        ...previousParameters,
    },
});

type ProjectState = { projectType: ProjectType; program: Program };

const latexBody = (): Program => ({
    segments: [
        {
            id: 1,
            type: 'latex',
            text: 'Привет',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'twoDigits', latexCompiler: 'xelatex' },
});

/** Проект с состоянием: чтение отдаёт текущее, откат правки возвращает прежнее */
async function openProject(
    page: Page,
    state: ProjectState,
    hunk: Hunk,
    onRevert: (state: ProjectState) => void = () => {}
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupSetProjectTypeRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await page.route(`**/api/v4/public/project/${uuid}/get**`, (route) =>
        route.fulfill({
            json: {
                projectId: uuid,
                userId: 1,
                title: 'Default Project',
                lastModified: new Date().toISOString(),
                creationTime: new Date().toISOString(),
                isPublic: false,
                projectType: state.projectType,
                program: state.program,
                lastProgramResult: { segments: [] },
            },
        })
    );
    const deletes: [string, boolean][] = [];
    await routeSetup.setupHunkRequestsWithState([hunk], {
        onDelete: (id, revert) => {
            deletes.push([id, revert]);
            if (revert) {
                onRevert(state);
            }
        },
    });
    await page.goto(`/project/${uuid}`);
    // у пустого документа вместо редактора сегментов заглушка добавления
    await expect(
        page
            .locator('.cm-content, .empty-project-placeholder-container')
            .first()
    ).toBeVisible({ timeout: 15_000 });
    return deletes;
}

const card = (page: Page) =>
    page.locator('.segments-container').getByTestId('project-parameters-hunk');
const badge = (page: Page) => page.locator('.project-settings-icon__badge');
const settingsMenu = (page: Page) =>
    page.locator('.code-settings-header-container .dropdown-menu-container');

test('правка параметров проекта видна в начале документа и в меню проекта', async ({
    page,
}) => {
    await openProject(
        page,
        { projectType: 'latex', program: latexBody() },
        projectHunk({ roundStrategy: 'threeDigits', latexCompiler: 'pdflatex' })
    );

    await expect(card(page)).toContainText(
        'The agent changed the project parameters:'
    );
    await expect(card(page).locator('li')).toHaveText([
        'Rounding mode: Three digits → Two digits',
        'LaTeX compiler: pdfLaTeX → XeLaTeX',
    ]);
    // начало документа: под LaTeX-заголовком и над первым сегментом
    const header = (await page.locator('.latex-header-segment').boundingBox())!;
    const box = (await card(page).boundingBox())!;
    const segment = (await page
        .locator('.segment-editor-container')
        .first()
        .boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(header.y + header.height);
    expect(box.y + box.height).toBeLessThanOrEqual(segment.y);

    await expect(badge(page)).toBeVisible();
    await settingsMenu(page).first().click();
    await expect(
        page
            .locator('.project-settings-dropdown')
            .getByTestId('project-parameters-hunk')
    ).toBeVisible();
});

test('принятая правка остаётся в проекте, а карточка и точка уходят', async ({
    page,
}) => {
    const deletes = await openProject(
        page,
        { projectType: 'latex', program: latexBody() },
        projectHunk({ roundStrategy: 'threeDigits' })
    );

    await card(page).getByRole('button', { name: 'Accept change' }).click();

    await expect(card(page)).toHaveCount(0);
    await expect(badge(page)).toHaveCount(0);
    expect(deletes).toEqual([['project-params', false]]);
});

test('откат смены типа возвращает проекту прежний тип', async ({ page }) => {
    const deletes = await openProject(
        page,
        { projectType: 'latex', program: latexBody() },
        projectHunk({ projectType: 'markdown' }),
        (state) => {
            state.projectType = 'markdown';
        }
    );
    await expect(card(page).locator('li')).toHaveText([
        'Project type: markdown → latex',
    ]);
    await expect(page.locator('.latex-header-segment')).toBeVisible();

    await card(page).getByRole('button', { name: 'Revert change' }).click();

    await expect(card(page)).toHaveCount(0);
    expect(deletes).toEqual([['project-params', true]]);
    // перечитанный проект снова markdown: LaTeX-заголовка нет, в меню выбран markdown
    await expect(page.locator('.latex-header-segment')).toHaveCount(0);
    await settingsMenu(page).first().click();
    await expect(
        page.locator('.project-settings-dropdown .labkeeper-radio', {
            hasText: /^markdown$/,
        })
    ).toHaveClass(/checked/);
});

test('откат округления и движка возвращает прежние значения', async ({
    page,
}) => {
    await openProject(
        page,
        { projectType: 'latex', program: latexBody() },
        projectHunk({
            roundStrategy: 'threeDigits',
            latexCompiler: 'pdflatex',
        }),
        (state) => {
            state.program = {
                ...state.program,
                parameters: {
                    roundStrategy: 'threeDigits',
                    latexCompiler: 'pdflatex',
                },
            };
        }
    );

    await card(page).getByRole('button', { name: 'Revert change' }).click();

    await expect(card(page)).toHaveCount(0);
    await settingsMenu(page).first().click();
    await expect(
        page.locator('.project-settings-dropdown .labkeeper-radio', {
            hasText: /^Three digits$/,
        })
    ).toHaveClass(/checked/);
    await expect(
        page.locator('.project-settings-dropdown .labkeeper-radio', {
            hasText: /^pdfLaTeX$/,
        })
    ).toHaveClass(/checked/);
});

test('свой выбор параметра человеком принимает правку агента', async ({
    page,
}) => {
    const deletes = await openProject(
        page,
        { projectType: 'latex', program: latexBody() },
        projectHunk({ latexCompiler: 'pdflatex' })
    );

    await settingsMenu(page).first().click();
    await page
        .locator('.project-settings-dropdown .labkeeper-radio', {
            hasText: /^Without rounding$/,
        })
        .click();

    // откат после этого затёр бы выбор человека
    await expect(card(page)).toHaveCount(0);
    await expect.poll(() => deletes).toEqual([['project-params', false]]);
});

// GH-179 для параметров проекта: всё и так стоит как было, решать нечего
test('правка, которая ничего не меняет, принимается молча', async ({
    page,
}) => {
    const deletes = await openProject(
        page,
        { projectType: 'latex', program: latexBody() },
        projectHunk({ latexCompiler: 'xelatex', projectType: 'latex' })
    );

    await expect.poll(() => deletes).toEqual([['project-params', false]]);
    await expect(card(page)).toHaveCount(0);
    await expect(badge(page)).toHaveCount(0);
});

test('после инструмента агента проект перечитывается вместе с типом', async ({
    page,
}) => {
    const state: ProjectState = {
        projectType: 'markdown',
        program: {
            segments: [
                {
                    id: 1,
                    type: 'md',
                    text: 'Привет',
                    parameters: { visible: true },
                },
            ],
            parameters: { roundStrategy: 'noRound' },
        },
    };
    let hunks: Hunk[] = [];
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await page.route(`**/api/v4/public/project/${uuid}/get**`, (route) =>
        route.fulfill({
            json: {
                projectId: uuid,
                userId: 1,
                title: 'Default Project',
                lastModified: new Date().toISOString(),
                creationTime: new Date().toISOString(),
                isPublic: false,
                projectType: state.projectType,
                program: state.program,
                lastProgramResult: { segments: [] },
            },
        })
    );
    await page.route(`**/api/v4/public/project/${uuid}/hunk`, (route) =>
        route.fulfill({ json: { hunks } })
    );
    await routeSetup.setupAgentSocket([
        { type: 'toolCall', toolName: 'set_project_parameters' },
        { type: 'agentFinished', message: 'готово', stopReason: 'Done' },
    ]);
    await page.goto(`/project/${uuid}`);
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect(page.locator('.latex-header-segment')).toHaveCount(0);

    // сервер сменит тип, как только агент вызовет инструмент
    state.projectType = 'latex';
    hunks = [projectHunk({ projectType: 'markdown' })];
    await page.getByPlaceholder('Enter your promt').fill('сделай LaTeX');
    await page.getByRole('button', { name: 'Send' }).click();

    await expect(page.locator('.latex-header-segment')).toBeVisible();
    // шаги прогона свёрнуты сразу после него
    await page.locator('.agent-chat__steps-toggle').click();
    await expect(
        page.getByText('Changed the project parameters', { exact: true })
    ).toBeVisible();
    await expect(card(page).locator('li')).toHaveText([
        'Project type: markdown → latex',
    ]);
});

// у пустого документа нет списка сегментов, а правка параметров проекта есть: так бывает у гостя
test('у пустого документа карточка тоже видна', async ({ page }) => {
    await openProject(
        page,
        {
            projectType: 'latex',
            program: {
                segments: [],
                parameters: {
                    roundStrategy: 'threeDigits',
                    latexCompiler: 'xelatex',
                },
            },
        },
        projectHunk({ latexCompiler: 'pdflatex' })
    );

    await expect(page.getByTestId('project-parameters-hunk')).toContainText(
        'LaTeX compiler: pdfLaTeX → XeLaTeX'
    );
    await expect(
        page.locator('.empty-project-placeholder-container')
    ).toBeVisible();
});
