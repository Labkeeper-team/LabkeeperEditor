import { test, expect, devices, Page, Request } from '@playwright/test';
import { readFileSync } from 'fs';
import { RouteSetup } from './mock.routeSetUp';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

// настоящий PDF pdfTeX с hyperref, исходник рядом в fixtures/pdf-links-selection.tex
const PDF = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);
const PAGE_WIDTH_PT = 595.276;
const PAGE_HEIGHT_PT = 841.89;

const PROGRAM = {
    segments: [
        {
            id: 1,
            type: 'latex' as const,
            parameters: { visible: true },
            text: 'x',
        },
    ],
    parameters: { roundStrategy: 'noRound' as const },
};

// строки фикстуры и ширина первой строки абзаца в пунктах PDF (из getTextContent)
const SHORT_LINE = 'Short line for selection';
const LONG_LINE =
    'The first line of this long paragraph is justified so that it spans the full text width of the page, which lets';
const LONG_LINE_WIDTH_PT = 549.4;
const LINK_LINE = 'External: external example link.';
const LAST_LINE = 'Last line on the first page';

// прямоугольники аннотаций ссылок в пунктах PDF [x1, y1, x2, y2] и куда они ведут
const EXTERNAL_LINK = [65.7, 777.4, 177.9, 790];
const EXTERNAL_URL = 'https://example.com/labkeeper-pdf-link';
const NAMED_TARGET_LINK = [92.2, 748.5, 220.1, 761.1];
const HYPERREF_LINK = [70.9, 734, 189.4, 746.7];
const PAGEREF_LINK = [234.9, 734, 242.8, 746.7];
const NEXT_PAGE_LINK = [92.8, 719.6, 179.7, 732.2];
const EXPLICIT_LINK = [61.8, 705.1, 184.8, 717.8];

async function mockLatexProject(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    routeSetup.setupLatexProject();
    await routeSetup.setupGetProjectRequest(200, 'default', PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesCustom([
        { fileName: 'main.pdf', url: '/files/main.pdf' },
    ]);
    await routeSetup.setupAgentHistoryRequest([]);
    await page.route(
        (url) => url.pathname.startsWith('/files/'),
        (route) => route.fulfill({ contentType: 'application/pdf', body: PDF })
    );
    // внешняя ссылка фикстуры не должна уходить в сеть
    await page
        .context()
        .route('https://example.com/**', (route) =>
            route.fulfill({ contentType: 'text/html', body: '<p>ok</p>' })
        );
}

async function openPdf(page: Page) {
    await mockLatexProject(page);
    await page.goto(`/project/${uuid}`);
    await waitForPdfText(page);
}

async function waitForPdfText(page: Page) {
    await page
        .locator('[data-pdf-page="0"] .textLayer span')
        .first()
        .waitFor({ state: 'attached', timeout: 30000 });
    await expect(page.getByText('Loading PDF')).toHaveCount(0);
}

/** span текстового слоя, строка которого начинается с text, и страница, на которой он лежит */
const spanBox = (page: Page, text: string) =>
    page.evaluate((text) => {
        const span = [
            ...document.querySelectorAll('[data-pdf-page] .textLayer span'),
        ].find((el) => el.textContent?.startsWith(text)) as HTMLElement;
        const toBox = (r: DOMRect) => ({
            left: r.left,
            top: r.top,
            width: r.width,
            height: r.height,
        });
        const wrapper = span.closest('[data-pdf-page]') as HTMLElement;
        return {
            span: toBox(span.getBoundingClientRect()),
            page: toBox(wrapper.getBoundingClientRect()),
            container: toBox(wrapper.parentElement!.getBoundingClientRect()),
        };
    }, text);

const pageBox = (page: Page, index: number) =>
    page.locator(`[data-pdf-page="${index}"]`).evaluate((wrapper) => {
        const r = wrapper.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    });

/** Точка на странице по координатам PDF (начало внизу слева), как её видит пользователь */
async function pdfPoint(page: Page, pageIndex: number, x: number, y: number) {
    const box = await pageBox(page, pageIndex);
    const scale = box.width / PAGE_WIDTH_PT;
    return {
        x: box.left + x * scale,
        y: box.top + (PAGE_HEIGHT_PT - y) * scale,
    };
}

const linkCenter = (page: Page, rect: number[]) =>
    pdfPoint(page, 0, (rect[0] + rect[2]) / 2, (rect[1] + rect[3]) / 2);

/** Протяжка мелким шагом: при крупном Firefox и WebKit теряют хвост строки */
async function drag(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps = 60
) {
    await page.evaluate(() => window.getSelection()?.removeAllRanges());
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i++) {
        await page.mouse.move(
            from.x + ((to.x - from.x) * i) / steps,
            from.y + ((to.y - from.y) * i) / steps
        );
    }
    await page.mouse.up();
}

