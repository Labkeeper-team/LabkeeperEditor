import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'fs';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Hunk, Program } from '../../model/domain.ts';

/**
 * GH-149: в агентском режиме редактора нет, и правку агента видно только в
 * PDF. После прогона со сборкой PDF встаёт на первую строку последней правки:
 * её место в документе называет навигация SyncTeX
 */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

type Frame = Record<string, unknown>;

// настоящий PDF pdfTeX на три страницы, строки видны в текстовом слое
const PDF = readFileSync(
    new URL('./fixtures/pdf-links-selection.pdf', import.meta.url)
);
const THIRD_PAGE_LINE = 'Third page first line';
const FIRST_PAGE_LINE = 'Short line for selection';
// WebKit под нагрузкой рисует четыре страницы с текстовым слоем дольше пяти секунд
const PDF_RENDER = { timeout: 30000 };
const RESULT_PDF =
    'https://files.labkeeper.io/generated/user-1/project-1/result7.pdf';

const LATEX_PROGRAM: Program = {
    segments: [
        {
            id: 1,
            type: 'latex',
            text: 'First line.\nSecond line.\nThird line.',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' },
};

const AGENT_HUNK: Hunk = {
    id: 'h1',
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 3,
    endLine: 3,
};

const toolCall: Frame = { type: 'toolCall', toolName: 'add_lines_to_segment' };
const pdfCompiled: Frame = {
    type: 'compilationFinished',
    pdf: { pdfUri: RESULT_PDF },
    markdown: null,
};
const agentDone: Frame = {
    type: 'agentFinished',
    message: 'готово',
    stopReason: 'Done',
};

/**
 * Где стоит колонка PDF: смещение начала страницы от верхней кромки колонки
 * и видна ли строка. toBeInViewport в WebKit отвечает нулём для строк
 * текстового слоя pdf.js даже на экране, поэтому сверяем прямоугольники
 */
const pdfPlacement = (page: Page, pageIndex: number, text: string) =>
    page.evaluate(
        ([index, needle]) => {
            const pageElement = document.querySelector(
                `[data-pdf-page="${index}"]`
            );
            const scroller = pageElement?.parentElement;
            const span = Array.from(
                document.querySelectorAll('.textLayer span')
            ).find((element) => element.textContent === needle);
            if (!pageElement || !scroller || !span) {
                return null;
            }
            const view = scroller.getBoundingClientRect();
            const line = span.getBoundingClientRect();
            return {
                pageOffset: Math.round(
                    pageElement.getBoundingClientRect().top - view.top
                ),
                lineVisible: line.bottom > view.top && line.top < view.bottom,
            };
        },
        [pageIndex, text] as const
    );

async function openAgentRun(page: Page, navigationStatus = 200) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    routeSetup.setupLatexProject();
    await routeSetup.setupGetProjectRequest(200, 'default', LATEX_PROGRAM);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupAgentHistoryRequest([]);
    const agent = await routeSetup.setupAgentSocketByHand();
    // правка агента появляется в списке hunks только после старта прогона
    await page.route(`**/public/project/${uuid}/hunk`, (route) =>
        route.fulfill({
            json: { hunks: agent.received.length ? [AGENT_HUNK] : [] },
        })
    );
    await page.route(`**/public/project/${uuid}/file/list**`, (route) =>
        route.fulfill({ json: { files: [] } })
    );
    await page.context().route('https://files.labkeeper.io/**', (route) =>
        route.fulfill({
            contentType: 'application/pdf',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: PDF,
        })
    );
    // SyncTeX отвечает местом правки в собранном документе: третья страница
    const navigation: unknown[] = [];
    await page.route(`**/public/project/${uuid}/navigation/pdf`, (route) => {
        navigation.push(route.request().postDataJSON());
        return navigationStatus === 200
            ? // базовая линия первой строки страницы: поле 3 мм и шрифт 12 pt
              route.fulfill({ json: { page: 3, x: 72, y: 20 } })
            : route.fulfill({ status: navigationStatus, json: {} });
    });

    await page.goto(`/project/${uuid}/agent`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByPlaceholder('Enter your promt').fill('добавь строку');
    await page.getByRole('button', { name: 'Send' }).click();
    for (const frame of [toolCall, pdfCompiled, agentDone]) {
        await agent.send(frame);
    }
    return { navigation };
}

test('after-the-run-the-pdf-shows-the-last-agent-change', async ({ page }) => {
    const { navigation } = await openAgentRun(page);

    // колонка встала на начало третьей страницы, и её первая строка на экране
    await expect
        .poll(async () => {
            const placement = await pdfPlacement(page, 2, THIRD_PAGE_LINE);
            return (
                placement !== null &&
                Math.abs(placement.pageOffset) < 40 &&
                placement.lineVisible
            );
        }, PDF_RENDER)
        .toBe(true);
    // спросили место первой строки последней правки
    expect(navigation).toEqual([{ segmentId: 1, line: 3 }]);
});

test('failed-navigation-leaves-the-pdf-at-the-top-without-a-message', async ({
    page,
}) => {
    const { navigation } = await openAgentRun(page, 500);

    // третья страница отрисована и навигация ответила, значит прокрутка уже случилась бы
    await expect(page.getByText(THIRD_PAGE_LINE)).toBeAttached(PDF_RENDER);
    await expect.poll(() => navigation.length).toBe(1);
    // ТЗ: человеку ничего не говорим, PDF остаётся где был
    expect(await pdfPlacement(page, 0, FIRST_PAGE_LINE)).toMatchObject({
        pageOffset: 0,
        lineVisible: true,
    });
    expect(await pdfPlacement(page, 2, THIRD_PAGE_LINE)).toMatchObject({
        lineVisible: false,
    });
    await expect(page.locator('.Toastify__toast')).toHaveCount(0);
});
