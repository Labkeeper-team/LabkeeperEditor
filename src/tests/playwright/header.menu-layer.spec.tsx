import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-277: меню шапки раскрывается поверх страницы. Раньше пункты уходили под
 * залипающую шапку таблицы проектов и под ручку высоты поля агента, и нажатие
 * доставалось им, а не пункту
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const PROJECTS = Array.from({ length: 30 }, (_, index) => ({
    projectId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    userId: 1,
    title: `Лабораторная работа ${index + 1}`,
    lastModified: '2026-11-20T12:00:00Z',
    creationTime: '2026-11-01T12:00:00Z',
    isPublic: false,
    projectType: 'latex',
    tags: [],
}));

const menuItems = (page: Page) =>
    page.locator(
        '.header-menu-select .select-options:not(.select-width-measurer) li'
    );

async function openMenu(page: Page) {
    // список раскрывается анимацией clip-path, и до её конца нижние пункты не под указателем
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.header-menu-select .select-header').click();
    await expect(menuItems(page).first()).toBeVisible();
}

/** Пункты, у середины которых сверху лежит что-то чужое */
async function coveredItems(page: Page) {
    return menuItems(page).evaluateAll((items) =>
        items
            .filter((item) => {
                const rect = item.getBoundingClientRect();
                // разделители без текста нажимать незачем
                if (!item.textContent?.trim() || rect.height === 0) {
                    return false;
                }
                const top = document.elementFromPoint(
                    rect.left + rect.width / 2,
                    rect.top + rect.height / 2
                );
                return !top || !item.contains(top);
            })
            .map((item) => item.textContent)
    );
}

const overlaps = async (page: Page, selector: string) => {
    const menu = (await page
        .locator(
            '.header-menu-select .select-options:not(.select-width-measurer)'
        )
        .boundingBox())!;
    const other = (await page.locator(selector).last().boundingBox())!;
    return (
        other.x < menu.x + menu.width &&
        menu.x < other.x + other.width &&
        other.y < menu.y + menu.height &&
        menu.y < other.y + other.height
    );
};

/** Что сверху в точке, где элемент проходит под раскрытым меню */
const topInsideMenuOver = (page: Page, selector: string) =>
    page.evaluate((selector) => {
        const menu = document
            .querySelector(
                '.header-menu-select .select-options:not(.select-width-measurer)'
            )!
            .getBoundingClientRect();
        const other = document.querySelector(selector)!.getBoundingClientRect();
        const top = document.elementFromPoint(
            (Math.max(menu.left, other.left) +
                Math.min(menu.right, other.right)) /
                2,
            (Math.max(menu.top, other.top) +
                Math.min(menu.bottom, other.bottom)) /
                2
        );
        return Boolean(top?.closest('.header-menu-select .select-options'));
    }, selector);

test.describe('1280x600', () => {
    test.use({ viewport: { width: 1280, height: 600 } });

    test('в списке проектов меню выше залипающей шапки таблицы', async ({
        page,
    }) => {
        const routeSetup = new RouteSetup(page);
        await routeSetup.setupGetUserInfoRequest(true);
        await page.route('**/api/v4/public/project/all**', (route) =>
            route.fulfill({ json: { projects: PROJECTS } })
        );
        await page.goto('/projects');
        await page.locator('tbody tr').first().waitFor();
        // шапка таблицы залипает, когда список прокручен
        await page.locator('.projects-list-wrapper').evaluate((list) => {
            list.scrollTop = 200;
        });

        await openMenu(page);

        expect(await overlaps(page, 'thead th:last-child')).toBe(true);
        expect(await coveredItems(page)).toEqual([]);
        await menuItems(page)
            .filter({ hasText: /^Log out$/ })
            .click();
        await expect(page.locator('.logout-confirm-modal')).toBeVisible();
    });

    test('в редакторе меню выше ручки высоты поля агента', async ({ page }) => {
        const routeSetup = new RouteSetup(page);
        await routeSetup.setupGetUserInfoRequest(true);
        await routeSetup.acceptCrossBorderConsentLocally();
        await routeSetup.setupGetProjectRequest();
        await routeSetup.setupGetAllProjectsRequest();
        await routeSetup.setupSaveProgramRequest();
        await routeSetup.setupListFilesRequest(200, 'emptyFiles');
        await routeSetup.setupAgentHistoryRequest([]);
        await page.goto(`/project/${uuid}`);
        await page.getByRole('tab', { name: 'AI agent' }).click();
        await page.locator('.agent-chat__resize').waitFor();
        // поле запроса тянут вверх, пока ручка не окажется на уровне пунктов меню
        const grip = (await page.locator('.agent-chat__resize').boundingBox())!;
        await page.mouse.move(
            grip.x + grip.width / 2,
            grip.y + grip.height / 2
        );
        await page.mouse.down();
        await page.mouse.move(grip.x + grip.width / 2, 200, { steps: 8 });
        await page.mouse.up();

        await openMenu(page);

        expect(await overlaps(page, '.agent-chat__resize')).toBe(true);
        expect(await coveredItems(page)).toEqual([]);
        // полоса ручки тоньше пункта, поэтому смотрим и точку, где она проходит под меню
        expect(await topInsideMenuOver(page, '.agent-chat__resize')).toBe(true);
    });
});
