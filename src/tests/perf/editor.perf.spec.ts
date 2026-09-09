import { expect, test, type Page } from '@playwright/test';
import { appendFileSync } from 'fs';
import { RouteSetup } from '../playwright/mock.routeSetUp.tsx';
import { Program, Segment } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

/** Замедление процессора: без него быстрая машина прячет любую просадку */
const CPU_THROTTLING_RATE = 4;
/** Сколько символов набираем в замере */
const TYPED_CHARS = 25;
/** Сколько раз повторяем сценарий: по одной выборке выводов не делаем */
const REPEATS = 3;
/** Пауза между нажатиями: имитируем человека, а не автоповтор */
const TYPING_DELAY_MS = 40;

const REPORT_PATH = 'perf-report.jsonl';
const LABEL = process.env.PERF_LABEL ?? 'current';

declare global {
    interface Window {
        __perfLatencies: number[];
        __perfLongTasks: number[];
    }
}

function mdSegment(id: number, text: string): Segment {
    return { id, type: 'md', text, parameters: { visible: true } };
}

function numberedLines(count: number): string {
    return Array.from(
        { length: count },
        (_, index) => `строка номер ${index + 1}`
    ).join('\n');
}

function programOf(segments: Segment[]): Program {
    return { segments, parameters: { roundStrategy: 'noRound' } };
}

async function openProject(
    page: Page,
    program: Program,
    files: { fileName: string; url: string }[] = [],
    fileContents: { urlPath: string; content: string }[] = []
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(200, 'default', program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    if (files.length) {
        await routeSetup.setupListFilesCustom(files);
    } else {
        await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    }
    for (const file of fileContents) {
        await routeSetup.setupStaticFileContent(file.urlPath, file.content);
    }
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);

    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', {
        rate: CPU_THROTTLING_RATE,
    });

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    return client;
}

/** Задержка от нажатия до отрисованного кадра плюс счётчик длинных задач */
async function startProbes(page: Page) {
    await page.evaluate(() => {
        window.__perfLatencies = [];
        window.__perfLongTasks = [];
        document.addEventListener(
            'keydown',
            () => {
                const start = performance.now();
                requestAnimationFrame(() =>
                    requestAnimationFrame(() =>
                        window.__perfLatencies.push(performance.now() - start)
                    )
                );
            },
            true
        );
        new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                window.__perfLongTasks.push(entry.duration);
            }
        }).observe({ entryTypes: ['longtask'] });
    });
}

function quantile(values: number[], q: number): number {
    if (!values.length) {
        return 0;
    }
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(
        sorted.length - 1,
        Math.floor(q * (sorted.length - 1))
    );
    return Math.round(sorted[index]);
}

/**
 * Прогоняет сценарий REPEATS раз и отдаёт медиану медиан. Один заход ничего не
 * значит: разброс между двумя заходами на одной и той же ветке больше, чем
 * разница между ветками.
 */
async function measure(page: Page, scenario: string, run: () => Promise<void>) {
    const rounds: ReturnType<typeof summarize>[] = [];
    for (let round = 0; round < REPEATS; round += 1) {
        await startProbes(page);
        await run();
        rounds.push(
            summarize(
                await page.evaluate(() => window.__perfLatencies),
                await page.evaluate(() => window.__perfLongTasks)
            )
        );
    }
    const pick = (key: 'medianMs' | 'p95Ms' | 'maxMs') =>
        quantile(
            rounds.map((round) => round[key]),
            0.5
        );
    const measurement = {
        label: LABEL,
        scenario,
        rounds: REPEATS,
        samples: Math.min(...rounds.map((round) => round.samples)),
        medianMs: pick('medianMs'),
        p95Ms: pick('p95Ms'),
        maxMs: pick('maxMs'),
        // по длинным задачам берём худшее из заходов, медиана тут прячет выброс
        longTasks: Math.max(...rounds.map((round) => round.longTasks)),
        longTaskMaxMs: Math.max(...rounds.map((round) => round.longTaskMaxMs)),
        perRound: rounds.map((round) => round.medianMs),
    };
    appendFileSync(REPORT_PATH, `${JSON.stringify(measurement)}\n`);
    console.info(JSON.stringify(measurement));
    return measurement;
}

function summarize(latencies: number[], longTasks: number[]) {
    // первое нажатие всегда завышено: прогревается редактор и подсветка
    const steady = latencies.slice(1);
    return {
        samples: steady.length,
        medianMs: quantile(steady, 0.5),
        p95Ms: quantile(steady, 0.95),
        maxMs: quantile(steady, 1),
        longTasks: longTasks.length,
        longTaskMaxMs: Math.round(Math.max(0, ...longTasks)),
    };
}

test('perf-typing-in-a-long-segment', async ({ page }) => {
    await openProject(page, programOf([mdSegment(1, numberedLines(1000))]));
    const editor = page.locator('.cm-content').first();
    await editor.click();

    const measurement = await measure(page, 'segment-1000-lines', () =>
        editor.pressSequentially('x'.repeat(TYPED_CHARS), {
            delay: TYPING_DELAY_MS,
        })
    );
    expect(measurement.samples).toBeGreaterThan(TYPED_CHARS / 2);
    // порог заведомо мягкий: смысл в сравнении с master, а не в абсолютном числе
    expect(measurement.p95Ms).toBeLessThan(1000);
});

test('perf-typing-with-a-hundred-segments', async ({ page }) => {
    const segments = Array.from({ length: 100 }, (_, index) =>
        mdSegment(index + 1, `сегмент ${index + 1}\nвторая строка`)
    );
    await openProject(page, programOf(segments));
    const editor = page.locator('.cm-content').first();
    await editor.click();

    const measurement = await measure(page, 'segments-100', () =>
        editor.pressSequentially('x'.repeat(TYPED_CHARS), {
            delay: TYPING_DELAY_MS,
        })
    );
    expect(measurement.p95Ms).toBeLessThan(1000);
});

test('perf-held-key-in-a-segment', async ({ page }) => {
    await openProject(page, programOf([mdSegment(1, numberedLines(1000))]));
    const editor = page.locator('.cm-content').first();
    await editor.click();

    // автоповтор: нажатия идут вплотную, без пауз на отрисовку
    const measurement = await measure(page, 'held-key', () =>
        editor.pressSequentially('y'.repeat(60), { delay: 0 })
    );
    // редактор не должен зависать: кадр всё равно приходит
    expect(measurement.samples).toBeGreaterThan(30);
});

test('perf-typing-in-a-long-file', async ({ page }) => {
    const fileName = 'long.txt';
    const url = `https://files.labkeeper.io/project/1/user/1/${fileName}`;
    await openProject(
        page,
        programOf([mdSegment(1, 'короткий сегмент')]),
        [{ fileName, url }],
        [
            {
                urlPath: `/project/1/user/1/${fileName}`,
                content: numberedLines(1000),
            },
        ]
    );

    await page.locator('div.file-manager-button').click();
    await expect(page.getByText(fileName)).toBeVisible();
    await page.getByText(fileName).click();
    const editor = page.locator('.text-file-editor-body .cm-content');
    await expect(editor).toBeVisible();
    await editor.click();

    const measurement = await measure(page, 'file-1000-lines', () =>
        editor.pressSequentially('x'.repeat(TYPED_CHARS), {
            delay: TYPING_DELAY_MS,
        })
    );
    expect(measurement.p95Ms).toBeLessThan(1000);
});
