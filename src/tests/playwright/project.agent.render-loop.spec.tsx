import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { AgentHistoryEntry, Program } from '../../model/domain.ts';

/**
 * Страница проекта падала с React #185 («Maximum update depth exceeded») через
 * несколько секунд после открытия чата: роутер ловил ошибку и закрывал проект.
 * Ловим не сам текст ошибки, а то, из-за чего она возникает, то есть поток
 * обновлений, который не затухает
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const makeHistory = (length: number): AgentHistoryEntry[] =>
    Array.from({ length }, (_, i) => ({
        id: String(i + 1),
        request: `запрос ${i + 1}`,
        response: `ответ ${i + 1}`,
        createdAt: '2026-09-20T10:00:00Z',
    }));

/** Сколько раз панель запроса меняет высоту после того, как лента устоялась */
async function countResizesAfterOpen(page: Page, settleMs: number) {
    return page.evaluate((ms) => {
        const field = document.querySelector('.agent-chat__field');
        if (!field) {
            return -1;
        }
        let changes = 0;
        let last = (field as HTMLElement).offsetHeight;
        const observer = new ResizeObserver(() => {
            const next = (field as HTMLElement).offsetHeight;
            if (next !== last) {
                changes += 1;
                last = next;
            }
        });
        observer.observe(field);
        return new Promise<number>((resolve) => {
            window.setTimeout(() => {
                observer.disconnect();
                resolve(changes);
            }, ms);
        });
    }, settleMs);
}

/** На узком экране колонки переключает выпадающий список, а не вкладки */
async function showColumn(page: Page, name: 'AI agent' | 'PDF') {
    if ((page.viewportSize()?.width ?? 0) <= 767) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name }).click();
        return;
    }
    await page.getByRole('tab', { name }).click();
}

async function openChat(page: Page, history: AgentHistoryEntry[]) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest(history);
    await routeSetup.setupAgentSocket([]);
    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await showColumn(page, 'AI agent');
    await page.locator('.agent-chat__field').waitFor();
}

// Пустая история оставляет чат в режиме «пусто», а на проде падение пришло из
// прогона e2e, где проект свежий. Непустая история идёт рядом: в этом случае
// лента занимает фиксированную часть высоты, и обратной связи быть не должно
for (const [name, history] of [
    ['пустая история', [] as AgentHistoryEntry[]],
    ['история из шести записей', makeHistory(6)],
] as const) {
    test(`страница проекта переживает открытие чата: ${name}`, async ({
        page,
    }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await openChat(page, [...history]);

        // ошибка приходила примерно через пять секунд после открытия чата
        const resizes = await countResizesAfterOpen(page, 5000);

        expect(pageErrors).toEqual([]);
        // чат остался на месте, роутер его не закрыл
        await expect(page.locator('.agent-chat')).toBeVisible();
        // устоявшаяся панель не должна продолжать менять высоту сама по себе
        expect(resizes).toBeLessThanOrEqual(1);
    });
}

// Прогон e2e ходит по вкладкам, а не сидит на одной. Каждое открытие чата
// заново запускает загрузку истории и пересобирает панель запроса
test('чат переживает повторные открытия', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await openChat(page, makeHistory(3));

    for (let i = 0; i < 3; i++) {
        await showColumn(page, 'PDF');
        await expect(page.locator('.agent-chat')).toHaveCount(0);
        await showColumn(page, 'AI agent');
        await page.locator('.agent-chat__field').waitFor();
    }

    const resizes = await countResizesAfterOpen(page, 3000);

    expect(pageErrors).toEqual([]);
    await expect(page.locator('.agent-chat')).toBeVisible();
    expect(resizes).toBeLessThanOrEqual(1);
});

// На телефоне панель запроса живёт без ручки и на другой раскладке
test.describe('телефон', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('страница проекта переживает открытие чата на телефоне', async ({
        page,
    }) => {
        const pageErrors: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));

        await openChat(page, []);
        const resizes = await countResizesAfterOpen(page, 5000);

        expect(pageErrors).toEqual([]);
        await expect(page.locator('.agent-chat')).toBeVisible();
        expect(resizes).toBeLessThanOrEqual(1);
    });
});

/**
 * Сценарий e2e «старого пользователя», на котором упал прод 30 сентября:
 * новый LaTeX-проект ни разу не собирали, поэтому он сам открывается на агенте,
 * а через несколько секунд в него добавляют LaTeX-сегмент, печатают текст и
 * вставляют преамбулу и конец документа
 */
const EMPTY_PROGRAM: Program = {
    segments: [],
    parameters: { roundStrategy: 'noRound' },
};

async function openNewLatexProject(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    routeSetup.setupNeverCompiledProject();
    routeSetup.setupLatexProject();
    await routeSetup.setupGetProjectRequest(200, 'default', EMPTY_PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);
    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('.agent-chat')).toBeVisible();
}

async function writeLatexBodyWithBoundaries(page: Page) {
    // на телефоне редактор за переключателем колонок, как и в e2e
    if ((page.viewportSize()?.width ?? 0) <= 767) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'Editor', exact: true }).click();
        await expect(
            page.locator('.project-pane--editor.project-pane--active')
        ).toBeVisible();
    }
    await page
        .locator('.empty-project-placeholder-container')
        .getByRole('button', { name: 'Latex', exact: true })
        .click();
    const editor = page
        .locator('.segment-editor-container .cm-content')
        .first();
    await expect(editor).toBeEditable();
    await editor.focus();
    await page.keyboard.insertText('\\pagestyle{empty}\nhello');
    await page.locator('.latex-header-segment').click();
    await page.locator('.latex-footer-segment').click();
    await expect(
        page.locator('.segment-editor-container .cm-content')
    ).toHaveCount(3);
}

for (const [name, viewport] of [
    ['компьютер', { width: 1280, height: 720 }],
    ['телефон', { width: 390, height: 844 }],
] as const) {
    test.describe(name, () => {
        test.use({ viewport });

        test('новый LaTeX-проект переживает агента и набор первого сегмента', async ({
            page,
        }) => {
            const pageErrors: string[] = [];
            page.on('pageerror', (error) => pageErrors.push(error.message));

            await openNewLatexProject(page);
            await writeLatexBodyWithBoundaries(page);
            // на проде страница падала через несколько секунд после этого шага
            await page.waitForTimeout(5000);

            expect(pageErrors).toEqual([]);
            await expect(
                page.locator('.segment-editor-container .cm-content')
            ).toHaveCount(3);
        });
    });
}