const selectedText = (page: Page) =>
    page.evaluate(() => window.getSelection()?.toString() ?? '');

/** Протяжка вдоль строки от её начала до правого края страницы */
async function dragAlongLine(page: Page, line: string) {
    const { span, page: pageRect } = await spanBox(page, line);
    const y = span.top + span.height / 2;
    await drag(
        page,
        { x: span.left + 1, y },
        { x: pageRect.left + pageRect.width - 3, y }
    );
}

// Firefox и WebKit теряют последний символ-другой длинной строки даже при верной геометрии, поэтому начало строки и не меньше 95%
function expectLineSelected(selected: string, line: string) {
    const text = selected.trim();
    expect(line.startsWith(text), `выделено «${text}»`).toBe(true);
    expect(text.length, `выделено «${text}»`).toBeGreaterThanOrEqual(
        Math.floor(line.length * 0.95)
    );
}

/** Позиция прокрутки, при которой точка назначения стоит у верхнего края колонки */
async function expectScrolledTo(page: Page, pageIndex: number, top: number) {
    const expected = await page
        .locator(`[data-pdf-page="${pageIndex}"]`)
        .evaluate(
            (wrapper, { top, width, height }) => {
                const container = wrapper.parentElement!;
                const pageTop =
                    wrapper.getBoundingClientRect().top -
                    container.getBoundingClientRect().top +
                    container.scrollTop;
                const scale = wrapper.getBoundingClientRect().width / width;
                return pageTop + Math.max(0, (height - top) * scale);
            },
            { top, width: PAGE_WIDTH_PT, height: PAGE_HEIGHT_PT }
        );
    await expect
        .poll(() =>
            page
                .locator('[data-pdf-page="0"]')
                .evaluate((wrapper) => wrapper.parentElement!.scrollTop)
        )
        .toBeGreaterThan(expected - 2);
    const scrollTop = await page
        .locator('[data-pdf-page="0"]')
        .evaluate((wrapper) => wrapper.parentElement!.scrollTop);
    expect(Math.abs(scrollTop - expected)).toBeLessThanOrEqual(2);
}

function collectSyncRequests(page: Page) {
    const requests: Request[] = [];
    page.on('request', (request) => {
        if (request.url().includes('/navigation/doc')) {
            requests.push(request);
        }
    });
    return requests;
}

test('pdf-text-layer-matches-page-scale', async ({ page }) => {
    await openPdf(page);
    const { span, page: pageRect } = await spanBox(page, LONG_LINE);
    const scale = pageRect.width / PAGE_WIDTH_PT;
    // без переменных масштаба span берёт шрифт страницы и выходит шире строки на канве
    expect(span.width / (LONG_LINE_WIDTH_PT * scale)).toBeGreaterThan(0.97);
    expect(span.width / (LONG_LINE_WIDTH_PT * scale)).toBeLessThan(1.03);
});

test('drag-along-short-line-selects-only-that-line', async ({
    page,
    browserName,
}) => {
    await openPdf(page);
    await dragAlongLine(page, SHORT_LINE);
    const selected = (await selectedText(page)).trim();
    if (browserName === 'chromium') {
        // endOfContent встаёт за концом выделения, без этого у края страницы Chromium теряет последнюю букву
        expect(selected).toBe(SHORT_LINE);
    } else {
        // WebKit у самого края страницы теряет последнюю букву и с endOfContent, чуть правее конца строки берёт её целиком
        expectLineSelected(selected, SHORT_LINE);
    }
});

