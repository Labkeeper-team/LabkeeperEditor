import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { AgentHistoryEntry } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

const makeHistory = (length: number): AgentHistoryEntry[] =>
    Array.from({ length }, (_, i) => ({
        id: String(i + 1),
        request: `запрос ${i + 1}`,
        response: `ответ ${i + 1}\n\nвторой абзац ответа`,
        createdAt: '2026-09-20T10:00:00Z',
    }));

const HISTORY = makeHistory(6);

/** Нынешняя высота пустой панели: 60px поля ввода и 92px рамки, отступов и кнопок */
const MIN_HEIGHT = 152;
/** Потолок автороста: поле ввода упирается в 168px */
const AUTOGROW_MAX_HEIGHT = 260;

test.use({ viewport: { width: 1360, height: 900 } });

async function openChat(
    page: Page,
    { history = HISTORY }: { history?: AgentHistoryEntry[] } = {}
) {
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
    await openAgentTab(page);
    await page.locator('.agent-chat__field').waitFor();
    if (history.length) {
        await page.locator('.agent-chat__request').first().waitFor();
    }
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

const separator = (page: Page) =>
    page.getByRole('separator', { name: 'Prompt field height' });
const field = (page: Page) => page.locator('.agent-chat__field');
const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');

const layoutHeight = (page: Page, selector: string) =>
    page
        .locator(selector)
        .evaluate((node) => (node as HTMLElement).offsetHeight);

const inlineHeight = (page: Page) =>
    field(page).evaluate((node) => (node as HTMLElement).style.height);

const storedHeight = (page: Page) =>
    page.evaluate(() => {
        const raw = window.localStorage.getItem('persist:PERSISTENCE');
        const value = raw ? JSON.parse(raw).agentPromptHeight : undefined;
        return value === undefined ? undefined : JSON.parse(value);
    });

/** Какие высоты уходили в localStorage: срез пишется целиком на любую правку, поэтому повторы схлопнуты */
async function recordHeightWrites(page: Page) {
    await page.addInitScript(() => {
        const writes: number[] = [];
        (window as unknown as { heightWrites: number[] }).heightWrites = writes;
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key: string, value: string) {
            if (key === 'persist:PERSISTENCE') {
                const raw = JSON.parse(value).agentPromptHeight;
                const height = raw === undefined ? null : JSON.parse(raw);
                if (
                    typeof height === 'number' &&
                    writes[writes.length - 1] !== height
                ) {
                    writes.push(height);
                }
            }
            return setItem.call(this, key, value);
        };
    });
}

const heightWrites = (page: Page) =>
    page.evaluate(
        () => (window as unknown as { heightWrites: number[] }).heightWrites
    );

/** Каретка CodeMirror внутри видимой части поля ввода */
const caretInsideEditor = (page: Page) =>
    page.evaluate(() => {
        const scroller = document.querySelector(
            '.agent-chat__input .cm-scroller'
        ) as HTMLElement;
        const selection = window.getSelection();
        const caret = selection?.rangeCount
            ? selection.getRangeAt(0).getBoundingClientRect()
            : null;
        const box = scroller.getBoundingClientRect();
        return (
            caret !== null &&
            caret.bottom <= box.bottom + 1 &&
            caret.top >= box.top - 1
        );
    });

/** Курсор не уводим за окно: Firefox в Playwright отдаёт такие движения с clientY -85 и теряет pointerup */
async function dragSeparator(page: Page, dy: number, steps = 8) {
    const box = await separator(page).boundingBox();
    if (!box) {
        throw new Error('нет ручки');
    }
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const viewportHeight = page.viewportSize()!.height;
    const shift = Math.min(Math.max(dy, 2 - y), viewportHeight - 2 - y);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + shift, { steps });
    const during = await field(page).boundingBox();
    await page.mouse.up();
    return { endY: y + shift, during: during! };
}

