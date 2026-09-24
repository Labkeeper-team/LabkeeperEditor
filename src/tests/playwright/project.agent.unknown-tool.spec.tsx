import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';
import { Program } from '../../model/domain.ts';

/** Инструменты агента, которых фронт ещё не знает: сервер добавляет их раньше, чем обновится фронт, поэтому незнакомое имя не должно ни ронять страницу, ни терять то, что инструмент поменял в проекте */

const uuid = '2cd18704-6c3f-48cb-96f1-9a923930f8cb';

test.use({ viewport: { width: 1360, height: 900 } });

type Frame = Record<string, unknown>;

const COMMON_LINE = 'The agent performed an action';

const finished = (stopReason: string, message: string | null = 'готово') => ({
    type: 'agentFinished',
    message,
    stopReason,
});

const toolCall = (toolName: string) => ({ type: 'toolCall', toolName });

const oneSegment = (text: string): Program => ({
    segments: [{ id: 1, type: 'md', text, parameters: { visible: true } }],
    parameters: { roundStrategy: 'noRound' },
});

const promptField = (page: Page) => page.getByPlaceholder('Enter your promt');

async function submitPrompt(page: Page, text = 'сделай таблицу') {
    await promptField(page).fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
}

const responses = (page: Page) => page.locator('.agent-chat__response-text');

const segment = (page: Page) =>
    page.locator('.segment-editor-container').first();

/** Ошибки, которые страница не поймала: на них лента падала целиком */
function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
}

async function openChat(
    page: Page,
    frames: Frame[],
    options: { authenticated?: boolean; program?: Program } = {}
) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(options.authenticated ?? true);
    // согласие на передачу данных проверяется отдельной спекой, здесь оно дано
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default', options.program);
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    await routeSetup.setupAgentSocket(frames);

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: 'AI agent' }).click();
}

test('unknown-tool-names-give-the-common-line-and-the-run-finishes', async ({
    page,
}) => {
    const errors = collectPageErrors(page);
    await openChat(page, [
        toolCall('list_workspace'),
        toolCall('replace_in_segment'),
        // имя из Object.prototype раньше роняло всю страницу
        toolCall('constructor'),
        // кадр без имени раньше выбрасывался, и правка такого вызова терялась
        { type: 'toolCall' },
        finished('Done'),
    ]);

    await submitPrompt(page);

    await expect(responses(page)).toHaveText('готово');
    await expect(page.locator('.agent-chat__event-label')).toHaveText([
        'Reading the project structure',
        COMMON_LINE,
        COMMON_LINE,
        COMMON_LINE,
    ]);
    expect(errors).toEqual([]);
});

test('unknown-writing-tool-edit-reaches-the-editor-and-is-not-overwritten', async ({
    page,
}) => {
    const saved: Program[] = [];
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest(200, 'empty', (route) =>
        saved.push(route.request().postDataJSON())
    );
    await routeSetup.setupListFilesRequest(200, 'emptyFiles');
    await routeSetup.setupAgentHistoryRequest([]);
    // новый инструмент переписал сегмент, но понятных фронту hunks не оставил
    await routeSetup.setupListHunksRequest([]);
    const sent = await routeSetup.setupAgentSocket([
        toolCall('replace_in_segment'),
        finished('Done'),
    ]);
    await page.route(`**/public/project/${uuid}/get**`, (route) =>
        route.fulfill({
            json: {
                projectId: uuid,
                userId: 1,
                title: 'Default Project',
                lastModified: '2026-09-24T10:00:00Z',
                isPublic: false,
                projectType: 'markdown',
                program: oneSegment(
                    sent.length ? 'текст агента' : 'старый текст'
                ),
                lastProgramResult: { segments: [] },
            },
        })
    );

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await submitPrompt(page, 'перепиши сегмент');
    await expect(responses(page)).toHaveText('готово');

    await expect(segment(page).locator('.cm-line')).toHaveText([
        'текст агента',
    ]);
    await expect(page.locator('.agent-chat__event-label')).toHaveText([
        COMMON_LINE,
    ]);

    // следующий запрос сохраняет программу целиком, старый текст затёр бы правку агента
    const savesBefore = saved.length;
    await submitPrompt(page, 'проверь');
    await expect.poll(() => saved.length).toBeGreaterThan(savesBefore);
    expect(
        saved.slice(savesBefore).map((program) => program.segments[0].text)
    ).not.toContain('старый текст');
});

