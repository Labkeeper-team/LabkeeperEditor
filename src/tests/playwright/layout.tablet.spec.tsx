import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program } from '../../model/domain.ts';

/**
 * GH-266: на ширине 768–1023 страница уменьшалась целиком до раскладки
 * 1024, текст мельчал, а под страницей оставалась чёрная полоса. Теперь
 * список проектов и редактор держат свою раскладку
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const PROGRAM: Program = {
    segments: [
        {
            id: 1,
            type: 'md',
            text: '# Лабораторная работа\nИзмерение ускорения',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' },
};

const PROJECTS = Array.from({ length: 6 }, (_, index) => ({
    projectId: `00000000-0000-4000-8000-00000000000${index}`,
    userId: 1,
    title: `Лабораторная работа ${index + 1}`,
    lastModified: '2025-03-01T12:00:00Z',
    creationTime: '2024-05-01T12:00:00Z',
    isPublic: false,
    projectType: 'latex',
    tags: [],
}));

async function signedIn(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await page.route('**/api/v4/public/project/all**', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ projects: PROJECTS }),
        })
    );
    return routeSetup;
}

/** Страница не уменьшена и доходит до низа окна */
async function expectOwnLayout(page: Page) {
    const layout = await page.evaluate(() => {
        const wrapper = document.querySelector('.scale-wrapper')!;
        const root = document.querySelector('.layout-root')!;
        return {
            transform: getComputedStyle(wrapper).transform,
            bottom: root.getBoundingClientRect().bottom,
            height: window.innerHeight,
        };
    });
    expect(layout.transform).toBe('none');
    // внизу только поле $main-margin, а не полоса под уменьшенной страницей
    expect(layout.height - layout.bottom).toBeLessThanOrEqual(12);
}

for (const viewport of [
    { width: 1023, height: 800 },
    { width: 900, height: 800 },
    { width: 768, height: 1024 },
    // телефон лёжа: при уменьшении снизу пропадала кнопка «Выполнить»
    { width: 844, height: 390 },
]) {
    test.describe(`${viewport.width}x${viewport.height}`, () => {
        test.use({ viewport });

        test('список проектов держит свою раскладку', async ({ page }) => {
            await signedIn(page);
            await page.goto('/projects');
            await page.locator('tbody tr').first().waitFor();

            await expectOwnLayout(page);
        });

        test('редактор держит свою раскладку, а шапка не наезжает на соседей', async ({
            page,
        }) => {
            const routeSetup = await signedIn(page);
            await routeSetup.setupGetProjectRequest(200, 'default', PROGRAM);
            await routeSetup.setupSaveProgramRequest();
            await routeSetup.setupListFilesRequest(200, 'emptyFiles');
            await routeSetup.setupAgentHistoryRequest([]);
            await page.route(
                `**/api/v4/public/project/${uuid}/get**`,
                (route) => route.fallback()
            );
            await page.goto(`/project/${uuid}`);
            await page.locator('.cm-content').first().waitFor();

            await expectOwnLayout(page);
            await expect(page.locator('.run-button-bar')).toBeInViewport({
                ratio: 1,
            });
            // середина шапки (название, карандаш, «Поделиться») между краями
            const header = await page.evaluate(() => {
                const box = (selector: string) =>
                    document.querySelector(selector)!.getBoundingClientRect();
                const middle = [
                    ...document.querySelectorAll('.labkeeper_header__center *'),
                ]
                    .map((element) => element.getBoundingClientRect())
                    // подсказки и прочее невидимое места не занимают
                    .filter((rect) => rect.width > 0 && rect.height > 0);
                return {
                    title: box('.change-title-input').width,
                    from: Math.min(...middle.map((rect) => rect.left)),
                    to: Math.max(...middle.map((rect) => rect.right)),
                    left: box('.labkeeper_header__left').right,
                    right: box('.labkeeper_header__right').left,
                };
            });
            expect(header.from).toBeGreaterThanOrEqual(header.left);
            expect(header.to).toBeLessThanOrEqual(header.right);
            // и название остаётся читаемым, а не сжимается в точку
            expect(header.title).toBeGreaterThanOrEqual(100);
        });
    });
}
