import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { PERSISTENCE_VERSION } from '../../view/store/persistMigrations.ts';
import { AgentHistoryEntry, Program } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const HISTORY: AgentHistoryEntry[] = Array.from({ length: 6 }, (_, i) => ({
    id: String(i + 1),
    request: `запрос ${i + 1}`,
    response: `ответ ${i + 1}\n\nвторой абзац ответа`,
    createdAt: '2026-09-20T10:00:00Z',
}));

/** Сегмент в редакторе рядом с чатом: в него кликают мимо панели */
const ONE_SEGMENT: Program = {
    segments: [
        { id: 1, type: 'md', text: 'текст', parameters: { visible: true } },
    ],
    parameters: { roundStrategy: 'noRound' },
};

const DONE = { type: 'agentFinished', message: 'готово', stopReason: 'Done' };

test.use({ viewport: { width: 1360, height: 900 } });

type Frame = Record<string, unknown>;

async function openChat(
    page: Page,
    {
        history = [],
        frames = [],
        program,
    }: {
        history?: AgentHistoryEntry[];
        frames?: Frame[];
        program?: Program;
    } = {}
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(true);
    // согласие на передачу данных проверяется отдельной спекой, здесь оно дано
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default', program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest(history);
    const sent = await routeSetup.setupAgentSocket(frames);
    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await openAgentTab(page);
    await page.locator('.agent-chat__field').waitFor();
    if (history.length) {
        await page.locator('.agent-chat__request').first().waitFor();
    }
    return sent;
}

/** Гость попадает на проект по умолчанию, и несобранный проект сам открывается на агенте */
async function openGuestChat(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.acceptCrossBorderConsentLocally();
    const sent = await routeSetup.setupAgentSocket([]);
    await page.goto('/');
    await expect(page).toHaveURL('/project/default');
    await expect(page.locator('.agent-chat__field')).toBeVisible();
    return sent;
}

/** На узком экране колонки переключает выпадающий список, а не вкладки */
async function openAgentTab(page: Page) {
    if ((page.viewportSize()?.width ?? 0) <= 767) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'AI agent' }).click();
        return;
    }
    await page.getByRole('tab', { name: 'AI agent' }).click();
}

const settingsButton = (page: Page) =>
    page.getByRole('button', { name: 'Agent settings' });
const panel = (page: Page) =>
    page.getByRole('dialog', { name: 'Agent settings' });
const iterations = (page: Page) =>
    panel(page).getByRole('group', { name: 'Max Iterations' });
const contextSize = (page: Page) =>
    page.getByRole('group', { name: 'Context Size' });
const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');
const authModal = (page: Page) => page.locator('.auth-modal');
const separator = (page: Page) =>
    page.getByRole('separator', { name: 'Prompt field height' });

async function openSettings(page: Page) {
    await settingsButton(page).click();
    await expect(panel(page)).toBeVisible();
}

async function submitPrompt(page: Page, text: string) {
    await promptField(page).fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
}

const storedSlice = (page: Page) =>
    page.evaluate(() => {
        const raw = window.localStorage.getItem('persist:PERSISTENCE');
        if (!raw) {
            return null;
        }
        const slice = JSON.parse(raw);
        return {
            version: JSON.parse(slice._persist).version,
            agentMaxTokens: JSON.parse(slice.agentMaxTokens),
            agentIterations: JSON.parse(slice.agentIterations),
        };
    });