async function typeLines(page: Page, count: number) {
    await promptField(page).click();
    for (let i = 0; i < count; i++) {
        await page.keyboard.type(`строка ${i + 1}`);
        await page.keyboard.press('Shift+Enter');
    }
    await page.keyboard.type('последняя');
}

const mobileScale = async (page: Page) =>
    Number(
        await page.evaluate(() =>
            getComputedStyle(document.documentElement).getPropertyValue(
                '--mobile-scale'
            )
        )
    );

test('drag-up-grows-field-and-top-edge-follows-pointer', async ({ page }) => {
    await recordHeightWrites(page);
    await openChat(page);
    const transcriptBefore = await layoutHeight(
        page,
        '.agent-chat__transcript'
    );

    const { endY, during } = await dragSeparator(page, -150);

    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        MIN_HEIGHT + 150
    );
    expect(await layoutHeight(page, '.agent-chat__transcript')).toBe(
        transcriptBefore - 150
    );
    // центр ручки на 2px выше верхней рамки панели
    expect(Math.abs(during.y - (endY + 2))).toBeLessThanOrEqual(1.5);
    await expect.poll(() => storedHeight(page)).toBe(MIN_HEIGHT + 150);
    // пока тянули, хранилище не трогали: срез с lastProgram пишется целиком
    expect(await heightWrites(page)).toEqual([MIN_HEIGHT + 150]);
});

test('drag-down-stops-at-min', async ({ page }) => {
    await openChat(page);
    await dragSeparator(page, -200);
    await dragSeparator(page, 600);

    expect(await layoutHeight(page, '.agent-chat__field')).toBe(MIN_HEIGHT);
    await expect(separator(page)).toHaveAttribute(
        'aria-valuenow',
        String(MIN_HEIGHT)
    );
    await expect(separator(page)).toHaveAttribute(
        'aria-valuemin',
        String(MIN_HEIGHT)
    );
});

test('drag-up-stops-at-max-and-transcript-stays', async ({ page }) => {
    await openChat(page);
    await dragSeparator(page, -2000, 12);

    expect(await layoutHeight(page, '.agent-chat__transcript')).toBe(120);
    const max = await separator(page).getAttribute('aria-valuemax');
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(Number(max));
});

test('click-without-move-keeps-autogrow', async ({ page }) => {
    await openChat(page);
    await separator(page).click();
    expect(await storedHeight(page)).toBe(null);

    await typeLines(page, 14);

    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        AUTOGROW_MAX_HEIGHT
    );
});

test('double-click-resets-to-autogrow', async ({ page }) => {
    await openChat(page);
    await dragSeparator(page, -200);
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        MIN_HEIGHT + 200
    );

    await separator(page).dblclick();

    await expect.poll(() => storedHeight(page)).toBe(null);
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(MIN_HEIGHT);
});

test('keyboard-arrows-pages-home-end-enter', async ({ page }) => {
    await openChat(page);
    const handle = separator(page);
    await handle.focus();

    await page.keyboard.press('ArrowUp');
    await expect(handle).toHaveAttribute('aria-valuenow', '170');
    await page.keyboard.press('Shift+ArrowUp');
    await expect(handle).toHaveAttribute('aria-valuenow', '260');
    await page.keyboard.press('ArrowDown');
    await expect(handle).toHaveAttribute('aria-valuenow', '242');
    await page.keyboard.press('PageUp');
    await expect(handle).toHaveAttribute('aria-valuenow', '332');
    await page.keyboard.press('PageDown');
    await expect(handle).toHaveAttribute('aria-valuenow', '242');
    await page.keyboard.press('End');
    const max = (await handle.getAttribute('aria-valuemax'))!;
    await expect(handle).toHaveAttribute('aria-valuenow', max);
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(Number(max));
    await expect.poll(() => storedHeight(page)).toBe(Number(max));

    await page.keyboard.press('Home');
    await expect(handle).toHaveAttribute('aria-valuenow', String(MIN_HEIGHT));
    await page.keyboard.press('Enter');
    await expect.poll(() => storedHeight(page)).toBe(null);
});

