import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program, Segment } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

/** Словари едут по сети и собираются, на холодной машине это небыстро */
const SPELLCHECK_TIMEOUT_MS = 40_000;

// значение по умолчанию тридцать секунд, а мы ждём словарь дольше
test.setTimeout(90_000);

function segmentOf(type: Segment['type'], text: string): Segment {
    return { id: 1, type, text, parameters: { visible: true } };
}

function programOf(segment: Segment): Program {
    return { segments: [segment], parameters: { roundStrategy: 'noRound' } };
}

async function openWith(page: Page, segment: Segment) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', programOf(segment));
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);

    await page.goto(`/project/${uuid}`);
    await page.locator('.cm-content').first().waitFor({ state: 'visible' });
}

test('spellcheck-marks-only-misspelled-words', async ({ page }) => {
    await openWith(page, segmentOf('md', 'привет ошшибка hello speling'));

    const marks = page.locator('.cm-lintRange-error');
    await expect(marks).toHaveCount(2, { timeout: SPELLCHECK_TIMEOUT_MS });

    // подчёркнуты обе ошибки, русская и английская, и ничего сверх них
    expect((await marks.allInnerTexts()).sort()).toEqual([
        'speling',
        'ошшибка',
    ]);
});

test('spellcheck-runs-in-a-worker', async ({ page }) => {
    await openWith(page, segmentOf('md', 'ошшибка'));

    await expect(page.locator('.cm-lintRange-error')).toHaveCount(1, {
        timeout: SPELLCHECK_TIMEOUT_MS,
    });

    // словари весят три с половиной мегабайта: собери их на главном потоке,
    // и страница встанет на несколько секунд при каждом открытии проекта
    const workers = page.workers().map((worker) => worker.url());
    expect(workers.some((url) => url.includes('spellcheckWorker'))).toBe(true);
});

test('spellcheck-skips-latex-commands-math-and-comments', async ({ page }) => {
    await openWith(
        page,
        segmentOf('latex', 'ошшибка \\textbff{тут} $ошшибкаб = 1$ % ошшибкаа')
    );

    const marks = page.locator('.cm-lintRange-error');
    await expect(marks).toHaveCount(1, { timeout: SPELLCHECK_TIMEOUT_MS });

    // команда, формула и комментарий замаскированы, ошибка остаётся одна
    expect(await marks.allInnerTexts()).toEqual(['ошшибка']);
});
