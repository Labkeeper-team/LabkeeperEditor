import {
    mockContext,
    mockSaveProgramRequest,
    mockUserInfoWithDefaultUser,
    PROJECT_ID,
    PROJECT_TITLE,
    USER_ID,
} from '../common.ts';
import { AgentEvent } from '../../../model/rpi/agentSocket.ts';
import { Hunk } from '../../../model/domain.ts';
import { Events } from '../../../model/service/ObserverService.ts';
import { MockViewModelRepository } from '../../../viewModel/repository';

const okResult = <T>(body: T) => ({
    code: 200,
    body,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
});

function setup(authenticated = true) {
    const ctx = mockContext();
    ctx.repository.userViewModelRepository.setUserInfo({
        isAuthenticated: authenticated,
        email: 'a@gmail.com',
        id: USER_ID,
        privacyPolicyAccepted: true,
        tokenBalance: 10,
    });
    ctx.repository.projectViewModelRepository.setProject({
        projectId: PROJECT_ID,
        userId: USER_ID,
        title: PROJECT_TITLE,
        lastModified: '2026-09-06T14:00:00Z',
        isPublic: false,
        projectType: 'markdown',
        program: { segments: [], parameters: { roundStrategy: 'noRound' } },
    });
    ctx.repository.projectViewModelRepository.setReadOnly(false);
    ctx.rpi.getAgentHistoryRequest = jest
        .fn()
        .mockResolvedValue(okResult({ history: [] }));
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [] }));
    ctx.rpi.listFilesRequest = jest
        .fn()
        .mockResolvedValue(okResult({ files: [] }));
    // по ТЗ перед стартом агента всё висящее дописывается на сервер
    mockSaveProgramRequest(ctx.rpi);
    return ctx;
}

const emptyProgram = {
    segments: [],
    parameters: { roundStrategy: 'noRound' as const },
};

const emit = (ctx: ReturnType<typeof setup>, event: AgentEvent) =>
    ctx.agentSocketState.handlers?.onEvent(event);

test('agent-start-sends-prompt-and-settings', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');

    await ctx.agentChatService.onPromptSubmit();

    expect(ctx.agentSocketState.projectId).toBe(PROJECT_ID);
    expect(ctx.agentSocketState.started).toEqual({
        prompt: 'сделай таблицу',
        numberIterations: 5,
        maxTokens: 10000,
    });
    // поле очищается сразу, запрос уходит в ленту
    expect(ctx.repository.chatViewModelRepository.input()).toBe('');
    expect(ctx.repository.chatViewModelRepository.messages()).toHaveLength(1);
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe(
        'connecting'
    );
});

test('agent-tool-call-describes-fresh-hunk', async () => {
    const ctx = setup();
    const hunk: Hunk = {
        id: 'k1',
        type: 'addLinesToFile',
        fileName: 'Table.xml',
        startLine: 1,
        endLine: 12,
    };
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [hunk] }));
    ctx.rpi.getProjectRequest = jest.fn().mockResolvedValue(
        okResult({
            projectId: PROJECT_ID,
            userId: USER_ID,
            title: PROJECT_TITLE,
            lastModified: '2026-09-06T14:00:00Z',
            isPublic: false,
            projectType: 'markdown',
            program: {
                segments: [],
                parameters: { roundStrategy: 'noRound' },
            },
        })
    );
    ctx.repository.chatViewModelRepository.setInput('добавь строки');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_file' });

    const messages = ctx.repository.chatViewModelRepository.messages();
    const event = messages.find((m) => m.kind === 'event');
    expect(event).toMatchObject({
        kind: 'event',
        labelKey: 'add_lines_to_file',
        file: 'Table.xml',
        lines: '#L1-12',
    });
});

test('agent-tool-call-without-hunks-still-shows-a-line', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('почитай файлы');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'toolCall', toolName: 'read_file' });

    const events = ctx.repository.chatViewModelRepository
        .messages()
        .filter((m) => m.kind === 'event');
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ labelKey: 'read_file' });
});

test('agent-model-finished-refreshes-token-balance', async () => {
    const ctx = setup();
    mockUserInfoWithDefaultUser(ctx.rpi);
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'modelFinished',
        totalTokens: 100,
        elapsedTimeMillis: 500,
    });

    expect(ctx.rpi.getUserInfoRequest).toHaveBeenCalledTimes(1);
    expect(ctx.repository.userViewModelRepository.tokenBalance()).toBe(0);
});