test('keyboard-focus-rings-the-grip', async ({ page }) => {
    await openChat(page);
    await promptField(page).click();

    // ручка стоит в порядке Tab прямо перед полем
    await page.keyboard.press('Shift+Tab');

    await expect(separator(page)).toBeFocused();
    const ring = await separator(page).evaluate((node) => {
        const style = getComputedStyle(node, '::after');
        return { style: style.outlineStyle, width: style.outlineWidth };
    });
    expect(ring).toEqual({ style: 'solid', width: '2px' });
});

test('held-arrow-writes-storage-once', async ({ page }) => {
    await recordHeightWrites(page);
    await openChat(page);
    await separator(page).focus();

    // автоповтор зажатой стрелки: keydown с repeat примерно раз в 30 мс
    await separator(page).evaluate(async (node) => {
        for (let i = 0; i < 10; i++) {
            node.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'ArrowUp',
                    repeat: i > 0,
                    bubbles: true,
                    cancelable: true,
                })
            );
            await new Promise((done) => setTimeout(done, 30));
        }
    });

    await expect(separator(page)).toHaveAttribute(
        'aria-valuenow',
        String(MIN_HEIGHT + 180)
    );
    await expect.poll(() => storedHeight(page)).toBe(MIN_HEIGHT + 180);
    expect(await heightWrites(page)).toEqual([MIN_HEIGHT + 180]);
});

test('drag-just-after-arrow-is-not-undone-by-pending-save', async ({
    page,
}) => {
    await recordHeightWrites(page);
    await openChat(page);
    const handle = separator(page);
    await handle.focus();
    await page.keyboard.press('ArrowUp');
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 100, { steps: 4 });
    // отложенная запись стрелки успевает истечь, пока кнопка ещё зажата
    await page.waitForTimeout(500);

    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        MIN_HEIGHT + 18 + 100
    );
    await page.mouse.up();
    await expect.poll(() => storedHeight(page)).toBe(MIN_HEIGHT + 18 + 100);
    expect(await heightWrites(page)).toEqual([
        MIN_HEIGHT + 18,
        MIN_HEIGHT + 18 + 100,
    ]);
});

test('no-handle-on-phone-width', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openChat(page);

    await expect(page.locator('.agent-chat__resize')).toHaveCount(0);
    await expect(separator(page)).toHaveCount(0);
});

test('stored-height-ignored-on-phone-width', async ({ page }) => {
    await openChat(page);
    await dragSeparator(page, -200);
    await expect.poll(() => storedHeight(page)).toBe(MIN_HEIGHT + 200);

    await page.setViewportSize({ width: 390, height: 844 });
    await openAgentTab(page);

    await expect(page.locator('.agent-chat__resize')).toHaveCount(0);
    await expect.poll(() => inlineHeight(page)).toBe('');
});

test.describe('phone-landscape', () => {
    // Firefox не умеет isMobile, ему хватает сенсорного экрана без мыши
    test.use({
        viewport: { width: 844, height: 390 },
        hasTouch: true,
        isMobile: async ({ browserName }, provide) =>
            provide(browserName !== 'firefox'),
    });

    test('no-handle-on-phone-landscape', async ({ page }) => {
        await openChat(page);

        await expect(promptField(page)).toBeVisible();
        await expect(page.locator('.agent-chat__resize')).toHaveCount(0);
        await expect(separator(page)).toHaveCount(0);
    });
});

test('handle-hides-when-fine-pointer-goes-away', async ({
    page,
    browserName,
}) => {
    test.skip(browserName !== 'chromium', 'эмуляция тача через CDP');
    await openChat(page);
    await dragSeparator(page, -200);
    await expect.poll(() => storedHeight(page)).toBe(MIN_HEIGHT + 200);

    // мышь отключили: остался только сенсорный экран, ширина окна та же
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setTouchEmulationEnabled', {
        enabled: true,
        maxTouchPoints: 1,
    });

    await expect(separator(page)).toHaveCount(0);
    await expect.poll(() => inlineHeight(page)).toBe('');
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(MIN_HEIGHT);
});