test('drag-long-line-to-page-edge-selects-that-line', async ({ page }) => {
    await openPdf(page);
    await dragAlongLine(page, LONG_LINE);
    expectLineSelected(await selectedText(page), LONG_LINE);
});

test('drag-into-empty-space-keeps-selection-start', async ({ page }) => {
    await openPdf(page);
    const short = await spanBox(page, SHORT_LINE);
    const last = await spanBox(page, LAST_LINE);
    const paragraphEnd = await spanBox(page, 'gaps between them');
    const gapY =
        (paragraphEnd.span.top + paragraphEnd.span.height + last.span.top) / 2;
    const x = short.span.left + 1;
    await drag(
        page,
        { x, y: short.span.top + short.span.height / 2 },
        { x: x + 40, y: gapY }
    );
    const selected = (await selectedText(page)).trim();
    // Chromium без endOfContent уходит до конца страницы, Firefox и WebKit прыгают к её началу
    expect(selected.startsWith(SHORT_LINE), selected).toBe(true);
    expect(selected).toContain('the beginning or to the end of the page');
    expect(selected).not.toContain(LAST_LINE);
});

test('drag-past-pdf-column-does-not-select-interface', async ({ page }) => {
    await openPdf(page);
    const { span, container } = await spanBox(page, SHORT_LINE);
    const viewportHeight = page.viewportSize()!.height;
    await drag(
        page,
        { x: span.left + 1, y: span.top + span.height / 2 },
        {
            x: container.left + container.width / 2,
            y: Math.min(
                viewportHeight - 3,
                container.top + container.height + 25
            ),
        }
    );
    const selection = await page.evaluate(() => {
        const s = window.getSelection()!;
        const inPdf = (node: Node | null) =>
            Boolean(
                (node instanceof Element ? node : node?.parentElement)?.closest(
                    '[data-pdf-page]'
                )
            );
        return {
            text: s.toString(),
            anchorInPdf: inPdf(s.anchorNode),
            focusInPdf: inPdf(s.focusNode),
        };
    });
    // Firefox и WebKit без защиты тянут в выделение текст инструкции и кнопку Save to PDF
    expect(selection.text).toContain(SHORT_LINE);
    expect(selection.text).not.toContain('Save to PDF');
    expect(selection.anchorInPdf).toBe(true);
    expect(selection.focusInPdf).toBe(true);
});

test('drag-from-pdf-onto-segment-code-keeps-selection-in-pdf', async ({
    page,
}) => {
    await openPdf(page);
    const code = page.locator('#ide-segment-0 .cm-line').first();
    const codeBox = (await code.boundingBox())!;
    const { span } = await spanBox(page, SHORT_LINE);
    await drag(
        page,
        { x: span.left + span.width - 2, y: span.top + span.height / 2 },
        { x: codeBox.x + 3, y: codeBox.y + codeBox.height / 2 }
    );
    const selection = await page.evaluate(() => {
        const s = window.getSelection()!;
        const inPdf = (node: Node | null) =>
            Boolean(
                (node instanceof Element ? node : node?.parentElement)?.closest(
                    '[data-pdf-page]'
                )
            );
        return {
            text: s.toString(),
            anchorInPdf: inPdf(s.anchorNode),
            focusInPdf: inPdf(s.focusNode),
            editorFocused: Boolean(
                document.activeElement?.closest('.cm-editor')
            ),
        };
    });
    // Chromium и WebKit без защиты переносили выделение в код сегмента и отдавали фокус редактору
    expect(selection.anchorInPdf).toBe(true);
    expect(selection.focusInPdf).toBe(true);
    expect(selection.text.trim()).not.toBe('');
    expect(selection.editorFocused).toBe(false);

    // после отпускания кнопки редактор снова принимает клик
    await code.click();
    await expect(page.locator('#ide-segment-0 .cm-content')).toBeFocused();
});

