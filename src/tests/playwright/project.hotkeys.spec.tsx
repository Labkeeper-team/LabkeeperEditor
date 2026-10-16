import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { CompileErrorResult, Program } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';
const OPENPANEL_API = 'http://localhost:3000/gh172-openpanel';
// настоящий PDF из соседнего опыта: SyncTeX нужен собранный документ
const PDF = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);

const PROGRAM: Program = {
    segments: [
        { id: 1, type: 'md', text: 'foo one', parameters: { visible: true } },
        {
            id: 2,
            type: 'computational',
            text: 'a = 10\nb = 20',
            parameters: { visible: true },
        },
        { id: 3, type: 'md', text: 'foo three', parameters: { visible: true } },
    ],
    parameters: { roundStrategy: 'noRound' },
};

const NO_SUCH_VARIABLE = {
    code: 301,
    payload: { segmentId: 1, line: 0, position: 4, variable: 'x' },
} as unknown as CompileErrorResult;

test.use({ viewport: { width: 1360, height: 900 } });

type Tracked = { name: string; properties: Record<string, unknown> };

/**
 * Страница отдаётся с ключами OpenPanel, а сам OpenPanel подменён: так видно,
 * какие события на самом деле уходят из приложения
 */
async function trackOpenPanel(page: Page) {
    const tracked: Tracked[] = [];
    await page.route(`**/project/${uuid}**`, async (route) => {
        if (route.request().resourceType() !== 'document') {
            await route.fallback();
            return;
        }
        const response = await route.fetch();
        const html = (await response.text())
            .replace('IO_LABKEEPER_FRONTEND_OPENPANEL_CLIENT_ID', 'gh172')
            .replace('IO_LABKEEPER_FRONTEND_OPENPANEL_API_URL', OPENPANEL_API);
        await route.fulfill({ response, body: html });
    });
    await page.route(`${OPENPANEL_API}/**`, async (route) => {
        const body = route.request().postDataJSON() as {
            type?: string;
            payload?: { name?: string; properties?: Record<string, unknown> };
        } | null;
        if (body?.type === 'track' && body.payload?.name) {
            tracked.push({
                name: body.payload.name,
                properties: body.payload.properties ?? {},
            });
        }
        await route.fulfill({ json: {} });
    });
    return {
        /** Коды сочетаний из hotkey_used по порядку */
        hotkeys: () =>
            tracked
                .filter((event) => event.name === '[E] Hotkey used')
                .map((event) => event.properties.hotkey),
        named: (name: string) =>
            tracked.filter((event) => event.name === `[E] ${name}`),
    };
}

