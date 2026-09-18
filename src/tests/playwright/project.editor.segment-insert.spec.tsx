import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program, Segment } from '../../model/domain.ts';

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

function mdSegment(id: number, text: string): Segment {
    return { id, type: 'md', text, parameters: { visible: true } };
}

function programOf(segments: Segment[]): Program {
    return { segments, parameters: { roundStrategy: 'noRound' } };
}

async function openProject(page: Page, segments: Segment[]) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.setupGetProjectRequest(
        200,
        'default',
        programOf(segments)
    );
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket([]);
    await page.goto(`/project/${uuid}`);
    const editors = page.locator('.segment-editor-container .cm-content');
    // первое открытие на холодном dev-сервере под нагрузкой бывает дольше пяти секунд
    await expect(editors).toHaveCount(segments.length, { timeout: 30_000 });
    return editors;
}

test('text-typed-into-an-inserted-segment-survives-the-typing-pause', async ({
    page,
}) => {
    await page.clock.install();
    const editors = await openProject(page, [
        mdSegment(1, 'first'),
        mdSegment(2, 'second'),
    ]);
    await editors.nth(1).click();
    await editors.nth(1).press('End');

    // защёлка набора в @uiw тикает на setInterval, стоящие часы держат её открытой на время вставки
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1_000));
    await editors.nth(1).pressSequentially(' edited');
    await page.locator('.segment-divider .divider-button').first().click();
    await page
        .locator('.segment-divider')
        .first()
        .locator('.divider-dropdown button')
        .filter({ hasText: /^Markdown$/i })
        .click();
    // новый редактор рисуется через setTimeout(0), а защёлке до истечения нужно 200 тиков
    await page.clock.runFor(20);
    await expect(editors).toHaveCount(3);
    await editors.nth(1).click();
    await editors.nth(1).pressSequentially('inserted');
    await expect(editors.nth(1)).toHaveText('inserted');

    // защёлка истекает, и @uiw применяет отложенную замену со старым пустым текстом
    await page.clock.runFor(5_000);
    await page.clock.resume();
    await expect(editors.nth(1)).toHaveText('inserted');
    await expect(editors.nth(2)).toHaveText('second edited');
});

test('segment-with-windows-line-breaks-opens-without-hanging', async ({
    page,
}) => {
    // агент и сторонние клиенты API могут прислать \r\n, а CodeMirror хранит только \n
    const editors = await openProject(page, [
        mdSegment(1, 'first line\r\nsecond line'),
    ]);
    await expect(editors.locator('.cm-line')).toHaveText([
        'first line',
        'second line',
    ]);

    // зациклившаяся в микрозадачах вкладка не отвечает даже на evaluate
    const answered = await Promise.race([
        page.evaluate(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 5_000)),
    ]);
    expect(answered).toBe(true);
});