test('interface-is-selectable-again-after-cancelled-pointer', async ({
    page,
}) => {
    await openPdf(page);
    const instructionUserSelect = () =>
        page.locator('.labkeeper-instruction-container').evaluate((el) => {
            const style = getComputedStyle(el);
            return (
                style.getPropertyValue('user-select') ||
                style.getPropertyValue('-webkit-user-select')
            );
        });
    expect(await instructionUserSelect()).not.toBe('none');
    // палец лёг на текст PDF и ушёл в прокрутку: вместо pointerup браузер шлёт pointercancel
    await page.evaluate(() =>
        document
            .querySelector('[data-pdf-page="0"] .textLayer span')!
            .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
    );
    expect(await instructionUserSelect()).toBe('none');
    await page.evaluate(() =>
        document.dispatchEvent(
            new PointerEvent('pointercancel', { bubbles: true })
        )
    );
    expect(await instructionUserSelect()).not.toBe('none');
});

test('context-menu-on-pdf-text-keeps-interface-selectable', async ({
    page,
}) => {
    await openPdf(page);
    const press = (events: [string, number][]) =>
        page.evaluate((events) => {
            const span = document.querySelector(
                '[data-pdf-page="0"] .textLayer span'
            )!;
            for (const [type, button] of events) {
                const Event = type.startsWith('pointer')
                    ? PointerEvent
                    : MouseEvent;
                span.dispatchEvent(new Event(type, { bubbles: true, button }));
            }
            return {
                interface:
                    document.documentElement.classList.contains(
                        'pdf-text-selecting'
                    ),
                layer: span.parentElement!.classList.contains('selecting'),
            };
        }, events);
    // правая кнопка не тянет выделение, а после меню macOS pointerup может не прийти, и интерфейс остался бы невыделяемым
    expect((await press([['pointerdown', 2]])).interface).toBe(false);
    // Ctrl+клик на macOS открывает то же меню основной кнопкой, поэтому сброс по contextmenu
    expect(
        await press([
            ['pointerdown', 0],
            ['mousedown', 0],
        ])
    ).toEqual({ interface: true, layer: true });
    // слой без сброса пропускал бы клики сквозь ссылки и ставил точку SyncTeX
    expect(await press([['contextmenu', 0]])).toEqual({
        interface: false,
        layer: false,
    });
});

test('copy-puts-plain-text-of-pdf-selection', async ({ page }) => {
    await openPdf(page);
    await dragAlongLine(page, SHORT_LINE);
    await page.evaluate(() => {
        const w = window as unknown as { copied?: unknown };
        window.addEventListener('copy', (event) => {
            w.copied = {
                prevented: event.defaultPrevented,
                text: event.clipboardData?.getData('text/plain'),
            };
        });
    });
    await page.keyboard.press('ControlOrMeta+c');
    const copied = await page.evaluate(
        () =>
            (
                window as unknown as {
                    copied?: { prevented: boolean; text: string };
                }
            ).copied
    );
    // в буфер уходит только текст: HTML прозрачных span при вставке дал бы невидимый текст
    expect(copied?.prevented).toBe(true);
    expectLineSelected(copied?.text ?? '', SHORT_LINE);
});

test('drag-across-link-selects-its-text', async ({ page }) => {
    await openPdf(page);
    await dragAlongLine(page, LINK_LINE);
    expectLineSelected(await selectedText(page), LINK_LINE);
});