/** Что мешает увидеть панель целиком: выход за окно и за колонку чата, обрезка предком с overflow, наезд на ряд кнопок и чужие элементы поверх; точки идут сеткой через 6px, иначе тонкая ручка поля или край ленты проскочили бы между ними */
const panelProblems = (page: Page) =>
    panel(page).evaluate((node) => {
        const problems: string[] = [];
        const box = node.getBoundingClientRect();
        const describe = (el: Element | null) =>
            el ? `${el.tagName}.${String(el.className)}` : 'null';
        if (
            box.top < 0 ||
            box.left < 0 ||
            box.right > window.innerWidth + 0.5 ||
            box.bottom > window.innerHeight + 0.5
        ) {
            problems.push(`outside viewport ${JSON.stringify(box)}`);
        }
        for (let el = node.parentElement; el; el = el.parentElement) {
            const style = getComputedStyle(el);
            if (
                style.overflowX === 'visible' &&
                style.overflowY === 'visible'
            ) {
                continue;
            }
            const clip = el.getBoundingClientRect();
            if (
                box.top < clip.top - 0.5 ||
                box.bottom > clip.bottom + 0.5 ||
                box.left < clip.left - 0.5 ||
                box.right > clip.right + 0.5
            ) {
                problems.push(`clipped by ${describe(el)}`);
            }
        }
        const controls = document
            .querySelector('.agent-chat__controls')!
            .getBoundingClientRect();
        if (box.bottom > controls.top + 0.5) {
            problems.push('covers the controls row');
        }
        // выше колонки чата лежат вкладки и шапка, их панель закрывать не должна
        const chat = document
            .querySelector('.agent-chat')!
            .getBoundingClientRect();
        if (box.top < chat.top - 0.5) {
            problems.push('rises above the chat column');
        }
        // скругление углов 8px: у самого края точка попала бы мимо панели
        const xs = [box.left + 8, (box.left + box.right) / 2, box.right - 8];
        for (let y = box.top + 4; y <= box.bottom - 4; y += 6) {
            for (const x of xs) {
                const hit = document.elementFromPoint(x, y);
                if (!hit || !node.contains(hit)) {
                    problems.push(`covered at ${x},${y} by ${describe(hit)}`);
                }
            }
        }
        return problems;
    });

const separatorBounds = async (page: Page) => ({
    min: await separator(page).getAttribute('aria-valuemin'),
    max: await separator(page).getAttribute('aria-valuemax'),
});

const NO_HANDLE_ON_TOUCH = 'ручка поля есть только при мыши или тачпаде';

/** Ручка пересчитывает границы на своей клавише, поэтому End и меряет, и тянет поле до максимума */
async function stretchFieldToMax(page: Page) {
    await separator(page).focus();
    await page.keyboard.press('End');
    await expect
        .poll(async () => {
            const bounds = await separatorBounds(page);
            return (
                (await separator(page).getAttribute('aria-valuenow')) ===
                bounds.max
            );
        })
        .toBe(true);
}

test('agent-start-sends-default-settings', async ({ page }) => {
    const sent = await openChat(page);

    await submitPrompt(page, 'перепиши введение');

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toEqual({
        type: 'startAgent',
        prompt: 'перепиши введение',
        numberIterations: 500,
        maxTokens: 100000,
    });
});

test('guest-agent-start-sends-default-settings', async ({ page }) => {
    const sent = await openGuestChat(page);

    await submitPrompt(page, 'поправь введение');

    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({
        type: 'startAgentUnauthorized',
        numberIterations: 500,
        maxTokens: 100000,
    });
});

test('settings-offer-the-values-set-by-the-customer', async ({ page }) => {
    await openChat(page);
    await openSettings(page);

    await expect(contextSize(page).getByRole('button')).toHaveText([
        '100k',
        '200k',
        '300k',
    ]);
    await expect(iterations(page).getByRole('button')).toHaveText([
        '200',
        '500',
        '1000',
    ]);
});

test('old-saved-settings-become-new-defaults-once', async ({ page }) => {
    // так срез лежит у тех, кто заходил до смены значений; перезагрузка его заново не подкладывает
    await page.addInitScript(() => {
        if (window.sessionStorage.getItem('old-slice-seeded')) {
            return;
        }
        window.sessionStorage.setItem('old-slice-seeded', '1');
        window.localStorage.setItem(
            'persist:PERSISTENCE',
            JSON.stringify({
                agentMaxTokens: '10000',
                agentIterations: '5',
                instructionExpanded: 'false',
                _persist: '{"version":-1,"rehydrated":true}',
            })
        );
    });
    const sent = await openChat(page, { frames: [DONE] });

    await submitPrompt(page, 'первый');
    await expect.poll(() => sent.length).toBe(1);
    expect(sent[0]).toMatchObject({ numberIterations: 500, maxTokens: 100000 });
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();

    await openSettings(page);
    await iterations(page).getByRole('button', { name: '1000' }).click();
    await contextSize(page).getByRole('button', { name: '200k' }).click();
    // redux-persist пишет в localStorage асинхронно
    await expect
        .poll(() => storedSlice(page))
        .toEqual({
            version: PERSISTENCE_VERSION,
            agentMaxTokens: 200000,
            agentIterations: 1000,
        });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await openAgentTab(page);
    await submitPrompt(page, 'второй');

    await expect.poll(() => sent.length).toBe(2);
    expect(sent[1]).toMatchObject({
        numberIterations: 1000,
        maxTokens: 200000,
    });
});

