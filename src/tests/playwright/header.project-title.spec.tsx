import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-276: последний открытый проект остаётся в хранилище, и шапка показывала
 * его название и «Поделиться» в списке проектов и на месте другого проекта
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const SECOND_ID = '3be29815-7d4f-49db-a7a2-0b1a34a4f9dc';
const SECOND_TITLE = 'Второй проект';

test.use({ viewport: { width: 1360, height: 900 } });

const headerTitle = (page: Page) =>
    page.locator('.labkeeper_header__center .change-title-input');
const shareButton = (page: Page) =>
    page.locator('.labkeeper_header__center .share-button');

async function openFirstProject(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await page.route('**/api/v4/public/project/all**', (route) =>
        route.fulfill({
            json: {
                projects: [
                    {
                        projectId: SECOND_ID,
                        userId: 1,
                        title: SECOND_TITLE,
                        lastModified: '2026-11-20T12:00:00Z',
                        creationTime: '2026-11-01T12:00:00Z',
                        isPublic: false,
                        projectType: 'markdown',
                        tags: [],
                    },
                ],
            },
        })
    );
    await page.goto(`/project/${uuid}`);
    await expect(headerTitle(page)).toHaveValue('Default Project');
    await expect(shareButton(page)).toBeVisible();
}

async function goToProjectsFromMenu(page: Page) {
    await page.locator('.header-menu-select .select-header').click();
    await page
        .getByRole('listitem')
        .filter({ hasText: /^My projects$/ })
        .click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByText(SECOND_TITLE).first()).toBeVisible();
}

test('в списке проектов шапка без названия и «Поделиться» прежнего проекта', async ({
    page,
}) => {
    await openFirstProject(page);

    await goToProjectsFromMenu(page);

    await expect(headerTitle(page)).toHaveCount(0);
    await expect(shareButton(page)).toHaveCount(0);
});

test('пока грузится другой проект, в шапке нет названия прежнего', async ({
    page,
}) => {
    await openFirstProject(page);
    await goToProjectsFromMenu(page);

    let release = () => {};
    const answered = new Promise<void>((resolve) => (release = resolve));
    await page.route(
        `**/api/v4/public/project/${SECOND_ID}/**`,
        async (route) => {
            const path = new URL(route.request().url()).pathname;
            if (path.endsWith('/get')) {
                await answered;
                await route.fulfill({
                    json: {
                        projectId: SECOND_ID,
                        userId: 1,
                        title: SECOND_TITLE,
                        lastModified: '2026-11-20T12:00:00Z',
                        creationTime: '2026-11-01T12:00:00Z',
                        isPublic: false,
                        projectType: 'markdown',
                        program: {
                            segments: [],
                            parameters: { roundStrategy: 'noRound' },
                        },
                        lastProgramResult: { segments: [] },
                    },
                });
                return;
            }
            if (path.endsWith('/file/list')) {
                await route.fulfill({ json: { files: [] } });
                return;
            }
            if (path.endsWith('/hunk')) {
                await route.fulfill({ json: { hunks: [] } });
                return;
            }
            await route.fulfill({ json: [] });
        }
    );

    await page.getByText(SECOND_TITLE).first().click();
    await expect(page).toHaveURL(new RegExp(`/project/${SECOND_ID}$`));
    // список шапка уже прошла, а проект ещё не приехал
    await page.waitForTimeout(500);
    await expect(headerTitle(page)).toHaveCount(0);
    await expect(shareButton(page)).toHaveCount(0);

    release();
    await expect(headerTitle(page)).toHaveValue(SECOND_TITLE);
    await expect(shareButton(page)).toBeVisible();
});
