import {
    mockAuthenticatedStartup,
    mockContext,
    mockUserInfoForUnauthorized,
    PROJECT_ID,
    USER_ID,
} from '../common.ts';
import {
    AgentHistoryEntry,
    Hunk,
    Program,
    Segment,
} from '../../../model/domain.ts';
import { Routes } from '../../../viewModel/routes.ts';

/** GH-256: правки и история агента гостя уходят в проект, который создаётся при входе */

const segment = (text: string): Segment => ({
    id: 1,
    type: 'md',
    text,
    parameters: { visible: true },
});

const guestProgram: Program = {
    segments: [segment('Строка от агента')],
    parameters: { roundStrategy: 'noRound' },
};

const exampleProgram: Program = {
    segments: [segment('пример из ссылки')],
    parameters: { roundStrategy: 'noRound' },
};

const HUNK: Hunk = {
    id: 'guest-hunk',
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 1,
    endLine: 1,
    text: 'Строка от агента',
};

const HISTORY: AgentHistoryEntry[] = [
    {
        id: '3f0c2c8e-6f5e-4b7a-9c3d-1a2b3c4d5e6f',
        request: 'добавь строку',
        response: 'добавил',
        createdAt: '2026-11-13T10:00:00.000Z',
    },
];

function context({
    authenticated,
    program = guestProgram,
    defaultProjectOk = true,
}: {
    authenticated: boolean;
    program?: Program;
    defaultProjectOk?: boolean;
}) {
    const ctx = mockContext();
    if (authenticated) {
        mockAuthenticatedStartup(ctx.rpi);
    } else {
        mockUserInfoForUnauthorized(ctx.rpi);
    }
    ctx.repository.setLocation(Routes.ProjectDefault);
    const persistence = ctx.repository.persistenceViewModelRepository;
    persistence.setLastProgram(program);
    persistence.setGuestAgentHunks([HUNK]);
    persistence.setGuestAgentHistory(HISTORY);
    // согласие на трансграничную передачу дано, иначе запрос агенту не уйдёт
    persistence.setCrossBorderConsentAcceptedLocally(true);
    // пример из ссылки собирается и сохраняется сразу после открытия
    ctx.rpi.pdfCompilationRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { pdfUri: 'https://files.example/guest.pdf' },
    });
    ctx.rpi.compilationRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { segments: [] },
    });
    ctx.rpi.compileProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { pdfUri: 'https://files.example/project.pdf' },
    });
    ctx.rpi.saveProgramRequest = jest
        .fn()
        .mockResolvedValue({ code: 200, isOk: true, body: undefined });
    ctx.rpi.getBlogExampleProgramRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: exampleProgram,
    });
    ctx.rpi.getDefaultProjectRequest = jest
        .fn()
        .mockImplementation((_language: string, sent: Program) =>
            Promise.resolve(
                defaultProjectOk
                    ? {
                          code: 200,
                          isOk: true,
                          isUnauth: false,
                          isForbidden: false,
                          body: {
                              projectId: PROJECT_ID,
                              userId: USER_ID,
                              title: 'Default Project',
                              projectType: 'markdown',
                              isPublic: false,
                              lastModified: '2026-11-13T00:00:00Z',
                              program: sent,
                          },
                      }
                    : {
                          code: 0,
                          isOk: false,
                          isUnauth: false,
                          isForbidden: false,
                          body: undefined,
                      }
            )
        );
    return ctx;
}

const guestState = (ctx: ReturnType<typeof context>) => ({
    hunks: ctx.repository.persistenceViewModelRepository.guestAgentHunks(),
    history: ctx.repository.persistenceViewModelRepository.guestAgentHistory(),
});

test('signing-in-sends-the-guest-hunks-and-history-with-the-program-and-forgets-them', async () => {
    const ctx = context({ authenticated: true });

    await ctx.startupService.onAppStartup();

    expect(ctx.rpi.getDefaultProjectRequest).toHaveBeenCalledWith(
        expect.any(String),
        guestProgram,
        expect.any(String),
        { hunks: [HUNK], history: HISTORY }
    );
    // второй вход не перенесёт их снова
    expect(guestState(ctx)).toEqual({ hunks: [], history: [] });
});

test('a-failed-default-project-keeps-the-guest-state-for-the-next-try', async () => {
    const ctx = context({ authenticated: true, defaultProjectOk: false });

    await ctx.startupService.onAppStartup();

    expect(guestState(ctx)).toEqual({ hunks: [HUNK], history: HISTORY });
});

test('an-empty-guest-program-sends-no-agent-state', async () => {
    const ctx = context({
        authenticated: true,
        program: { segments: [], parameters: { roundStrategy: 'noRound' } },
    });

    await ctx.startupService.onAppStartup();

    expect(ctx.rpi.getDefaultProjectRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.anything(),
        expect.any(String),
        undefined
    );
});