async function openProject(
    page: Page,
    options: {
        program?: Program;
        latex?: boolean;
        compileErrors?: boolean;
        path?: string;
        files?: { fileName: string; url: string }[];
    } = {}
) {
    const analytics = await trackOpenPanel(page);
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    if (options.latex) {
        routeSetup.setupLatexProject();
    }
    await routeSetup.setupGetProjectRequest(
        200,
        'default',
        options.program ?? PROGRAM
    );
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    if (options.files) {
        await routeSetup.setupListFilesCustom(options.files);
    } else {
        await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    }
    await routeSetup.setupAgentHistoryRequest([]);
    const agentFrames = await routeSetup.setupAgentSocket([]);
    if (options.compileErrors) {
        await routeSetup.setupCompilationRequest(203, 'errorBody', [
            NO_SUCH_VARIABLE,
        ]);
    } else {
        await routeSetup.setupCompilationRequest(
            200,
            'computationalTypeBody',
            undefined,
            []
        );
    }
    const compilations: string[] = [];
    page.on('request', (request) => {
        if (/\/compile(\/|\?|$)/.test(new URL(request.url()).pathname)) {
            compilations.push(request.url());
        }
    });

    await page.goto(options.path ?? `/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    // на загруженном раннере первая отрисовка сегментов не укладывается в дефолтные 5 секунд
    if (!options.path) {
        await expect(segment(page, 0)).toBeVisible({ timeout: 20000 });
    }
    // Cmd или Ctrl приложение выбирает по userAgent, а он у WebKit маковский даже на Windows
    const mod = (await page.evaluate(
        () =>
            /mac/i.test(navigator.userAgent) &&
            !/iphone|ipad|ipod/i.test(navigator.userAgent)
    ))
        ? 'Meta'
        : 'Control';
    return { analytics, compilations, agentFrames, mod };
}

const segment = (page: Page, index: number) =>
    page.locator(`#ide-segment-${index} .cm-content`);

/** Строки редактора сегмента: toHaveText схлопывает пробелы и пустую строку не заметит */
const segmentLines = (page: Page, index: number) =>
    page.locator(`#ide-segment-${index} .cm-line`).allInnerTexts();

/** Номер сегмента, в редакторе которого сейчас фокус, или -1 */
const focusedSegment = (page: Page) =>
    page.evaluate(() => {
        const host = document.activeElement?.closest('[id^="ide-segment-"]');
        return host ? Number(host.id.replace('ide-segment-', '')) : -1;
    });

const searchField = (page: Page) =>
    page.getByRole('textbox', { name: /Enter text to search/i });

const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');

const promptText = (page: Page) =>
    page
        .locator('#agent-chat-field .cm-content')
        .evaluate((node) => (node as HTMLElement).innerText.trim());

const activeElementIs = (page: Page, selector: string) =>
    page.evaluate(
        (selector) => document.activeElement?.matches(selector) ?? false,
        selector
    );

/** Список сочетаний открывается из меню справки в шапке: второе выпадающее меню */
async function openHotkeysHelp(page: Page) {
    await page
        .locator('.code-settings-header-container .dropdown-menu-container')
        .nth(1)
        .click();
    await page.locator('.markdown-select-dropdown__hotkeys').click();
}

/** Каретка в конце текста сегмента: так видно, что фокус вернулся туда же */
async function caretToEnd(page: Page, index: number) {
    await segment(page, index).click();
    await page.keyboard.press('End');
}

test('ctrl-f-opens-search-with-the-caret-in-the-field', async ({ page }) => {
    const { analytics, mod } = await openProject(page);
    await segment(page, 0).click();

    await page.keyboard.press(`${mod}+f`);

    await expect(searchField(page)).toBeFocused();
    // встроенный поиск CodeMirror в сегменте не открылся
    await expect(page.locator('.cm-search')).toHaveCount(0);
    await page.keyboard.type('foo');
    await expect(searchField(page)).toHaveValue('foo');
    expect(analytics.hotkeys()).toEqual(['search_open']);
});

test('search-and-chat-take-the-focus-in-the-same-keystroke', async ({
    page,
}) => {
    const { mod } = await openProject(page);
    await segment(page, 0).click();

    // нажатие и чтение фокуса в одной задаче: что не успело к концу обработчика, уже опоздало к следующей букве
    const focusRightAfter = (code: string, key: string, alt: boolean) =>
        page.evaluate(
            ({ code, key, alt, meta }) => {
                (document.activeElement ?? document.body).dispatchEvent(
                    new KeyboardEvent('keydown', {
                        code,
                        key,
                        ctrlKey: !meta,
                        metaKey: meta,
                        altKey: alt,
                        bubbles: true,
                        cancelable: true,
                    })
                );
                const active = document.activeElement;
                return active?.id || active?.closest('[id]')?.id || '';
            },
            { code, key, alt, meta: mod === 'Meta' }
        );

    expect(await focusRightAfter('KeyF', 'f', false)).toBe(
        'project-search-input'
    );
    expect(await focusRightAfter('KeyC', 'c', true)).toBe('agent-chat-field');
});

test('f3-and-shift-f3-step-through-matches', async ({ page }) => {
    const { analytics, mod } = await openProject(page);
    await page.keyboard.press(`${mod}+f`);
    await page.keyboard.type('foo');
    // поле показывает текст из store: F3 раньше этого искал бы пустую строку
    await expect(searchField(page)).toHaveValue('foo');

    const current = page.locator('.highlight-text-editor--current');
    const currentSegment = () =>
        current.first().evaluate((node) => {
            const host = node
                .closest('.segment-editor-container')
                ?.querySelector('[id^="ide-segment-"]');
            return Number(host?.id.replace('ide-segment-', '') ?? -1);
        });

    await page.keyboard.press('F3');
    await expect(current).toHaveCount(1);
    expect(await currentSegment()).toBe(0);
    await page.keyboard.press('F3');
    await expect.poll(currentSegment).toBe(2);
    await page.keyboard.press('Shift+F3');
    await expect.poll(currentSegment).toBe(0);
    // переходы не уводят каретку из поля поиска
    await expect(searchField(page)).toBeFocused();
    expect(analytics.hotkeys()).toEqual([
        'search_open',
        'search_next',
        'search_next',
        'search_prev',
    ]);
});

test('ctrl-shift-e-shows-and-hides-the-files', async ({ page }) => {
    const { analytics, mod } = await openProject(page);
    const fileManager = page.locator('.manager-container');
    await expect(fileManager).toHaveCount(0);

    await page.keyboard.press(`${mod}+Shift+E`);
    await expect(fileManager).toBeVisible();
    await page.keyboard.press(`${mod}+Shift+E`);
    await expect(fileManager).toHaveCount(0);

    expect(analytics.hotkeys()).toEqual(['file_manager', 'file_manager']);
    // события самой панели остаются
    expect(analytics.named('File manager opened')).toHaveLength(1);
    expect(analytics.named('File manager closed')).toHaveLength(1);
});

test('alt-arrows-move-between-segments-and-keep-the-caret', async ({
    page,
}) => {
    const { analytics } = await openProject(page);
    await caretToEnd(page, 0);

    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => focusedSegment(page)).toBe(1);
    // в сегмент ещё не заходили: каретка в начале текста
    await page.keyboard.type('X');
    await expect
        .poll(() => segmentLines(page, 1))
        .toEqual(['Xa = 10', 'b = 20']);

    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(() => focusedSegment(page)).toBe(2);
    // CodeMirror сам перенёс бы строку вниз, а сочетание у него забрали
    await expect
        .poll(() => segmentLines(page, 1))
        .toEqual(['Xa = 10', 'b = 20']);

    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(() => focusedSegment(page)).toBe(1);
    // каретка там, где её оставили
    await page.keyboard.type('Z');
    await expect
        .poll(() => segmentLines(page, 1))
        .toEqual(['XZa = 10', 'b = 20']);

    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(() => focusedSegment(page)).toBe(0);
    await page.keyboard.type('Y');
    await expect(segment(page, 0)).toHaveText('foo oneY');

    // выше первого некуда: сочетание наше, но события нет
    await page.keyboard.press('Alt+ArrowUp');
    await expect.poll(() => focusedSegment(page)).toBe(0);
    expect(analytics.hotkeys()).toEqual([
        'segment_next',
        'segment_next',
        'segment_prev',
        'segment_prev',
    ]);
});

test('ctrl-shift-l-adds-a-latex-segment-with-the-caret-in-it', async ({
    page,
}) => {
    const { analytics, mod } = await openProject(page);
    await segment(page, 0).click();

    await page.keyboard.press(`${mod}+Shift+L`);

    await expect(segment(page, 3)).toBeVisible();
    await expect.poll(() => focusedSegment(page)).toBe(3);
    await page.keyboard.type('\\alpha');
    await expect(segment(page, 3)).toHaveText('\\alpha');
    await expect(page.locator('.segment-editor-container')).toHaveCount(4);
    expect(analytics.hotkeys()).toEqual(['add_latex']);
    // событие добавления сегмента остаётся и говорит, откуда пришло
    expect(
        analytics.named('Segment added').map((event) => event.properties)
    ).toEqual([
        expect.objectContaining({ segment_type: 'latex', source: 'hotkey' }),
    ]);
});

test('ctrl-enter-builds-like-the-run-button-and-keeps-the-segment', async ({
    page,
}) => {
    const { analytics, compilations, mod } = await openProject(page);
    await caretToEnd(page, 1);

    await page.keyboard.press(`${mod}+Enter`);

    await expect.poll(() => compilations.length).toBe(1);
    // CodeMirror не вставил пустую строку
    await expect
        .poll(() => segmentLines(page, 1))
        .toEqual(['a = 10', 'b = 20']);
    await expect.poll(() => analytics.hotkeys()).toEqual(['compile']);
    // старое событие сборки остаётся, с тем же признаком горячей клавиши, что у Ctrl+S
    await expect
        .poll(() =>
            analytics
                .named('Run clicked')
                .map((event) => event.properties.trigger)
        )
        .toEqual(['hotkey']);
});

test('ctrl-enter-in-the-chat-builds-and-does-not-send-the-prompt', async ({
    page,
}) => {
    const { compilations, agentFrames, mod } = await openProject(page);
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await promptField(page).click();
    await page.keyboard.type('сделай таблицу');

    await page.keyboard.press(`${mod}+Enter`);

    await expect.poll(() => compilations.length).toBe(1);
    expect(agentFrames).toHaveLength(0);
    // после сборки колонка, как у кнопки, уходит на результат, а запрос ждёт в поле
    await expect(page.locator('.agent-chat')).toHaveCount(0);
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect.poll(() => promptText(page)).toBe('сделай таблицу');
});

test('ctrl-period-sends-errors-with-the-caret-after-them', async ({ page }) => {
    const { analytics, mod } = await openProject(page, {
        program: {
            segments: [
                {
                    id: 1,
                    type: 'computational',
                    text: 'a = x',
                    parameters: { visible: true },
                },
            ],
            parameters: { roundStrategy: 'noRound' },
        },
        compileErrors: true,
    });
    await page.getByRole('button', { name: /Run/i }).click();
    await expect(
        page.getByRole('button', { name: 'Send to agent' })
    ).toBeVisible();

    await page.keyboard.press(`${mod}+.`);

    await expect(page.locator('.agent-chat')).toBeVisible();
    await expect
        .poll(() => promptText(page))
        .toMatch(/^Fix the compilation errors/);
    await page.keyboard.type(' please');
    await expect
        .poll(() => promptText(page))
        .toMatch(/No such variable x please$/);
    expect(analytics.hotkeys()).toEqual(['send_errors_to_agent']);
    expect(analytics.named('Send errors to agent')).toHaveLength(1);
});

test('ctrl-alt-c-and-p-switch-the-viewer-and-take-the-focus', async ({
    page,
}) => {
    const { analytics, mod } = await openProject(page);
    await segment(page, 0).click();

    await page.keyboard.press(`${mod}+Alt+C`);
    await expect(page.locator('.agent-chat')).toBeVisible();
    await expect(promptField(page)).toBeFocused();
    await page.keyboard.type('привет');
    await expect.poll(() => promptText(page)).toBe('привет');

    await page.keyboard.press(`${mod}+Alt+P`);
    await expect(page.locator('.agent-chat')).toHaveCount(0);
    await expect
        .poll(() =>
            activeElementIs(
                page,
                '.viewer-pane .result-container, .viewer-pane .result-container *'
            )
        )
        .toBe(true);

    expect(analytics.hotkeys()).toEqual(['viewer_chat', 'viewer_pdf']);
    // клик по вкладке и сочетание пишут одно и то же событие смены вкладки
    expect(
        analytics
            .named('Viewer tab changed')
            .map((event) => event.properties.to)
    ).toEqual(['chat', 'pdf']);
});

test('altgr-letters-do-not-switch-the-viewer', async ({ page }) => {
    const { analytics, mod } = await openProject(page);
    // AltGr бывает только на Windows и Linux, на macOS Option отдельная клавиша
    test.skip(mod === 'Meta', 'AltGr only exists outside macOS');
    await segment(page, 0).click();

    // на Windows AltGr+C это Ctrl+Alt+C с AltGraph: так в польской раскладке набирают ć
    const press = (altGraph: boolean) =>
        page.evaluate((altGraph) => {
            const target = document.activeElement ?? document.body;
            target.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: altGraph ? 'ć' : 'c',
                    code: 'KeyC',
                    ctrlKey: true,
                    altKey: true,
                    modifierAltGraph: altGraph,
                    bubbles: true,
                    cancelable: true,
                } as KeyboardEventInit)
            );
        }, altGraph);

    await press(true);
    await expect(page.locator('.agent-chat')).toHaveCount(0);
    expect(analytics.hotkeys()).toEqual([]);

    await press(false);
    await expect(page.locator('.agent-chat')).toBeVisible();
    expect(analytics.hotkeys()).toEqual(['viewer_chat']);
});