test('open-file-deleted-by-an-unknown-tool-is-closed-and-not-uploaded-again', async ({
    page,
}) => {
    const uploads: string[] = [];
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest();
    await routeSetup.acceptCrossBorderConsentLocally();
    await routeSetup.setupGetProjectRequest(200, 'default', oneSegment('раз'));
    await routeSetup.setupGetAllProjectsRequest();
    await routeSetup.setupSaveProgramRequest();
    await routeSetup.setupAgentHistoryRequest([]);
    const sent = await routeSetup.setupAgentSocket([
        toolCall('delete_file'),
        finished('Done'),
    ]);
    // после запуска агента файла на сервере больше нет
    await page.route(`**/public/project/${uuid}/file/list**`, (route) =>
        route.fulfill({
            json: {
                files: sent.length
                    ? []
                    : [
                          {
                              autogenerated: false,
                              fileName: 'notes.txt',
                              url: '/files/notes.txt',
                          },
                      ],
            },
        })
    );
    await page.route(
        (url) => url.pathname === '/files/notes.txt',
        (route) =>
            sent.length
                ? route.fulfill({ status: 404, body: 'not found' })
                : route.fulfill({
                      status: 200,
                      contentType: 'text/plain; charset=utf-8',
                      body: 'заметки',
                  })
    );
    await page.route(`**/public/project/${uuid}/file/upload**`, (route) => {
        uploads.push(route.request().url());
        return route.fulfill({ status: 200 });
    });

    await page.goto(`/project/${uuid}`);
    await page.waitForLoadState('domcontentloaded');
    await page.locator('div.file-manager-button').click();
    await page.getByText('notes.txt').click();
    const fileEditor = page.locator('.editor-container--text-file');
    await expect(fileEditor).toContainText('заметки');
    await page.getByRole('tab', { name: 'AI agent' }).click();
    await submitPrompt(page, 'удали заметки');
    await expect(responses(page)).toHaveText('готово');

    await expect(fileEditor).toHaveCount(0);
    // открытый файл ушёл бы на сервер со следующим запросом и ожил бы там
    const uploadsBefore = uploads.length;
    await submitPrompt(page, 'ещё');
    await expect(responses(page)).toHaveCount(2);
    expect(uploads.slice(uploadsBefore)).toEqual([]);
});

test('guest-result-with-an-unknown-change-type-is-shown-and-accepted', async ({
    page,
}) => {
    const errors = collectPageErrors(page);
    await openChat(
        page,
        [
            toolCall('replace_in_segment'),
            {
                type: 'agentFinishedUnauthorized',
                message: 'готово',
                stopReason: 'Done',
                program: oneSegment('текст агента'),
                // тип правки, которого фронт ещё не знает
                hunks: [
                    {
                        id: 'u1',
                        type: 'replaceLinesInSegment',
                        segmentId: 1,
                        startLine: 1,
                        endLine: 1,
                        text: 'текст агента',
                    },
                ],
            },
        ],
        { authenticated: false, program: oneSegment('старый текст') }
    );

    await submitPrompt(page, 'перепиши сегмент');

    await expect(responses(page)).toHaveText('готово');
    await expect(page.locator('.agent-chat__event-label')).toHaveText([
        COMMON_LINE,
    ]);
    await expect(segment(page).locator('.cm-line')).toHaveText([
        'текст агента',
    ]);
    await page.getByRole('button', { name: 'Accept all' }).click();
    await expect(page.locator('.hunk-global-bar')).toHaveCount(0);
    expect(errors).toEqual([]);
});