test('agent-finished-done-appends-response-and-unlocks', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    const messages = ctx.repository.chatViewModelRepository.messages();
    expect(messages[messages.length - 1]).toMatchObject({
        kind: 'response',
        text: 'готово',
    });
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('ok');
    expect(ctx.agentChatService.isRunning()).toBe(false);
});

test.each([
    ['PaymentRequired'],
    ['Locked'],
    ['UnauthorizedLimitExceeded'],
    ['UnknownError'],
] as const)('agent-stop-reason-%s-shows-error', async (stopReason) => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'finished', message: null, stopReason });

    const messages = ctx.repository.chatViewModelRepository.messages();
    expect(messages[messages.length - 1]).toMatchObject({
        kind: 'error',
        reason: stopReason,
    });
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('error');
});

test.each([['IterationLimit'], ['ContextOverflow'], ['Timeout']] as const)(
    'agent-stop-reason-%s-keeps-the-answer',
    async (stopReason) => {
        const ctx = setup();
        ctx.repository.chatViewModelRepository.setInput('привет');

        await ctx.agentChatService.onPromptSubmit();
        await emit(ctx, {
            kind: 'finished',
            message: 'успел частично',
            stopReason,
        });

        const kinds = ctx.repository.chatViewModelRepository
            .messages()
            .map((m) => m.kind);
        // и ответ, и пояснение почему агент не доработал: пояснение не ошибка
        expect(kinds).toContain('response');
        expect(kinds).toContain('notice');
        expect(kinds).not.toContain('error');
        expect(ctx.repository.chatViewModelRepository.requestState()).toBe(
            'ok'
        );
    }
);

test('agent-null-message-does-not-add-empty-response', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'finished', message: null, stopReason: 'Done' });

    const kinds = ctx.repository.chatViewModelRepository
        .messages()
        .map((m) => m.kind);
    expect(kinds).not.toContain('response');
});

test('agent-connection-drop-unlocks-and-reports', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();
    ctx.agentSocketState.handlers?.onClosed('closed');

    const messages = ctx.repository.chatViewModelRepository.messages();
    expect(messages[messages.length - 1]).toMatchObject({
        kind: 'error',
        reason: 'disconnected',
    });
    expect(ctx.agentChatService.isRunning()).toBe(false);
});

test('agent-timeout-unlocks-and-reports', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();
    ctx.agentSocketState.handlers?.onClosed('timeout');

    const messages = ctx.repository.chatViewModelRepository.messages();
    expect(messages[messages.length - 1]).toMatchObject({
        kind: 'error',
        reason: 'timeout',
    });
});

test('double-submit-starts-one-run', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('дважды');

    // второе нажатие приходит, пока первое ещё дописывает сохранения
    const first = ctx.agentChatService.onPromptSubmit();
    const second = ctx.agentChatService.onPromptSubmit();
    await Promise.all([first, second]);

    const requests = ctx.repository.chatViewModelRepository
        .messages()
        .filter((m) => m.kind === 'request');
    expect(requests).toHaveLength(1);
});

test('authorized-without-project-does-not-touch-transcript', async () => {
    const ctx = setup();
    ctx.repository.projectViewModelRepository.setProject(undefined);
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();

    expect(ctx.repository.chatViewModelRepository.messages()).toHaveLength(0);
    expect(ctx.repository.chatViewModelRepository.input()).toBe('привет');
    expect(ctx.agentChatService.isRunning()).toBe(false);
});

test('unauthorized-limit-exceeded-does-not-replace-program', async () => {
    const ctx = setup(false);
    ctx.repository.projectViewModelRepository.setCurrentProgram({
        segments: [{ type: 'md', parameters: {}, text: 'ORIGINAL' }],
        parameters: { roundStrategy: 'noRound' },
    });
    ctx.repository.chatViewModelRepository.setInput('сделай');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'UnauthorizedLimitExceeded',
        program: {
            segments: [{ type: 'md', parameters: {}, text: 'LLM GENERATED' }],
            parameters: { roundStrategy: 'noRound' },
        },
        hunks: [],
    });

    const program = ctx.repository.projectViewModelRepository.currentProgram();
    expect(program.segments[0].text).toBe('ORIGINAL');
    expect(ctx.repository.authViewModelRepository.currentView()).toBe('login');
});