test('scaled-layout-top-edge-follows-pointer', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openChat(page);
    const scale = await mobileScale(page);
    expect(scale).toBeLessThan(1);

    const { endY, during } = await dragSeparator(page, -100);

    expect(Math.abs(during.y - (endY + 2 * scale))).toBeLessThanOrEqual(1.5);
    const after = await layoutHeight(page, '.agent-chat__field');
    expect(Math.abs(after - (MIN_HEIGHT + 100 / scale))).toBeLessThanOrEqual(1);
});

test('empty-chat-top-edge-follows-pointer', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openChat(page, { history: [] });

    const { endY, during } = await dragSeparator(page, -80);

    expect(Math.abs(during.y - (endY + 2))).toBeLessThanOrEqual(1.5);
});

test('empty-chat-scaled-top-edge-follows-pointer', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 700 });
    await openChat(page, { history: [] });
    const scale = await mobileScale(page);
    expect(scale).toBeLessThan(1);

    const { endY, during } = await dragSeparator(page, -60);

    expect(Math.abs(during.y - (endY + 2 * scale))).toBeLessThanOrEqual(1.5);
});

test('empty-chat-max-keeps-disclaimer-inside', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await openChat(page, { history: [] });

    await dragSeparator(page, -2000, 12);

    const max = await separator(page).getAttribute('aria-valuemax');
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(Number(max));
    const geometry = await page.evaluate(() => {
        const chat = document.querySelector('.agent-chat') as HTMLElement;
        const rect = (selector: string) =>
            document.querySelector(selector)!.getBoundingClientRect();
        return {
            overflow: chat.scrollHeight - chat.clientHeight,
            chatBottom: rect('.agent-chat').bottom,
            fieldBottom: rect('.agent-chat__field').bottom,
            disclaimerTop: rect('.agent-chat__disclaimer').top,
            disclaimerBottom: rect('.agent-chat__disclaimer').bottom,
        };
    });
    expect(geometry.overflow).toBe(0);
    expect(geometry.fieldBottom).toBeLessThanOrEqual(geometry.disclaimerTop);
    // 16px нижнего отступа колонки
    expect(geometry.disclaimerBottom).toBeLessThanOrEqual(
        geometry.chatBottom - 16 + 0.5
    );
});

test('editor-scrolls-inside-and-cursor-visible', async ({ page }) => {
    await openChat(page);
    // выше прежнего потолка поля ввода в 168px, иначе max-height не проверяется
    await dragSeparator(page, -300);

    await typeLines(page, 30);

    const editor = await page.evaluate(() => {
        const scroller = document.querySelector(
            '.agent-chat__input .cm-scroller'
        ) as HTMLElement;
        const view = document.querySelector(
            '.agent-chat__input .cm-editor'
        ) as HTMLElement;
        return {
            height: view.offsetHeight,
            scrollerHeight: scroller.clientHeight,
            scrollHeight: scroller.scrollHeight,
        };
    });
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        MIN_HEIGHT + 300
    );
    expect(editor.height).toBe(MIN_HEIGHT + 300 - 92);
    expect(editor.scrollerHeight).toBe(editor.height);
    expect(editor.scrollHeight).toBeGreaterThan(editor.scrollerHeight);
    expect(await caretInsideEditor(page)).toBe(true);
});

test('shrink-after-typing-keeps-cursor-visible', async ({ page }) => {
    await openChat(page);
    await dragSeparator(page, -300);
    await typeLines(page, 30);

    await dragSeparator(page, 200);

    await expect.poll(() => caretInsideEditor(page)).toBe(true);
    expect(
        await page.evaluate(() => document.scrollingElement?.scrollTop ?? 0)
    ).toBe(0);
    // фокус остался в поле, и набор продолжается с того же места
    await page.keyboard.type('!');
    await expect(page.locator('.agent-chat__input .cm-line').last()).toHaveText(
        'последняя!'
    );
});