test('a-program-from-a-link-is-not-the-guest-one-and-gets-no-guest-hunks', async () => {
    const ctx = context({ authenticated: true });

    await ctx.startupService.onAppStartup(undefined, undefined, {
        example: 'many-segments',
    });

    expect(ctx.rpi.getDefaultProjectRequest).toHaveBeenCalledWith(
        expect.any(String),
        exampleProgram,
        expect.any(String),
        undefined
    );
    // программа гостя после входа всё равно забыта, а с ней и его правки
    expect(guestState(ctx)).toEqual({ hunks: [], history: [] });
});

test('a-guest-sees-the-hunks-of-earlier-runs-after-a-reload', async () => {
    const ctx = context({ authenticated: false });

    await ctx.startupService.onAppStartup();

    expect(ctx.repository.ideViewModelRepository.hunks()).toEqual([HUNK]);
    expect(ctx.rpi.getDefaultProjectRequest).not.toHaveBeenCalled();
});

test('a-link-example-replaces-the-guest-program-and-forgets-its-agent-state', async () => {
    const ctx = context({ authenticated: false });

    await ctx.startupService.onAppStartup(undefined, undefined, {
        example: 'many-segments',
    });

    expect(guestState(ctx)).toEqual({ hunks: [], history: [] });
    expect(ctx.repository.ideViewModelRepository.hunks()).toEqual([]);
});

describe('guest hunks follow the editor', () => {
    const SECOND: Hunk = { ...HUNK, id: 'second-hunk', startLine: 2 };

    test('a-guest-run-and-a-local-accept-are-saved-for-the-sign-in', async () => {
        const ctx = context({ authenticated: false });
        await ctx.startupService.onAppStartup();

        ctx.hunkService.setHunksFromPrompt([HUNK, SECOND]);
        expect(guestState(ctx).hunks).toEqual([HUNK, SECOND]);

        // приём, набор текста в сегменте и undo снимают правку так
        ctx.hunkService.removeHunksLocally([HUNK.id]);
        expect(guestState(ctx).hunks).toEqual([SECOND]);
    });

    test('a-signed-in-user-hunks-are-not-saved-as-guest-ones', async () => {
        const ctx = context({ authenticated: true });
        await ctx.startupService.onAppStartup();

        ctx.hunkService.setHunksFromPrompt([SECOND]);

        expect(guestState(ctx).hunks).toEqual([]);
    });
});

describe('guest runs become history entries', () => {
    async function guestRun(
        ctx: ReturnType<typeof context>,
        prompt: string,
        finished: Record<string, unknown>
    ) {
        ctx.repository.chatViewModelRepository.setInput(prompt);
        await ctx.agentChatService.onPromptSubmit();
        await ctx.agentSocketState.handlers?.onEvent({
            kind: 'finished',
            message: null,
            program: guestProgram,
            hunks: [HUNK],
            ...finished,
        } as never);
        await new Promise((resolve) => setTimeout(resolve, 0));
    }

    function guestContext() {
        const ctx = context({ authenticated: false });
        ctx.repository.persistenceViewModelRepository.setGuestAgentHistory([]);
        return ctx;
    }

    test('a-finished-guest-run-is-remembered-with-its-prompt-and-answer', async () => {
        const ctx = guestContext();
        await ctx.startupService.onAppStartup();

        await guestRun(ctx, 'добавь строку', {
            stopReason: 'Done',
            message: 'Добавил строку',
            contextTokens: 1200,
            maxContextTokens: 100000,
        });

        const [entry] = guestState(ctx).history;
        expect(entry).toEqual({
            id: expect.stringMatching(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
            ),
            request: 'добавь строку',
            response: 'Добавил строку',
            createdAt: expect.any(String),
            contextTokens: 1200,
            maxContextTokens: 100000,
        });
        expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
    });

    test('a-run-without-an-answer-is-remembered-with-an-empty-response', async () => {
        const ctx = guestContext();
        await ctx.startupService.onAppStartup();

        await guestRun(ctx, 'сделай', {
            stopReason: 'IterationLimit',
        });

        expect(guestState(ctx).history).toEqual([
            expect.objectContaining({ request: 'сделай', response: '' }),
        ]);
    });

    test('a-failed-guest-run-is-not-remembered', async () => {
        const ctx = guestContext();
        await ctx.startupService.onAppStartup();

        await guestRun(ctx, 'слишком много', {
            stopReason: 'UnauthorizedLimitExceeded',
        });

        expect(guestState(ctx).history).toEqual([]);
    });
});
