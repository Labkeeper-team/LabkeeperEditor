import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { AgentHistoryEntry } from '../../model/domain.ts';

/**
 * Очистка истории агента: корзина лежит на самой вкладке агента, и историю
 * стирает только подтверждение, пока человек не попросит больше не спрашивать
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const HISTORY: AgentHistoryEntry[] = [
    {
        id: '1',
        request: 'сократи первый сегмент',
        response: 'готово',
        createdAt: '2026-09-20T10:00:00Z',
    },
];

test.use({ viewport: { width: 1360, height: 900 } });

async function openChat(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default');
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    const history = await routeSetup.setupAgentHistoryRequest(HISTORY);
    await routeSetup.setupAgentSocket([]);
    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect(page.locator('.agent-chat__pair')).toHaveCount(1);
    return {
        // мок истории помнит очистку, как сервер: новая запись нужна, чтобы чистить снова
        addHistory: () => history.push(...HISTORY),
    };
}

const clearButton = (page: Page) =>
    page.getByRole('button', { name: 'Clear history' });
const confirmDialog = (page: Page) =>
    page.getByRole('dialog', {
        name: 'Are you sure you want to clear the history?',
    });

const tabBoxes = (page: Page) =>
    page.locator('.viewer-tabs__tab').evaluateAll((tabs) =>
        tabs.map((tab) => {
            const box = tab.getBoundingClientRect();
            return { x: box.x, width: box.width };
        })
    );

test('корзина стоит на вкладке агента, и вкладки не меняют ширину при переключении', async ({
    page,
}) => {
    await openChat(page);
    const onChat = await tabBoxes(page);
    const agentTab = await page
        .getByRole('tab', { name: 'AI agent' })
        .boundingBox();
    const clear = await clearButton(page).boundingBox();
    expect(agentTab && clear).toBeTruthy();
    expect(clear!.x).toBeGreaterThanOrEqual(agentTab!.x);
    expect(clear!.x + clear!.width).toBeLessThanOrEqual(
        agentTab!.x + agentTab!.width
    );

    await page.getByRole('tab', { name: 'PDF visualization' }).click();
    await expect(clearButton(page)).toHaveCount(0);

    expect(await tabBoxes(page)).toEqual(onChat);
});

test('очистка спрашивает подтверждение, и «Нет» оставляет историю', async ({
    page,
}) => {
    await openChat(page);

    await clearButton(page).click();
    await expect(confirmDialog(page)).toBeVisible();
    await expect(
        confirmDialog(page).getByRole('checkbox', { name: "Don't ask again" })
    ).not.toBeChecked();
    await confirmDialog(page).getByRole('button', { name: 'No' }).click();

    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(page.locator('.agent-chat__pair')).toHaveCount(1);
});

test('«Да» очищает историю', async ({ page }) => {
    await openChat(page);

    await clearButton(page).click();
    await confirmDialog(page).getByRole('button', { name: 'Yes' }).click();

    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(page.locator('.agent-chat__pair')).toHaveCount(0);
});

test('«больше не спрашивать» переживает перезагрузку, и следующая очистка идёт сразу', async ({
    page,
}) => {
    const { addHistory } = await openChat(page);
    await clearButton(page).click();
    await confirmDialog(page)
        .getByRole('checkbox', { name: "Don't ask again" })
        .check();
    await confirmDialog(page).getByRole('button', { name: 'Yes' }).click();
    await expect(page.locator('.agent-chat__pair')).toHaveCount(0);

    addHistory();
    await page.reload();
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect(page.locator('.agent-chat__pair')).toHaveCount(1);
    await clearButton(page).click();

    await expect(page.locator('.agent-chat__pair')).toHaveCount(0);
    await expect(confirmDialog(page)).toHaveCount(0);
});

test('без галки подтверждение спрашивают и в следующий раз', async ({
    page,
}) => {
    const { addHistory } = await openChat(page);
    await clearButton(page).click();
    await confirmDialog(page).getByRole('button', { name: 'Yes' }).click();
    await expect(page.locator('.agent-chat__pair')).toHaveCount(0);

    addHistory();
    await page.reload();
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect(page.locator('.agent-chat__pair')).toHaveCount(1);
    await clearButton(page).click();

    await expect(confirmDialog(page)).toBeVisible();
});