test('project-change-closes-session-and-clears-chat', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('привет');
    await ctx.agentChatService.onPromptSubmit();

    ctx.agentChatService.onProjectChanged();

    expect(ctx.agentSocketState.closeCalls).toBe(1);
    expect(ctx.repository.chatViewModelRepository.messages()).toHaveLength(0);
    expect(ctx.repository.chatViewModelRepository.history()).toHaveLength(0);
    expect(ctx.agentChatService.isRunning()).toBe(false);
});

test('tool-call-without-hunks-uses-plain-label', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('добавь');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'toolCall', toolName: 'add_segment' });

    const events = ctx.repository.chatViewModelRepository
        .messages()
        .filter((m) => m.kind === 'event');
    // без hunks нельзя назвать файл, поэтому нейтральный текст без предлога
    expect(events[0]).toMatchObject({ labelKey: 'add_segment_plain' });
});

test('history-loads-once-for-authenticated', async () => {
    const ctx = setup();
    ctx.rpi.getAgentHistoryRequest = jest.fn().mockResolvedValue(
        okResult({
            history: [
                {
                    id: 'h1',
                    request: 'вопрос',
                    response: 'ответ',
                    createdAt: '2026-09-06T14:23:00Z',
                },
            ],
        })
    );

    await ctx.agentChatService.onChatOpened();
    await ctx.agentChatService.onChatOpened();

    expect(ctx.rpi.getAgentHistoryRequest).toHaveBeenCalledTimes(1);
    expect(ctx.repository.chatViewModelRepository.history()).toHaveLength(1);
});

test('history-is-not-loaded-for-unauthorized', async () => {
    const ctx = setup(false);

    await ctx.agentChatService.onChatOpened();

    expect(ctx.rpi.getAgentHistoryRequest).not.toHaveBeenCalled();
});

test('history-clear-keeps-list-when-request-fails', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setHistory([
        {
            id: 'h1',
            request: 'вопрос',
            response: 'ответ',
            createdAt: '2026-09-06T14:23:00Z',
        },
    ]);
    ctx.rpi.clearAgentHistoryRequest = jest.fn().mockResolvedValue({
        code: 500,
        body: {},
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });

    await ctx.agentChatService.onClearHistoryClicked();

    expect(ctx.repository.chatViewModelRepository.history()).toHaveLength(1);
});

test('unauthorized-run-sends-program-and-applies-result', async () => {
    const ctx = setup(false);
    ctx.repository.chatViewModelRepository.setInput('сделай');

    await ctx.agentChatService.onPromptSubmit();

    expect(ctx.agentSocketState.program).not.toBeNull();
    expect(ctx.rpi.getAgentHistoryRequest).not.toHaveBeenCalled();

    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
        program: {
            segments: [
                {
                    type: 'md',
                    parameters: {},
                    text: 'LLM GENERATED',
                },
            ],
            parameters: { roundStrategy: 'firstMeaningDigit' },
        },
        hunks: [],
    });

    const program = ctx.repository.projectViewModelRepository.currentProgram();
    expect(program.segments[0].text).toBe('LLM GENERATED');
    expect(ctx.repository.ideViewModelRepository.undoEnabled()).toBe(true);
});

test('agent-start-is-abandoned-when-the-project-changes-while-saving', async () => {
    const ctx = setup();
    let releaseSave: () => void = () => {};
    ctx.rpi.saveProgramRequest = jest.fn().mockReturnValue(
        new Promise((resolve) => {
            releaseSave = () => resolve(okResult({}));
        })
    );
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');

    const submit = ctx.agentChatService.onPromptSubmit();
    // пока сохранение в сети, пользователь ушёл на другой проект
    ctx.agentChatService.onProjectChanged();
    releaseSave();
    await submit;

    expect(ctx.agentSocketState.started).toBeNull();
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('idle');
});

test('agent-does-not-start-when-saving-the-program-fails', async () => {
    const ctx = setup();
    ctx.rpi.saveProgramRequest = jest.fn().mockResolvedValue({
        code: 500,
        body: {},
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');

    await ctx.agentChatService.onPromptSubmit();

    // агент работал бы с прошлой версией проекта, запускать его нельзя
    expect(ctx.agentSocketState.started).toBeNull();
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('error');
    // причина отказа своя, иначе её не отличить от ошибки самого агента
    expect(
        ctx.repository.chatViewModelRepository
            .messages()
            .map((message) =>
                message.kind === 'error' ? message.reason : message.kind
            )
    ).toContain('save_failed');
});

test('events-of-a-closed-session-do-not-reach-the-chat', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();
    const handlers = ctx.agentSocketState.handlers;

    ctx.agentChatService.onProjectChanged();
    await handlers?.onEvent({
        kind: 'finished',
        message: 'ответ от прошлого проекта',
        stopReason: 'Done',
    });
    handlers?.onClosed('closed');

    expect(ctx.repository.chatViewModelRepository.messages()).toHaveLength(0);
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('idle');
});

test('project-reset-closes-the-agent-session', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    ctx.repository.projectViewModelRepository.setReadOnly(false);
    ctx.resetService.resetProject();

    expect(ctx.agentSocketState.closeCalls).toBe(1);
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('idle');
});

