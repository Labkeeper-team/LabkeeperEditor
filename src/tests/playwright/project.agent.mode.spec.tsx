import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { AgentHistoryEntry } from '../../model/domain.ts';

/**
 * Агентский режим: на странице остаются только агент и собранный PDF.
 * Живёт по своему адресу, поэтому открывается ссылкой и переживает «назад»
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

async function openProject(
    page: Page,
    path = `/project/${uuid}`,
    {
        foreign = false,
        latex = false,
    }: { foreign?: boolean; latex?: boolean } = {}
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    await routeSetup.acceptCrossBorderConsentLocally();
    if (latex) {
        routeSetup.setupLatexProject();
    }
    await routeSetup.setupGetProjectRequest(
        200,
        foreign ? 'withTwoSegmentsBibaAndAEqualTen' : 'default'
    );
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest(HISTORY);
    await routeSetup.setupAgentSocket([]);
    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
}

const agentPane = (page: Page) => page.locator('.agent-mode-pane');
const leaveButton = (page: Page) => page.locator('.agent-mode-pane__leave');

// Замечание заказчика: в агентском режиме кнопки «Выполнить» нет, поэтому до
// первой сборки заглушка результата предлагает описать документ агенту
const AGENT_EMPTY_RESULT =
    'Describe to the agent the PDF you would like to see';

for (const [kind, latex, editorText] of [
    ['markdown', false, 'Add the code or markdown'],
    ['latex', true, 'Click the "Run" button to display the PDF file.'],
] as const) {
    test(`до первой сборки заглушка агентского режима зовёт к агенту: ${kind}`, async ({
        page,
    }) => {
        await openProject(page, `/project/${uuid}/agent`, { latex });
        const viewer = page.locator('.viewer-container');
        await expect(viewer.getByText(AGENT_EMPTY_RESULT)).toBeVisible();
        await expect(viewer.getByText(editorText)).toHaveCount(0);

        // в обычном режиме кнопка «Выполнить» есть, и текст прежний
        await leaveButton(page).click();
        await page.getByRole('tab', { name: 'PDF' }).click();
        await expect(viewer.getByText(editorText)).toBeVisible();
        await expect(viewer.getByText(AGENT_EMPTY_RESULT)).toHaveCount(0);
    });
}

test('агентский режим открывается по своему адресу', async ({ page }) => {
    await openProject(page, `/project/${uuid}/agent`);

    await expect(agentPane(page)).toBeVisible();
    // слева агент, справа PDF, редактора и файлов нет
    await expect(page.locator('.agent-chat')).toBeVisible();
    await expect(page.locator('.viewer-container')).toBeVisible();
    await expect(page.locator('.editor-container')).toHaveCount(0);
    await expect(page.locator('.manager-container')).toHaveCount(0);
});

test('в агентском режиме колонка результата не переключается вкладками', async ({
    page,
}) => {
    await openProject(page, `/project/${uuid}/agent`);

    // в режиме агента результат это документ, а не PDF
    await expect(page.locator('.viewer-header__title')).toHaveText(
        'Final document'
    );
    await expect(page.locator('.viewer-tabs')).toHaveCount(0);
});

// Замечание к макету: шапка с выходом и чат это одна карточка. Зазор между
// ними показывал тёмный фон страницы полосой, а панель ошибок под чатом
// заказчик попросил из агентского режима убрать
test('шапка и чат стоят вплотную и доходят до низа колонки', async ({
    page,
}) => {
    await openProject(page, `/project/${uuid}/agent`);
    await expect(agentPane(page)).toBeVisible();

    const pane = (await agentPane(page).boundingBox())!;
    const header = (await page
        .locator('.agent-mode-pane__header')
        .boundingBox())!;
    const chat = (await agentPane(page).locator('.agent-chat').boundingBox())!;

    expect(Math.abs(chat.y - (header.y + header.height))).toBeLessThan(1);
    expect(
        Math.abs(chat.y + chat.height - (pane.y + pane.height))
    ).toBeLessThan(1);
});

// Замечание заказчика: тёмная граница между колонками прыгала при
// переключении режимов. Обе колонки по 50% вместе с зазором были шире экрана,
// граница уезжала вправо на ширину зазора, а PDF вылезал за край
test('граница между колонками не сдвигается при переключении режимов', async ({
    page,
}) => {
    await openProject(page);
    const viewer = page.locator('.viewer-container');
    const container = page.locator('.project-container');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    const editorMode = (await viewer.boundingBox())!;
    const editor = (await page.locator('.editor-container').boundingBox())!;
    const editorGap = editorMode.x - (editor.x + editor.width);

    await page.getByRole('button', { name: 'Agent mode' }).click();
    await expect(agentPane(page)).toBeVisible();
    const agentMode = (await viewer.boundingBox())!;
    const agent = (await agentPane(page).boundingBox())!;
    const bounds = (await container.boundingBox())!;

    expect(Math.abs(agentMode.x - editorMode.x)).toBeLessThan(0.5);
    expect(Math.abs(agentMode.width - editorMode.width)).toBeLessThan(0.5);
    // PDF кончается у правого края страницы, а не за ним
    expect(
        Math.abs(agentMode.x + agentMode.width - (bounds.x + bounds.width))
    ).toBeLessThan(0.5);
    // слева от PDF тот же зазор, что в обычном режиме
    expect(
        Math.abs(agentMode.x - (agent.x + agent.width) - editorGap)
    ).toBeLessThan(0.5);
});

// Замечание заказчика: вкладок в агентском режиме нет, а очистка истории
// нужна и здесь, поэтому она стоит в шапке колонки агента
test('в агентском режиме историю можно очистить из шапки', async ({ page }) => {
    await openProject(page, `/project/${uuid}/agent`);
    const clear = page
        .locator('.agent-mode-pane__header')
        .getByRole('button', { name: 'Clear history' });
    await expect(page.locator('.agent-chat__pair')).toHaveCount(1);
    await expect(clear).toBeVisible();

    await clear.click();
    await page
        .getByRole('dialog', {
            name: 'Are you sure you want to clear the history?',
        })
        .getByRole('button', { name: 'Yes' })
        .click();

    await expect(page.locator('.agent-chat__pair')).toHaveCount(0);
    // чистить больше нечего, кнопка уходит
    await expect(clear).toHaveCount(0);
});

test('в агентском режиме нет панели ошибок сборки', async ({ page }) => {
    await openProject(page, `/project/${uuid}/agent`);
    await expect(agentPane(page)).toBeVisible();

    await expect(
        page.locator('.labkeeper-problem-viewer-container')
    ).toHaveCount(0);
});

test('кнопка сверху возвращает в обычный режим и меняет адрес', async ({
    page,
}) => {
    await openProject(page, `/project/${uuid}/agent`);
    await expect(leaveButton(page)).toBeVisible();

    await leaveButton(page).click();

    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(page.locator('.editor-container')).toBeVisible();
    await expect(agentPane(page)).toHaveCount(0);
});

// Замечание к макету: кнопка входа стоит на самой вкладке агента, у левого
// края, а не в конце полосы вкладок
test('кнопка входа лежит на вкладке агента у левого края', async ({ page }) => {
    await openProject(page);
    const agentTab = page.getByRole('tab', { name: 'AI agent' });
    await agentTab.click();
    const enter = page.getByRole('button', { name: 'Agent mode' });
    await expect(enter).toBeVisible();

    const tabBox = (await agentTab.boundingBox())!;
    const enterBox = (await enter.boundingBox())!;
    // по макету 17 px от края колонки и по центру высоты вкладки
    expect(enterBox.x - tabBox.x).toBeGreaterThanOrEqual(12);
    expect(enterBox.x - tabBox.x).toBeLessThanOrEqual(24);
    expect(enterBox.x + enterBox.width).toBeLessThan(
        tabBox.x + tabBox.width / 2
    );
    expect(
        Math.abs(
            enterBox.y + enterBox.height / 2 - (tabBox.y + tabBox.height / 2)
        )
    ).toBeLessThanOrEqual(1);
});

// Замечание заказчика: вход в режим нужен и тогда, когда открыт PDF
test('кнопка входа видна и при открытом PDF', async ({ page }) => {
    await openProject(page);
    await page.getByRole('tab', { name: 'PDF' }).click();
    const agentTab = page.getByRole('tab', { name: 'AI agent' });
    const enter = page.getByRole('button', { name: 'Agent mode' });
    await expect(enter).toBeVisible();

    const tabBox = (await agentTab.boundingBox())!;
    const enterBox = (await enter.boundingBox())!;
    expect(enterBox.x - tabBox.x).toBeGreaterThanOrEqual(12);
    expect(enterBox.x + enterBox.width).toBeLessThan(
        tabBox.x + tabBox.width / 2
    );

    await enter.click();
    await expect(page).toHaveURL(`/project/${uuid}/agent`);
});

test('кнопка на вкладке агента открывает режим и меняет адрес', async ({
    page,
}) => {
    await openProject(page);
    await page.getByRole('tab', { name: 'AI agent' }).click();

    await page.locator('.viewer-tabs__agent-mode').click();

    await expect(page).toHaveURL(`/project/${uuid}/agent`);
    await expect(agentPane(page)).toBeVisible();
});

// Второй вход по ТЗ: в настройках проекта, там же, где режимы округления
test('кнопка в настройках проекта открывает режим и меняет адрес', async ({
    page,
}) => {
    await openProject(page);
    // настройки проекта живут в первом выпадающем меню шапки редактора
    await page
        .locator('.code-settings-header-container .dropdown-menu-container')
        .first()
        .click();

    await page.locator('.project-settings-dropdown__agent-mode').click();

    await expect(page).toHaveURL(`/project/${uuid}/agent`);
    await expect(agentPane(page)).toBeVisible();
});

test('кнопка браузера «назад» возвращает в обычный режим', async ({ page }) => {
    await openProject(page);
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await page.locator('.viewer-tabs__agent-mode').click();
    await expect(agentPane(page)).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(page.locator('.editor-container')).toBeVisible();
});

// Ошибка из обзора: гость в инкогнито открывает агентский режим ссылкой или
// перезагружает его и жмёт «Открыть полный редактор кода». Адрес
// /project/default/agent принимался за проект с id default, программа
// приходила пустой, и редактор ломался
for (const [way, path] of [
    ['ссылкой', '/project/default/agent'],
    ['с перезагрузкой', '/project/default'],
] as const) {
    test(`гость открывает режим ${way} и выходит в рабочий редактор`, async ({
        page,
    }) => {
        const errors: string[] = [];
        page.on('console', (message) => {
            if (message.type() === 'error') {
                errors.push(message.text());
            }
        });
        const routeSetup = new RouteSetup(page);
        await routeSetup.setupGetUserInfoRequest(false);
        await routeSetup.acceptCrossBorderConsentLocally();
        await routeSetup.setupAgentSocket([]);
        await page.goto(path);
        if (path === '/project/default') {
            await page.getByRole('button', { name: 'Agent mode' }).click();
            await expect(agentPane(page)).toBeVisible();
            await page.reload();
        }
        await expect(agentPane(page)).toBeVisible();
        // режим пережил загрузку: адрес остался агентским
        await expect(page).toHaveURL('/project/default/agent');

        await leaveButton(page).click();

        await expect(page).toHaveURL('/project/default');
        await expect(
            page.locator('.empty-project-placeholder-container')
        ).toBeVisible();
        expect(errors.filter((text) => text.includes('TypeError'))).toEqual([]);
    });
}

// Чужой проект: агента там запускать некуда, сервер правок не примет.
// Режим с одним агентом остался бы пустым, поэтому возвращаем в обычный
test('на чужом проекте агентский режим не открывается', async ({ page }) => {
    await openProject(page, `/project/${uuid}/agent`, { foreign: true });

    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(agentPane(page)).toHaveCount(0);
});

// На телефоне колонки показываются по одной, и переключать их надо между
// агентом и PDF, без файлов и редактора
test.describe('телефон', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('переключатель колонок предлагает только агента и итоговый документ', async ({
        page,
    }) => {
        await openProject(page, `/project/${uuid}/agent`);
        await expect(agentPane(page)).toBeVisible();

        // открыт чат, и переключатель подписан им, а не редактором из обычного режима
        await expect(
            page.locator('.mobile-view-switcher-bar__label')
        ).toHaveText('AI agent');
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        const options = page.getByRole('option');

        await expect(options).toHaveCount(2);
        await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
        await expect(options.nth(0)).toHaveText('AI agent');
        await expect(options.nth(1)).toHaveText('Final document');
    });

    test('на телефоне видна одна колонка за раз', async ({ page }) => {
        await openProject(page, `/project/${uuid}/agent`);

        await expect(page.locator('.agent-chat')).toBeVisible();
        await expect(page.locator('.viewer-container')).toBeHidden();

        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'Final document' }).click();

        await expect(page.locator('.viewer-container')).toBeVisible();
        await expect(page.locator('.agent-chat')).toBeHidden();
    });

    test('выход в обычный режим работает и на телефоне', async ({ page }) => {
        await openProject(page, `/project/${uuid}/agent`);

        await leaveButton(page).click();

        await expect(page).toHaveURL(`/project/${uuid}`);
        await expect(agentPane(page)).toHaveCount(0);
    });
});
