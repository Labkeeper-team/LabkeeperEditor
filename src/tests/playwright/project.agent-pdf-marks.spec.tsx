import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Hunk, Program } from '../../model/domain.ts';

/**
 * GH-190: правки агента отмечаются зелёным поверх PDF. Места правок
 * называет навигация SyncTeX, пока идут её запросы, на панели PDF плашка
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

// настоящий PDF pdfTeX формата A4, строки видны в текстовом слое
const PDF = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);
const PAGE_HEIGHT_PT = 841.89;
const RESULT_PDF =
    'https://files.labkeeper.io/generated/user-1/project-1/result.pdf';
const PDF_RENDER = { timeout: 30000 };

const PROGRAM: Program = {
    segments: [
        {
            id: 1,
            type: 'latex',
            text: 'Links and selection\nShort line for selection\nExternal link',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' },
};

// агент дописал две строки, их место в PDF: «Short line…» и «External…»
const AGENT_HUNK: Hunk = {
    id: 'h1',
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 2,
    endLine: 3,
};

/** Базовые линии строк сегмента в PDF, pt от верха первой страницы */
const BASELINES: Record<number, number> = { 2: 46, 3: 60, 4: 400 };

async function openProjectWithAgentChange(
    page: Page,
    path = `/project/${uuid}`
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    routeSetup.setupLatexProject();
    await routeSetup.setupGetProjectRequest(200, 'default', PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesCustom([
        { fileName: 'result.pdf', url: RESULT_PDF },
    ]);
    await routeSetup.setupHunkRequestsWithState([AGENT_HUNK]);
    await page.context().route('https://files.labkeeper.io/**', (route) =>
        route.fulfill({
            contentType: 'application/pdf',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: PDF,
        })
    );
    // ответы навигации ждут команды опыта: так видно плашку на время поиска
    let release: () => void = () => {};
    const released = new Promise<void>((resolve) => {
        release = resolve;
    });
    const lines: number[] = [];
    await page.route(
        `**/public/project/${uuid}/navigation/pdf`,
        async (route) => {
            const { line } = route.request().postDataJSON() as {
                line: number;
            };
            lines.push(line);
            await released;
            await route.fulfill({
                json: { page: 1, x: 72, y: BASELINES[line] ?? 800 },
            });
        }
    );

    await page.goto(path);
    await page.waitForLoadState('domcontentloaded');
    return { release, lines };
}

const firstPageMark = (page: Page) =>
    page.locator('[data-pdf-page="0"] > .pdf-agent-mark');

/** Отметка в долях высоты страницы: так сверка не зависит от ширины колонки */
const markPlacement = (page: Page) =>
    page.evaluate(() => {
        const pageElement = document.querySelector<HTMLElement>(
            '[data-pdf-page="0"]'
        );
        const mark = pageElement?.querySelector<HTMLElement>(
            ':scope > .pdf-agent-mark'
        );
        if (!pageElement || !mark) {
            return null;
        }
        const height = pageElement.offsetHeight;
        return {
            top: mark.offsetTop / height,
            bottom: (mark.offsetTop + mark.offsetHeight) / height,
            // слой текста над отметкой: выделение и ссылки работают сквозь неё
            underText:
                mark.compareDocumentPosition(
                    pageElement.querySelector('.textLayer')!
                ) === Node.DOCUMENT_POSITION_FOLLOWING,
        };
    });

test('agent-change-is-marked-in-the-pdf-when-the-project-opens', async ({
    page,
}) => {
    const { release, lines } = await openProjectWithAgentChange(page);

    const loading = page.getByRole('status').filter({
        hasText: 'Marking agent edits…',
    });
    await expect(loading).toBeVisible(PDF_RENDER);
    await expect(firstPageMark(page)).toHaveCount(0);

    release();

    await expect(loading).toBeHidden();
    await expect(firstPageMark(page)).toHaveCount(1);
    // от верха первой строки правки до низа последней: следующий текст далеко
    const placement = await markPlacement(page);
    expect(placement?.top).toBeCloseTo((46 - 12) / PAGE_HEIGHT_PT, 2);
    expect(placement?.bottom).toBeCloseTo((60 + 4) / PAGE_HEIGHT_PT, 2);
    expect(placement?.underText).toBe(true);
    // первая строка, последняя и строка после правки
    expect([...lines].sort((a, b) => a - b)).toEqual([2, 3, 4]);
});

test('accepted-agent-change-loses-its-mark-without-new-requests', async ({
    page,
}) => {
    const { release, lines } = await openProjectWithAgentChange(page);
    release();
    await expect(firstPageMark(page)).toHaveCount(1, PDF_RENDER);
    const requests = lines.length;

    await page.getByRole('button', { name: 'Accept all' }).click();

    await expect(firstPageMark(page)).toHaveCount(0);
    expect(lines).toHaveLength(requests);
});

/** Середина отметки на экране */
async function markCenter(page: Page) {
    const box = await firstPageMark(page).boundingBox();
    expect(box).not.toBeNull();
    return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** Строка сегмента, в которой стоит курсор редактора, или null без фокуса в редакторе */
const focusedEditorLine = (page: Page) =>
    page.evaluate(() => {
        if (!document.activeElement?.closest('.cm-content')) {
            return null;
        }
        const anchor = window.getSelection()?.anchorNode;
        const element =
            anchor instanceof Element ? anchor : anchor?.parentElement;
        return element?.closest('.cm-line')?.textContent ?? null;
    });

const MARK_HINT =
    'Not part of the PDF: this marks an agent edit. Click to open it in the editor';

test('agent-mark-explains-itself-on-hover-and-opens-the-change-on-click', async ({
    page,
}) => {
    const { release } = await openProjectWithAgentChange(page);
    release();
    await expect(firstPageMark(page)).toHaveCount(1, PDF_RENDER);
    const center = await markCenter(page);
    // строка правки в текстовом слое, он лежит поверх отметки
    const line = (await page
        .locator('[data-pdf-page="0"] .textLayer span')
        .filter({ hasText: 'Short line for selection' })
        .boundingBox())!;
    const overText = {
        x: line.x + line.width / 2,
        y: line.y + line.height / 2,
    };

    await page.mouse.move(overText.x, overText.y);

    await expect(firstPageMark(page)).toHaveClass(/pdf-agent-mark--hover/);
    await expect(page.getByRole('tooltip')).toHaveText(MARK_HINT);
    // над текстом правки указатель «рука», а не текстовый курсор
    expect(
        await page.evaluate(({ x, y }) => {
            const element = document.elementFromPoint(x, y)!;
            return `${element.tagName} ${getComputedStyle(element).cursor}`;
        }, overText)
    ).toBe('SPAN pointer');

    // выделение текста сквозь отметку работает и правку не открывает
    await page.mouse.move(line.x + 2, line.y + line.height / 2);
    await page.mouse.down();
    await page.mouse.move(line.x + line.width - 2, line.y + line.height / 2, {
        steps: 5,
    });
    await page.mouse.up();
    expect(
        await page.evaluate(() => window.getSelection()?.toString() ?? '')
    ).toContain('line for');
    expect(await focusedEditorLine(page)).toBeNull();
    const box = (await firstPageMark(page).boundingBox())!;

    // ушёл с отметки: подсказки нет
    await page.mouse.move(center.x, box.y - 40);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect(firstPageMark(page)).not.toHaveClass(/pdf-agent-mark--hover/);

    await page.mouse.click(center.x, center.y);

    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await expect
        .poll(() => focusedEditorLine(page))
        .toBe('Short line for selection');
});

test('agent-mark-click-leaves-agent-mode-for-the-editor', async ({ page }) => {
    const { release } = await openProjectWithAgentChange(
        page,
        `/project/${uuid}/agent`
    );
    release();
    await expect(firstPageMark(page)).toHaveCount(1, PDF_RENDER);

    const center = await markCenter(page);
    await page.mouse.click(center.x, center.y);

    await expect(page).toHaveURL(new RegExp(`/project/${uuid}$`));
    await expect
        .poll(() => focusedEditorLine(page))
        .toBe('Short line for selection');
});