test('external-link-opens-new-tab-without-opener', async ({ page }) => {
    await openPdf(page);
    const link = page.locator(
        `[data-pdf-page="0"] .annotationLayer a[href="${EXTERNAL_URL}"]`
    );
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
    const point = await linkCenter(page, EXTERNAL_LINK);
    const [popup] = await Promise.all([
        page.context().waitForEvent('page'),
        page.mouse.click(point.x, point.y),
    ]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe(EXTERNAL_URL);
    expect(await popup.evaluate(() => window.opener)).toBeNull();
    await popup.close();
    // вкладка редактора осталась на месте
    await expect(page).toHaveURL(`/project/${uuid}`);
});

test('named-destination-link-scrolls-to-its-target', async ({ page }) => {
    await openPdf(page);
    const point = await linkCenter(page, NAMED_TARGET_LINK);
    await page.mouse.click(point.x, point.y);
    // \hypertarget{secondtarget}: XYZ 14.173 833.386 на второй странице
    await expectScrolledTo(page, 1, 833.386);
});

test('hyperref-and-pageref-links-scroll-to-section', async ({ page }) => {
    await openPdf(page);
    const hyperref = await linkCenter(page, HYPERREF_LINK);
    await page.mouse.click(hyperref.x, hyperref.y);
    // \label в \section*: назначение section*.2, XYZ 14.173 803.415
    await expectScrolledTo(page, 1, 803.415);

    await page
        .locator('[data-pdf-page="0"]')
        .evaluate((wrapper) => wrapper.parentElement!.scrollTo({ top: 0 }));
    const pageref = await linkCenter(page, PAGEREF_LINK);
    await page.mouse.click(pageref.x, pageref.y);
    await expectScrolledTo(page, 1, 803.415);
});

test('explicit-destination-link-scrolls-to-its-point', async ({ page }) => {
    await openPdf(page);
    const point = await linkCenter(page, EXPLICIT_LINK);
    await page.mouse.click(point.x, point.y);
    // \pdfstartlink goto page 3 {/XYZ 0 400 null}
    await expectScrolledTo(page, 2, 400);
});

test('next-page-action-link-scrolls-to-next-page', async ({ page }) => {
    await openPdf(page);
    const point = await linkCenter(page, NEXT_PAGE_LINK);
    await page.mouse.click(point.x, point.y);
    await expectScrolledTo(page, 1, PAGE_HEIGHT_PT);
});

test('click-on-link-does-not-set-synctex-point', async ({ page }) => {
    await openPdf(page);
    const requests = collectSyncRequests(page);
    const point = await linkCenter(page, NEXT_PAGE_LINK);
    await page.mouse.click(point.x, point.y);
    await expectScrolledTo(page, 1, PAGE_HEIGHT_PT);
    await page.getByRole('button', { name: 'Go to source' }).click();
    await expect(
        page.getByText('Click in the PDF to choose a position.')
    ).toBeVisible();
    expect(requests).toHaveLength(0);
});

test('click-on-text-sets-synctex-point', async ({ page }) => {
    await openPdf(page);
    await page.route('**/navigation/doc', (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ segmentId: 1, line: 1 }),
        })
    );
    const { span, page: pageRect } = await spanBox(page, SHORT_LINE);
    // левее ссылки строкой ниже: на телефоне нажатие рядом со ссылкой уходит в неё
    const click = { x: span.left + 10, y: span.top + span.height / 2 };
    await page.mouse.click(click.x, click.y);
    const [request] = await Promise.all([
        page.waitForRequest('**/navigation/doc'),
        page.getByRole('button', { name: 'Go to source' }).click(),
    ]);
    const scale = pageRect.width / PAGE_WIDTH_PT;
    const body = request.postDataJSON();
    expect(body.page).toBe(1);
    // приложение округляет до пункта, а на телефоне пиксель крупнее пункта
    expect(
        Math.abs(body.x - (click.x - pageRect.left) / scale)
    ).toBeLessThanOrEqual(2);
    expect(
        Math.abs(body.y - (click.y - pageRect.top) / scale)
    ).toBeLessThanOrEqual(2);
});

const mockCompileWithNewPdf = (page: Page) =>
    page.route(`**/project/${uuid}/compile/pdf**`, (route) =>
        route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({ pdfUri: '/files/recompiled.pdf' }),
        })
    );

/** Компиляция отдаёт новый pdfUri, просмотрщик собирает страницы заново */
async function recompile(page: Page, isMobile: boolean) {
    await mockCompileWithNewPdf(page);
    await page
        .locator('[data-pdf-page="0"]')
        .evaluate((wrapper) => wrapper.setAttribute('data-old', ''));
    if (isMobile) {
        // на телефоне Run живёт на экране редактора
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'Editor' }).click();
    }
    await page.getByRole('button', { name: /Run/i }).click();
    await expect(page.locator('[data-pdf-page][data-old]')).toHaveCount(0);
    if (isMobile && (await page.locator('.cm-content').first().isVisible())) {
        await page.locator('.mobile-view-switcher-bar__toggle').click();
        await page.getByRole('option', { name: 'PDF' }).click();
    }
    await waitForPdfText(page);
}

test('links-and-selection-work-after-recompile', async ({ page, isMobile }) => {
    await openPdf(page);
    await recompile(page, isMobile);

    await dragAlongLine(page, SHORT_LINE);
    expectLineSelected(await selectedText(page), SHORT_LINE);
    const point = await linkCenter(page, NAMED_TARGET_LINK);
    await page.mouse.click(point.x, point.y);
    await expectScrolledTo(page, 1, 833.386);
});