test('height-survives-reload', async ({ page }) => {
    await openChat(page);
    await dragSeparator(page, -180);
    await expect.poll(() => storedHeight(page)).toBe(MIN_HEIGHT + 180);

    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await openAgentTab(page);
    await page.locator('.agent-chat__request').first().waitFor();

    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        MIN_HEIGHT + 180
    );
});

test('non-numeric-stored-height-means-autogrow', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem(
            'persist:PERSISTENCE',
            JSON.stringify({
                agentPromptHeight: '"300px"',
                _persist: '{"version":-1,"rehydrated":true}',
            })
        );
    });
    await openChat(page);

    await expect(separator(page)).toHaveAttribute(
        'aria-valuenow',
        String(MIN_HEIGHT)
    );
    expect(await inlineHeight(page)).toBe('');
    await typeLines(page, 14);
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        AUTOGROW_MAX_HEIGHT
    );
});

test('window-shrink-clamps-and-restores', async ({ page }) => {
    await openChat(page);
    await dragSeparator(page, -2000, 12);
    // redux-persist пишет в localStorage асинхронно
    await expect.poll(() => storedHeight(page)).toBeGreaterThan(MIN_HEIGHT);
    const stored = await storedHeight(page);

    await page.setViewportSize({ width: 1360, height: 600 });
    await expect
        .poll(() => layoutHeight(page, '.agent-chat__transcript'))
        .toBe(120);
    // сохранённое значение зажимается только на экране
    expect(await storedHeight(page)).toBe(stored);

    await page.setViewportSize({ width: 1360, height: 900 });
    await expect
        .poll(() => layoutHeight(page, '.agent-chat__field'))
        .toBe(stored);
});

const transcriptGap = (page: Page) =>
    page.locator('.agent-chat__transcript').evaluate((node) => {
        const el = node as HTMLElement;
        return el.scrollHeight - el.scrollTop - el.clientHeight;
    });

test('transcript-stays-at-bottom-when-field-grows', async ({ page }) => {
    await openChat(page, { history: makeHistory(20) });
    await expect.poll(() => transcriptGap(page)).toBeLessThanOrEqual(1);

    await dragSeparator(page, -200);
    // ResizeObserver срабатывает к следующему кадру
    await expect.poll(() => transcriptGap(page)).toBeLessThanOrEqual(1);
});

test('transcript-stays-at-bottom-when-prompt-autogrows', async ({ page }) => {
    await openChat(page, { history: makeHistory(20) });
    await expect.poll(() => transcriptGap(page)).toBeLessThanOrEqual(1);

    // ручку не трогаем: ленту ужимает нынешний авторост поля
    await typeLines(page, 12);

    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        AUTOGROW_MAX_HEIGHT
    );
    await expect.poll(() => transcriptGap(page)).toBeLessThanOrEqual(1);
});

test('released-button-without-pointerup-cancels-drag', async ({ page }) => {
    await openChat(page);
    const handle = separator(page);
    await handle.evaluate((node) => {
        node.addEventListener('pointerdown', (event) => {
            (window as unknown as { pointerId: number }).pointerId = (
                event as PointerEvent
            ).pointerId;
        });
    });
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 100, { steps: 4 });
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        MIN_HEIGHT + 100
    );

    // pointerup потерялся (кнопку отпустили за окном), и следующее движение приходит уже без кнопки
    await handle.evaluate(
        (node, clientY) =>
            node.dispatchEvent(
                new PointerEvent('pointermove', {
                    pointerId: (window as unknown as { pointerId: number })
                        .pointerId,
                    pointerType: 'mouse',
                    isPrimary: true,
                    buttons: 0,
                    clientY,
                    bubbles: true,
                })
            ),
        y - 150
    );

    await expect(field(page)).not.toHaveClass(/agent-chat__field--sized/);
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(MIN_HEIGHT);
    await page.mouse.up();
    expect(await storedHeight(page)).toBe(null);
    expect(await page.evaluate(() => document.body.className)).not.toContain(
        'agent-chat-resizing'
    );
});

