import { expect, test, type Page } from '@playwright/test';
import { Hunk, Program, Segment } from '../../model/domain.ts';
import { RouteSetup } from './mock.routeSetUp.tsx';

/** GH-242: агент сменил параметры сегмента, под сегментом карточка с кнопками */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1280, height: 900 } });

const computation = (parameters: Segment['parameters']): Segment => ({
    id: 1,
    type: 'computational',
    text: 'a = 10 # 1\nb = a ^ 2',
    parameters: { visible: true, ...parameters },
});

const programOf = (segment: Segment): Program => ({
    segments: [segment],
    parameters: { roundStrategy: 'noRound' },
});

// так их присылает сервер: нетронутые поля приходят со значением null
const PARAMETER_HUNK: Hunk = {
    id: 'params',
    type: 'changeSegmentParameters',
    segmentId: 1,
    previousParameters: {
        visible: null,
        hideAssignment: null,
        hideAssignmentWithValues: false,
        hideValue: null,
        hideGeneralFormula: false,
        hideInflAssignment: null,
        hideInflAssignmentWithValues: false,
        hideInfl: null,
    },
};

const CHANGED = computation({
    hideAssignmentWithValues: true,
    hideGeneralFormula: true,
    hideInflAssignmentWithValues: true,
});

const RESTORED = computation({
    hideAssignmentWithValues: false,
    hideGeneralFormula: false,
    hideInflAssignmentWithValues: false,
});

async function openProject(
    page: Page,
    onDelete?: (hunkId: string, revert: boolean) => void,
    // мок отдаёт эту программу при каждом чтении проекта, и её можно поменять по ходу опыта
    program: Program = programOf(CHANGED)
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    const server = await routeSetup.setupHunkRequestsWithState(
        [PARAMETER_HUNK],
        { onDelete }
    );
    await page.goto(`/project/${uuid}`);
    await expect(page.locator('.cm-content').first()).toBeVisible({
        timeout: 15_000,
    });
    return server;
}

const card = (page: Page) => page.getByTestId('parameters-hunk');

const openSegmentMenu = (page: Page) =>
    page.locator('.segment-editor-container .dropdown-menu-container').click();

const parameterCheckbox = (page: Page, title: string) =>
    page.locator('.labkeeper-checkbox', { hasText: title });

test('agent-parameter-change-shows-each-parameter-from-old-to-new', async ({
    page,
}) => {
    await openProject(page);

    await expect(card(page)).toBeVisible();
    await expect(card(page)).toContainText('The agent changed parameters:');
    await expect(card(page).locator('li')).toHaveText([
        'Hide a formula with substituted numbers: no → yes',
        'Hide the general partial differential error formula: no → yes',
        'Hide the error formula with substituted numbers: no → yes',
    ]);
    // строк у такой правки нет: кнопок правки в самом редакторе быть не должно
    await expect(
        page.locator('.segment-editor-container .cm-hunk-controls')
    ).toHaveCount(0);
});

test('accepted-parameter-change-keeps-the-values-and-goes-away', async ({
    page,
}) => {
    const deletes: [string, boolean][] = [];
    await openProject(page, (id, revert) => deletes.push([id, revert]));

    await card(page).getByRole('button', { name: 'Accept change' }).click();

    await expect(card(page)).toHaveCount(0);
    expect(deletes).toEqual([['params', false]]);
});

test('reverted-parameter-change-restores-the-previous-values', async ({
    page,
}) => {
    const deletes: [string, boolean][] = [];
    const program = programOf(CHANGED);
    await openProject(
        page,
        (id, revert) => {
            deletes.push([id, revert]);
            // сервер вернул прежние значения, и перечитанный проект отдаёт уже их
            if (revert) {
                program.segments[0] = RESTORED;
            }
        },
        program
    );

    await card(page).getByRole('button', { name: 'Revert change' }).click();

    await expect(card(page)).toHaveCount(0);
    expect(deletes).toEqual([['params', true]]);
    await openSegmentMenu(page);
    await expect(
        parameterCheckbox(page, 'Hide a formula with substituted numbers')
    ).not.toHaveClass(/\bchecked\b/);
});

test('parameter-set-by-hand-accepts-the-agent-change', async ({ page }) => {
    const deletes: [string, boolean][] = [];
    await openProject(page, (id, revert) => deletes.push([id, revert]));

    await openSegmentMenu(page);
    await parameterCheckbox(
        page,
        'Hide the general partial differential error formula'
    ).click();

    // откат после этого затёр бы выбор человека
    await expect(card(page)).toHaveCount(0);
    await expect.poll(() => deletes).toEqual([['params', false]]);
});