test('loading-overlay-stays-until-current-pdf-is-drawn', async ({
    page,
    isMobile,
}) => {
    test.skip(
        isMobile,
        'на телефоне Run на экране редактора, где PDF скрыт; от раскладки логика не зависит'
    );
    await mockLatexProject(page);
    await mockCompileWithNewPdf(page);
    // оба PDF отдаём по команде: старый прогон отменяется, пока новый ещё грузится
    const release = { first: () => {}, second: () => {} };
    const hold = (name: 'first' | 'second', path: string) =>
        page.route(`**${path}`, async (route) => {
            await new Promise<void>((done) => (release[name] = done));
            await route.fulfill({ contentType: 'application/pdf', body: PDF });
        });
    await hold('first', '/files/main.pdf');
    await hold('second', '/files/recompiled.pdf');
    const overlay = page.getByText('Loading PDF');

    await page.goto(`/project/${uuid}`);
    await expect(overlay).toBeVisible();
    const secondRequested = page.waitForRequest('**/files/recompiled.pdf');
    await page.getByRole('button', { name: /Run/i }).click();
    await secondRequested;
    const firstFinished = page.waitForEvent('requestfinished', (request) =>
        request.url().endsWith('/files/main.pdf')
    );
    release.first();
    await firstFinished;
    // отменённый прогон дочитал свой PDF и не должен гасить заставку: под ней ещё рисуется новый, и клик по ссылке сбросила бы его прокрутка
    await page.waitForTimeout(1000);
    await expect(overlay).toBeVisible();

    release.second();
    await waitForPdfText(page);
    const point = await linkCenter(page, NAMED_TARGET_LINK);
    await page.mouse.click(point.x, point.y);
    await expectScrolledTo(page, 1, 833.386);
});

test('links-and-selection-work-after-dpr-change-behind-chat-tab', async ({
    page,
    browserName,
    isMobile,
}) => {
    test.skip(
        browserName !== 'chromium' || isMobile,
        'плотность пикселей меняется через CDP, вкладки чата на телефоне нет'
    );
    await openPdf(page);
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await expect(page.locator('.result-container')).toBeHidden();
    await page
        .locator('[data-pdf-page="0"]')
        .evaluate((wrapper) => wrapper.setAttribute('data-old', ''));
    // масштаб браузера сменился, пока колонка PDF скрыта: страницы ждут ширины и собираются при возврате
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 0,
        height: 0,
        deviceScaleFactor: 2,
        mobile: false,
    });
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    await page.getByRole('tab', { name: 'PDF visualization' }).click();
    await expect(page.locator('[data-pdf-page][data-old]')).toHaveCount(0);
    await waitForPdfText(page);

    const { span, page: pageRect } = await spanBox(page, LONG_LINE);
    const scale = pageRect.width / PAGE_WIDTH_PT;
    expect(span.width / (LONG_LINE_WIDTH_PT * scale)).toBeGreaterThan(0.97);
    expect(span.width / (LONG_LINE_WIDTH_PT * scale)).toBeLessThan(1.03);
    await dragAlongLine(page, SHORT_LINE);
    expectLineSelected(await selectedText(page), SHORT_LINE);
    const point = await linkCenter(page, NAMED_TARGET_LINK);
    await page.mouse.click(point.x, point.y);
    await expectScrolledTo(page, 1, 833.386);
});

type ZoomControls = {
    zoomBy: (k: number) => void;
    holdFrames: () => void;
    releaseFrames: () => void;
};

/** Ctrl+ и Ctrl- меняют devicePixelRatio и шлют resize; кадры можно придержать, чтобы pdf.js застрял посреди отрисовки страницы */
async function emulateBrowserZoom(page: Page) {
    await page.addInitScript(() => {
        let dpr = window.devicePixelRatio;
        Object.defineProperty(window, 'devicePixelRatio', {
            configurable: true,
            get: () => dpr,
        });
        const requestFrame = window.requestAnimationFrame.bind(window);
        const heldFrames: FrameRequestCallback[] = [];
        let holding = false;
        window.requestAnimationFrame = (callback) => {
            if (!holding) {
                return requestFrame(callback);
            }
            heldFrames.push(callback);
            return 0;
        };
        const controls: ZoomControls = {
            zoomBy: (k) => {
                dpr *= k;
                window.dispatchEvent(new Event('resize'));
            },
            holdFrames: () => {
                holding = true;
            },
            releaseFrames: () => {
                holding = false;
                heldFrames
                    .splice(0)
                    .forEach((callback) => requestFrame(callback));
            },
        };
        Object.assign(window, controls);
    });
}