test('other-pointer-release-does-not-end-drag', async ({ page }) => {
    await openChat(page);
    const handle = separator(page);
    await handle.evaluate((node) => {
        node.addEventListener('pointerdown', (event) => {
            (window as unknown as { pointerId: number }).pointerId = (
                event as PointerEvent
            ).pointerId;
        });
    });
    const box = (await handle.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 50, { steps: 4 });

    // на ноутбуке с сенсорным экраном второй палец отпустили над ручкой, а тянет первый указатель
    await handle.evaluate((node) => {
        const pointerId =
            (window as unknown as { pointerId: number }).pointerId + 100;
        for (const type of [
            'pointerup',
            'lostpointercapture',
            'pointercancel',
        ]) {
            node.dispatchEvent(
                new PointerEvent(type, {
                    pointerId,
                    pointerType: 'touch',
                    isPrimary: false,
                    bubbles: true,
                })
            );
        }
    });
    await page.mouse.move(x, y - 100, { steps: 4 });

    expect(await layoutHeight(page, '.agent-chat__field')).toBe(
        MIN_HEIGHT + 100
    );
    await page.mouse.up();
    await expect.poll(() => storedHeight(page)).toBe(MIN_HEIGHT + 100);
});

test('narrow-window-mid-drag-leaves-nothing-behind', async ({ page }) => {
    await openChat(page);
    const box = (await separator(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 100, { steps: 4 });

    await page.setViewportSize({ width: 700, height: 900 });
    await expect(page.locator('.agent-chat__resize')).toHaveCount(0);
    await page.mouse.up();
    expect(await page.evaluate(() => document.body.className)).not.toContain(
        'agent-chat-resizing'
    );

    await page.setViewportSize({ width: 1360, height: 900 });
    await separator(page).waitFor();
    expect(await inlineHeight(page)).toBe('');
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(MIN_HEIGHT);
    // простое наведение без кнопки ничего не двигает
    for (let i = 1; i <= 5; i++) {
        const current = (await separator(page).boundingBox())!;
        await page.mouse.move(
            current.x + current.width / 2,
            current.y + current.height / 2 - 4
        );
    }
    expect(await layoutHeight(page, '.agent-chat__field')).toBe(MIN_HEIGHT);
    expect(await storedHeight(page)).toBe(null);
});

test('pdf-tab-mid-drag-leaves-nothing-behind', async ({ page }) => {
    await openChat(page);
    const box = (await separator(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 100, { steps: 4 });

    // так же вкладку переключает конец компиляции: мышь при этом всё ещё зажата
    await page
        .getByRole('tab', { name: 'PDF visualization' })
        .dispatchEvent('click');
    await expect(page.locator('.agent-chat')).toHaveCount(0);
    await page.mouse.up();

    const body = await page.evaluate(() => ({
        className: document.body.className,
        cursor: getComputedStyle(document.body).cursor,
    }));
    expect(body.className).not.toContain('agent-chat-resizing');
    expect(body.cursor).not.toBe('ns-resize');
    expect(await storedHeight(page)).toBe(null);
});

test('touch-drag-on-touch-laptop', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'касания через CDP');
    // ноутбук с сенсорным экраном: мышь есть, поэтому ручка на месте, а тянут пальцем
    await page.setViewportSize({ width: 1024, height: 768 });
    await openChat(page);
    const box = (await separator(page).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;

    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y }],
    });
    for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x, y: y - i * 10 }],
        });
    }
    await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
    });

    await expect
        .poll(() => layoutHeight(page, '.agent-chat__field'))
        .toBe(MIN_HEIGHT + 100);
    await expect.poll(() => storedHeight(page)).toBe(MIN_HEIGHT + 100);
});