test('ctrl-shift-i-enters-and-leaves-agent-mode', async ({ page }) => {
    const { analytics, mod } = await openProject(page);

    await page.keyboard.press(`${mod}+Shift+I`);
    await expect(page).toHaveURL(`/project/${uuid}/agent`);
    // адрес меняется раньше, чем страница перерисуется: ждём сам режим
    await expect(page.locator('.agent-mode-pane')).toBeVisible();
    await page.keyboard.press(`${mod}+Shift+I`);
    await expect(page).toHaveURL(`/project/${uuid}`);
    await expect(segment(page, 0)).toBeVisible();

    expect(analytics.hotkeys()).toEqual(['agent_mode', 'agent_mode']);
    expect(
        analytics
            .named('Agent mode entered')
            .map((event) => event.properties.source)
    ).toEqual(['hotkey']);
});

test('ctrl-alt-j-and-k-run-synctex-in-a-latex-project', async ({ page }) => {
    const navigation: string[] = [];
    await page.route(`**/public/project/${uuid}/navigation/**`, (route) => {
        navigation.push(new URL(route.request().url()).pathname);
        return route.fulfill({ json: { page: 1, x: 72, y: 20 } });
    });
    await page.route(
        (url) => url.pathname.startsWith('/files/'),
        (route) => route.fulfill({ contentType: 'application/pdf', body: PDF })
    );
    const { analytics, mod } = await openProject(page, {
        latex: true,
        // без собранного PDF переходить некуда: даём проекту файл результата
        files: [{ fileName: 'main.pdf', url: '/files/main.pdf' }],
        program: {
            segments: [
                {
                    id: 1,
                    type: 'latex',
                    text: 'x',
                    parameters: { visible: true },
                },
            ],
            parameters: { roundStrategy: 'noRound' },
        },
    });
    await expect(page.locator('.synctex-button').first()).toBeEnabled();
    await segment(page, 0).click();

    await page.keyboard.press(`${mod}+Alt+J`);
    await expect
        .poll(() => navigation)
        .toEqual([`/api/v4/public/project/${uuid}/navigation/pdf`]);

    // как у кнопки «К коду»: без места в PDF подсказка, куда щёлкнуть
    await page.keyboard.press(`${mod}+Alt+K`);
    await expect(
        page.getByText('Click in the PDF to choose a position.')
    ).toBeVisible();

    expect(analytics.hotkeys()).toEqual(['sync_to_pdf', 'sync_to_editor']);
});