const markPages = (page: Page, mark: string) =>
    page
        .locator('[data-pdf-page]')
        .evaluateAll(
            (wrappers, mark) =>
                wrappers.forEach((w) => w.setAttribute(mark, '')),
            mark
        );

test('two-quick-zooms-draw-each-page-once', async ({ page }) => {
    await emulateBrowserZoom(page);
    await openPdf(page);
    // обе перерисовки получают PDF разом, поэтому вторая начинается посреди первой
    const held: (() => void)[] = [];
    await page.route('**/files/main.pdf', async (route) => {
        await new Promise<void>((done) => held.push(done));
        await route.fulfill({ contentType: 'application/pdf', body: PDF });
    });
    await markPages(page, 'data-old');
    await page.evaluate(() => {
        const { zoomBy } = window as unknown as ZoomControls;
        zoomBy(1.1);
        zoomBy(1.1);
    });
    await expect.poll(() => held.length).toBe(2);
    held.forEach((release) => release());
    await expect(page.locator('[data-pdf-page][data-old]')).toHaveCount(0);
    await waitForPdfText(page);
    await page
        .locator('[data-pdf-page="3"] .textLayer span')
        .first()
        .waitFor({ state: 'attached' });
    // первая перерисовка, если её не остановить, дописывает свои страницы уже после второй
    await page.waitForTimeout(1000);

    // её слои путали признак Firefox, и протяжка не выделяла ничего
    await dragAlongLine(page, SHORT_LINE);
    expectLineSelected(await selectedText(page), SHORT_LINE);
    await expect(page.locator('[data-pdf-page]')).toHaveCount(4);
});

test('selection-works-after-zoom-during-page-drawing', async ({ page }) => {
    await emulateBrowserZoom(page);
    await openPdf(page);
    await markPages(page, 'data-old');
    await page.evaluate(() => {
        const { holdFrames, zoomBy } = window as unknown as ZoomControls;
        holdFrames();
        zoomBy(1.1);
    });
    // первая перерисовка застряла на канве первой страницы, вторая снимает её страницы и застревает там же
    await page
        .locator('[data-pdf-page="0"]:not([data-old]) canvas')
        .waitFor({ state: 'attached' });
    await markPages(page, 'data-first');
    await page.evaluate(() => (window as unknown as ZoomControls).zoomBy(1.1));
    await page
        .locator('[data-pdf-page="0"]:not([data-old]):not([data-first]) canvas')
        .waitFor({ state: 'attached' });
    await page.evaluate(() =>
        (window as unknown as ZoomControls).releaseFrames()
    );
    await waitForPdfText(page);
    await page
        .locator('[data-pdf-page="3"] .textLayer span')
        .first()
        .waitFor({ state: 'attached' });

    // слой снятой страницы первой перерисовки попадал в выделение первым, и Firefox по нему решал, что он не Firefox
    await dragAlongLine(page, SHORT_LINE);
    expectLineSelected(await selectedText(page), SHORT_LINE);
});

