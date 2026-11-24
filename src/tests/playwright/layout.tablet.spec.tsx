import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
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

/**
 * GH-281: в LaTeX-проекте без своей преамбулы редактор показывает карточку
 * заголовка, и строка \geometry{...} без пробелов распирала колонку редактора.
 * Правая колонка уезжала за край окна вместе с кнопками агента и PDF, а в
 * узкой колонке кнопки поля агента наезжали друг на друга
 */
const VIRTUAL_PREAMBLE_PROGRAM: Program = {
    segments: [
        {
            id: 1,
            type: 'md',
            text: '$$\n\\int_a^b f(x)\\,\\mathrm{d}x = F(b) - F(a)\n$$',
            parameters: { visible: true },
        },
        {
            id: 2,
            type: 'latex',
            text: 'Hello',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' },
};

const pdf = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);

async function openLatexProject(page: Page) {
    const routeSetup = await signedIn(page);
    routeSetup.setupLatexProject();
    await routeSetup.setupGetProjectRequest(
        200,
        'default',
        VIRTUAL_PREAMBLE_PROGRAM
    );
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await page.route('**/files/narrow.pdf', (route) =>
        route.fulfill({ contentType: 'application/pdf', body: pdf })
    );
    await page.route(
        `**/api/v4/public/project/${uuid}/compile/pdf**`,
        (route) => route.fulfill({ json: { pdfUri: '/files/narrow.pdf' } })
    );
    await page.goto(`/project/${uuid}`);
    await page.locator('.latex-header-segment').waitFor();
}

/** Правый край правой колонки внутри окна */
async function expectViewerInsideWindow(page: Page) {
    const right = await page
        .locator('.viewer-container')
        .evaluate((viewer) => viewer.getBoundingClientRect().right);
    expect(right).toBeLessThanOrEqual(page.viewportSize()!.width);
}

/** Кнопки поля агента внутри поля и не накладываются друг на друга */
async function expectPromptControlsApart(page: Page) {
    const boxes = await page.evaluate(() =>
        [
            // сами кнопки 100k, 200k и 300k: их блок ужимается, а кнопки вылезают из него
            '.agent-chat__setting .segmented-control__item',
            '.agent-chat__mode',
            '.agent-settings__toggle',
            '.agent-voice',
            '.agent-chat__submit',
        ].flatMap((selector) =>
            [...document.querySelectorAll(selector)].map((element) => {
                const rect = element.getBoundingClientRect();
                return {
                    selector: `${selector} «${element.textContent}»`,
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom,
                };
            })
        )
    );
    expect(boxes).toHaveLength(7);
    const field = (await page.locator('.agent-chat__field').boundingBox())!;
    for (const box of boxes) {
        expect(box.left, box.selector).toBeGreaterThanOrEqual(field.x);
        expect(box.right, box.selector).toBeLessThanOrEqual(
            field.x + field.width
        );
    }
    for (const [index, a] of boxes.entries()) {
        for (const b of boxes.slice(index + 1)) {
            const apart =
                a.right <= b.left ||
                b.right <= a.left ||
                a.bottom <= b.top ||
                b.bottom <= a.top;
            expect(apart, `${a.selector} и ${b.selector}`).toBe(true);
        }
    }
}

for (const viewport of [
    { width: 768, height: 1024 },
    { width: 800, height: 768 },
    { width: 900, height: 800 },
    { width: 1023, height: 800 },
]) {
    test.describe(`GH-281 ${viewport.width}x${viewport.height}`, () => {
        test.use({ viewport });

        test('правая колонка с кнопками агента и PDF целиком в окне', async ({
            page,
        }) => {
            await openLatexProject(page);
            await page.getByRole('tab', { name: 'AI agent' }).click();

            await expectViewerInsideWindow(page);
            // без файлового менеджера колонки делят ширину пополам, как и раньше
            const editor = (await page
                .locator('.editor-container')
                .boundingBox())!;
            const viewerBox = (await page
                .locator('.viewer-container')
                .boundingBox())!;
            expect(
                Math.abs(editor.width - viewerBox.width)
            ).toBeLessThanOrEqual(8);
            await expectPromptControlsApart(page);

            await page.locator('.run-button').click();
            await page.getByRole('tab', { name: 'Final document' }).click();
            const viewer = (await page
                .locator('.viewer-container')
                .boundingBox())!;
            const sheet = page.locator('[data-pdf-page] canvas').first();
            await expect(sheet).toBeVisible();
            const box = (await sheet.boundingBox())!;
            expect(box.x).toBeGreaterThanOrEqual(viewer.x);
            expect(box.x + box.width).toBeLessThanOrEqual(
                viewer.x + viewer.width
            );
        });
    });
}

// открытый файловый менеджер отнимает у редактора 260px, и правая колонка уезжала даже на 1280
test.describe('GH-281 1100x800 с файловым менеджером', () => {
    test.use({ viewport: { width: 1100, height: 800 } });

    test('правая колонка уступает место, а не уходит за край', async ({
        page,
    }) => {
        await openLatexProject(page);
        await page.locator('.file-manager-button').click();
        await page.locator('.manager-container').waitFor();
        await page.getByRole('tab', { name: 'AI agent' }).click();

        await expectViewerInsideWindow(page);
        await expectPromptControlsApart(page);
    });
});