test('history-clear-failure-tells-the-user', async () => {
    const ctx = setup();
    ctx.rpi.clearAgentHistoryRequest = jest.fn().mockResolvedValue({
        code: 500,
        body: {},
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });
    ctx.repository.chatViewModelRepository.setHistory([
        {
            id: '1',
            request: 'вопрос',
            response: 'ответ',
            createdAt: '2026-09-08T10:00:00Z',
        },
    ]);

    await ctx.agentChatService.onClearHistoryClicked();

    // история осталась на экране, значит про отказ надо сказать вслух
    expect(ctx.repository.chatViewModelRepository.history()).toHaveLength(1);
    expect(
        (ctx.repository as MockViewModelRepository).mockState().toasts
    ).toHaveLength(1);
});

test('agent-start-opens-one-connection', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');

    await ctx.agentChatService.onPromptSubmit();
    // второе нажатие по той же кнопке не должно открыть вторую сессию
    await ctx.agentChatService.onPromptSubmit();

    expect(ctx.agentSocketState.startCalls).toBe(1);
});

test('agent-events-append-to-transcript-in-order', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    await emit(ctx, {
        kind: 'modelFinished',
        totalTokens: 10,
        elapsedTimeMillis: 5,
    });
    await emit(ctx, { kind: 'toolCall', toolName: 'read_segment' });
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    expect(
        ctx.repository.chatViewModelRepository
            .messages()
            .map((message) =>
                message.kind === 'event' ? message.labelKey : message.kind
            )
    ).toEqual(['request', 'model_call', 'read_segment', 'response']);
});

test('stop-reason-payment-required-reports-payment-event', async () => {
    const ctx = setup();
    const events: string[] = [];
    ctx.observerService.onEvent = (event: string) => events.push(event);
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'PaymentRequired',
    });

    expect(events).toContain(Events.EVENT_PAYMENT_REQUIRED);
});

test('tool-call-reloads-the-program-for-a-segment-hunk', async () => {
    const ctx = setup();
    const hunk: Hunk = {
        id: 'k1',
        type: 'addLinesToSegment',
        segmentId: 2,
        startLine: 1,
        endLine: 3,
    };
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [hunk] }));
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();
    (ctx.rpi.getProjectRequest as jest.Mock) = jest
        .fn()
        .mockResolvedValue(
            okResult({ program: emptyProgram, lastProgramResult: undefined })
        );

    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });

    expect(ctx.rpi.listHunksRequest).toHaveBeenCalled();
    // сегментный hunk перезагружает программу, файлы при этом не трогаем
    expect(ctx.rpi.getProjectRequest).toHaveBeenCalled();
    expect(ctx.rpi.listFilesRequest).not.toHaveBeenCalled();
});

test('history-load-failure-shows-empty-state', async () => {
    const ctx = setup();
    ctx.rpi.getAgentHistoryRequest = jest.fn().mockResolvedValue({
        code: 500,
        body: {},
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });

    await ctx.agentChatService.onChatOpened();

    expect(ctx.repository.chatViewModelRepository.historyRequestState()).toBe(
        'error'
    );
    expect(ctx.repository.chatViewModelRepository.history()).toHaveLength(0);
});

test('history-clear-is-not-available-for-unauthorized', async () => {
    const ctx = setup(false);
    ctx.rpi.clearAgentHistoryRequest = jest.fn();

    await ctx.agentChatService.onClearHistoryClicked();

    expect(ctx.rpi.clearAgentHistoryRequest).not.toHaveBeenCalled();
});

test('unauthorized-agent-stores-hunks', async () => {
    const ctx = setup(false);
    const hunk: Hunk = {
        id: 'k1',
        type: 'addSegment',
        segmentId: 1,
    };
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
        program: emptyProgram,
        hunks: [hunk],
    });

    expect(ctx.repository.ideViewModelRepository.hunks()).toEqual([hunk]);
});