test('settings-panel-toggles-by-its-button-and-returns-focus', async ({
    page,
}) => {
    await openChat(page);
    await expect(settingsButton(page)).toHaveAttribute(
        'aria-expanded',
        'false'
    );

    await openSettings(page);

    await expect(settingsButton(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(settingsButton(page)).toHaveAttribute(
        'aria-controls',
        (await panel(page).getAttribute('id'))!
    );
    await expect(panel(page)).toBeFocused();
    // подсказка написана в панели: на сенсорном экране title не показывается
    await expect(
        panel(page).getByText(
            'How many steps the agent takes before it stops. More steps handle harder tasks and cost more'
        )
    ).toBeVisible();

    await settingsButton(page).click();

    await expect(panel(page)).toBeHidden();
    await expect(settingsButton(page)).toHaveAttribute(
        'aria-expanded',
        'false'
    );
    await expect(settingsButton(page)).toBeFocused();
});

test('settings-panel-closes-by-its-close-button-and-returns-focus', async ({
    page,
}) => {
    await openChat(page);
    await openSettings(page);

    await panel(page).getByRole('button', { name: 'Close settings' }).click();

    await expect(panel(page)).toBeHidden();
    await expect(settingsButton(page)).toBeFocused();
});

test('settings-panel-closes-by-escape-and-returns-focus', async ({ page }) => {
    await openChat(page);
    await openSettings(page);
    await iterations(page).getByRole('button', { name: '500' }).focus();

    await page.keyboard.press('Escape');

    await expect(panel(page)).toBeHidden();
    await expect(settingsButton(page)).toBeFocused();
});

test('settings-panel-closes-by-outside-click-without-stealing-focus', async ({
    page,
}) => {
    await openChat(page, { program: ONE_SEGMENT });
    await openSettings(page);

    // подпись под пустым чатом: клик мимо панели по месту, которое фокус не берёт
    await page.locator('.agent-chat__disclaimer').click();

    await expect(panel(page)).toBeHidden();

    await openSettings(page);
    // поле запроса под панелью, поэтому кликаем в сегмент редактора рядом с чатом
    const segment = page
        .locator('.segment-editor-container .cm-content')
        .first();
    await segment.click();

    await expect(panel(page)).toBeHidden();
    // фокус остаётся там, куда кликнули, иначе печатать пришлось бы после второго клика
    await expect(segment).toBeFocused();
});

test('escape-in-settings-panel-does-not-reach-the-page', async ({ page }) => {
    await openChat(page);
    const searchField = page.getByRole('textbox', {
        name: /Enter text to search/i,
    });
    await page.locator('div.action-button').last().click();
    await expect(searchField).toBeVisible();
    await openSettings(page);

    await page.keyboard.press('Escape');

    await expect(panel(page)).toBeHidden();
    // Esc страницы закрыл бы поиск: панель забирает клавишу себе
    await expect(searchField).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(searchField).toBeHidden();
});

test('settings-values-are-disabled-while-agent-runs', async ({ page }) => {
    // кадров нет: агент так и остаётся в работе
    await openChat(page);
    await submitPrompt(page, 'долгий запрос');
    await expect(
        page.getByRole('button', { name: 'Stop', exact: true })
    ).toBeVisible();

    await openSettings(page);

    for (const value of ['200', '500', '1000']) {
        await expect(
            iterations(page).getByRole('button', { name: value, exact: true })
        ).toBeDisabled();
    }
    await expect(
        contextSize(page).getByRole('button', { name: '200k' })
    ).toBeDisabled();
});

for (const size of [
    { width: 1360, height: 900 },
    { width: 390, height: 844 },
]) {
    test.describe(`guest ${size.width}x${size.height}`, () => {
        test.use({ viewport: size });

        test('guest-gets-login-over-the-settings-panel', async ({ page }) => {
            await openGuestChat(page);
            await openSettings(page);

            await iterations(page)
                .getByRole('button', { name: '1000' })
                .click();

            await expect(authModal(page)).toBeVisible();
            await expect(
                iterations(page).getByRole('button', { name: '500' })
            ).toHaveAttribute('aria-pressed', 'true');
            // окно входа лежит поверх панели: в центре панели клик достанется накладке окна
            const onTop = await page.evaluate(() => {
                const settings = document.querySelector('[role="dialog"]')!;
                const box = settings.getBoundingClientRect();
                const hit = document.elementFromPoint(
                    (box.left + box.right) / 2,
                    (box.top + box.bottom) / 2
                );
                return Boolean(hit?.closest('.modal-container-overlay'));
            });
            expect(onTop).toBe(true);
        });
    });
}

const LAYOUTS = [
    { width: 1360, height: 900 },
    { width: 1280, height: 720 },
    // 768-1024: шелл уменьшен через transform: scale
    { width: 900, height: 800 },
    { width: 820, height: 1180 },
    { width: 390, height: 844 },
    // телефон с открытой клавиатурой
    { width: 390, height: 500 },
    { width: 844, height: 390 },
    { width: 360, height: 740 },
    { width: 320, height: 640 },
];

for (const size of LAYOUTS) {
    test.describe(`layout ${size.width}x${size.height}`, () => {
        test.use({ viewport: size });

        for (const history of [[], HISTORY]) {
            const chat = history.length ? 'history' : 'empty';

            test(`settings-panel-is-fully-visible-in-${chat}-chat`, async ({
                page,
            }) => {
                await openChat(page, { history });

                await openSettings(page);

                expect(await panelProblems(page)).toEqual([]);
                // крайняя справа и самая широкая кнопка первой вылезла бы за панель
                const widest = iterations(page).getByRole('button', {
                    name: '1000',
                });
                await widest.scrollIntoViewIfNeeded();
                await expect(widest).toBeInViewport({ ratio: 1 });
            });
        }

        test('prompt-controls-stay-in-one-row', async ({ page }) => {
            await openChat(page);

            // при переносе ряда кнопки уезжают под переключатель контекста; poll пережидает раскладку до масштаба
            await expect
                .poll(() =>
                    page.evaluate(() => {
                        const context = document
                            .querySelector(
                                '[role="group"][aria-label="Context Size"]'
                            )!
                            .getBoundingClientRect();
                        return [
                            '.agent-settings__toggle',
                            '.agent-chat__submit',
                        ].filter(
                            (selector) =>
                                document
                                    .querySelector(selector)!
                                    .getBoundingClientRect().top >=
                                context.bottom
                        );
                    })
                )
                .toEqual([]);
        });
    });
}

for (const size of [
    { width: 1360, height: 900 },
    { width: 1280, height: 720 },
    { width: 900, height: 800 },
]) {
    test.describe(`stretched field ${size.width}x${size.height}`, () => {
        test.use({ viewport: size });

        test('settings-panel-is-fully-visible-over-a-stretched-field', async ({
            page,
            hasTouch,
        }) => {
            test.skip(hasTouch, NO_HANDLE_ON_TOUCH);
            await openChat(page, { history: HISTORY });
            await stretchFieldToMax(page);

            await openSettings(page);

            expect(await panelProblems(page)).toEqual([]);
        });
    });
}

for (const history of [[], HISTORY]) {
    test(`settings-panel-keeps-resize-bounds-in-${history.length ? 'history' : 'empty'}-chat`, async ({
        page,
        hasTouch,
    }) => {
        test.skip(hasTouch, NO_HANDLE_ON_TOUCH);
        await openChat(page, { history });
        await stretchFieldToMax(page);
        const before = await separatorBounds(page);

        await openSettings(page);
        // фокус уводим без клика, иначе панель закроется, а ручка не перемерит границы
        await stretchFieldToMax(page);

        await expect(panel(page)).toBeVisible();
        expect(await separatorBounds(page)).toEqual(before);
    });
}