test('leaving-project-while-pdf-draws-leaves-no-selection-listeners', async ({
    page,
}) => {
    await emulateBrowserZoom(page);
    // живые обработчики copy на document: выделение PDF вешает свой вместе с остальными общими
    await page.addInitScript(() => {
        const copyListeners = new Map<unknown, AbortSignal | undefined>();
        const add = EventTarget.prototype.addEventListener;
        const remove = EventTarget.prototype.removeEventListener;
        EventTarget.prototype.addEventListener = function (
            type,
            listener,
            options
        ) {
            if (this === document && type === 'copy') {
                copyListeners.set(
                    listener,
                    typeof options === 'object' ? options.signal : undefined
                );
            }
            add.call(this, type, listener, options);
        };
        EventTarget.prototype.removeEventListener = function (
            type,
            listener,
            options
        ) {
            if (this === document && type === 'copy') {
                copyListeners.delete(listener);
            }
            remove.call(this, type, listener, options);
        };
        Object.assign(window, {
            liveCopyListeners: () =>
                [...copyListeners.values()].filter((signal) => !signal?.aborted)
                    .length,
        });
        (window as unknown as ZoomControls).holdFrames();
    });
    await mockLatexProject(page);
    await page.goto(`/project/${uuid}`);
    // отрисовка застряла на первой странице, в этот момент пользователь уходит к списку проектов
    await page
        .locator('[data-pdf-page="0"] canvas')
        .waitFor({ state: 'attached' });
    const liveCopyListeners = () =>
        page.evaluate(() =>
            (
                window as unknown as { liveCopyListeners: () => number }
            ).liveCopyListeners()
        );
    // в Firefox CodeMirror вешает свой обработчик copy навсегда, поэтому считаем от того, что было до ухода
    const before = await liveCopyListeners();
    await page.evaluate(() => {
        Object.assign(window, {
            firstPage: document.querySelector('[data-pdf-page="0"]'),
        });
        history.pushState({}, '', '/projects');
        window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.locator('[data-pdf-page]')).toHaveCount(0);
    await page.evaluate(() =>
        (window as unknown as ZoomControls).releaseFrames()
    );
    // текстовый слой снятой страницы дорисован, сразу за этим прогон регистрировал его в выделении
    await expect
        .poll(() =>
            page.evaluate(() =>
                Boolean(
                    (
                        window as unknown as { firstPage: Element }
                    ).firstPage.querySelector('.textLayer span')
                )
            )
        )
        .toBe(true);
    expect(await liveCopyListeners()).toBeLessThanOrEqual(before);
});

test('pdf-links-stay-below-app-overlays', async ({ page }) => {
    await openPdf(page);
    // у ссылок pdf.js z-index растёт с их числом, у седьмой он 12, а меню и шапки приложения живут на 5-30
    const point = await linkCenter(page, EXPLICIT_LINK);
    const hit = await page.evaluate(({ x, y }) => {
        const overlay = document.createElement('div');
        overlay.id = 'zz-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:5';
        document.body.append(overlay);
        return document.elementFromPoint(x, y)?.id;
    }, point);
    expect(hit).toBe('zz-overlay');
});

test.describe('phone', () => {
    // defaultBrowserType нельзя менять внутри файла, остальное от Pixel 7 берём целиком
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { defaultBrowserType, ...pixel7 } = devices['Pixel 7'];
    test.use({ ...pixel7 });
    test.skip(
        ({ browserName }) => browserName === 'firefox',
        'Firefox не эмулирует мобильные устройства'
    );

    test('phone-tap-on-link-follows-it', async ({ page }) => {
        await openPdf(page);
        const point = await linkCenter(page, NEXT_PAGE_LINK);
        await page.touchscreen.tap(point.x, point.y);
        await expectScrolledTo(page, 1, PAGE_HEIGHT_PT);
    });

    test('phone-tap-next-to-tiny-link-follows-it', async ({ page }) => {
        await openPdf(page);
        // ссылка \pageref на цифру «2» на телефоне занимает несколько пикселей, палец попадает рядом
        const rightEdge = await pdfPoint(
            page,
            0,
            PAGEREF_LINK[2],
            (PAGEREF_LINK[1] + PAGEREF_LINK[3]) / 2
        );
        await page.touchscreen.tap(rightEdge.x + 6, rightEdge.y);
        await expectScrolledTo(page, 1, 803.415);
    });

    test('phone-links-work-after-recompile', async ({ page }) => {
        await openPdf(page);
        await recompile(page, true);
        const point = await linkCenter(page, NAMED_TARGET_LINK);
        await page.touchscreen.tap(point.x, point.y);
        await expectScrolledTo(page, 1, 833.386);
    });

    test('phone-drag-along-line-selects-that-line', async ({ page }) => {
        await openPdf(page);
        await dragAlongLine(page, SHORT_LINE);
        expectLineSelected(await selectedText(page), SHORT_LINE);
    });
});