test('help-lists-the-hotkeys-and-esc-closes-only-it', async ({ page }) => {
    const { mod } = await openProject(page);
    // открытый поиск накрывает шапку целиком, поэтому за окном оставляем панель файлов: её Esc тоже закрывает
    const fileManager = page.locator('.manager-container');
    await page.keyboard.press(`${mod}+Shift+E`);
    await expect(fileManager).toBeVisible();

    await openHotkeysHelp(page);
    const help = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(help).toBeVisible();
    await expect(
        help.getByText('Build the project', { exact: true })
    ).toBeVisible();
    // новые сочетания и прежние в одном списке
    await expect(help).toContainText(`${mod === 'Meta' ? '⌘' : 'Ctrl'}Enter`);
    await expect(help).toContainText(`${mod === 'Meta' ? '⇧' : 'Shift'}Tab`);

    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    // Esc ушёл окну: панель за ним осталась открытой
    await expect(fileManager).toBeVisible();
});

test.describe('on a mac', () => {
    test.use({
        userAgent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    });

    test('cmd-takes-the-place-of-ctrl', async ({ page }) => {
        const { analytics } = await openProject(page);
        const fileManager = page.locator('.manager-container');

        await page.keyboard.press('Control+Shift+E');
        await expect(fileManager).toHaveCount(0);
        await page.keyboard.press('Meta+Shift+E');
        await expect(fileManager).toBeVisible();

        // Cmd и Ctrl дают один и тот же код
        expect(analytics.hotkeys()).toEqual(['file_manager']);
        await openHotkeysHelp(page);
        await expect(
            page.getByRole('dialog', { name: 'Keyboard shortcuts' })
        ).toContainText('⌘⇧E');
    });
});
