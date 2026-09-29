import {
    FILE_NAME,
    FILE_URL,
    mockContext,
    mockSaveProgramRequest,
    mockUserInfoWithDefaultUser,
    PROJECT_ID,
    PROJECT_TITLE,
    USER_ID,
} from '../common.ts';
import {
    AGENT_STOP_REASONS,
    AgentEvent,
    AgentStopReason,
} from '../../../model/rpi/agentSocket.ts';
import {
    CompileError,
    CompileErrorResult,
    CompileSuccessResult,
    ComputationalOutputSegment,
    Hunk,
    Program,
    ProjectType,
    TableStatement,
} from '../../../model/domain.ts';
import { Events } from '../../../model/service/ObserverService.ts';
import { MockViewModelRepository } from '../../../viewModel/repository';
import * as Sentry from '@sentry/react';

jest.mock('@sentry/react', () => ({
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
}));

beforeEach(() => {
    jest.mocked(Sentry.captureException).mockClear();
});

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
        crossBorderDataTransferPolicyAccepted: true,
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
    // согласие на трансграничную передачу уже дано, иначе до отправки не дойдёт
    ctx.repository.persistenceViewModelRepository.setCrossBorderConsentAcceptedLocally(
        true
    );
    ctx.rpi.getAgentHistoryRequest = jest
        .fn()
        .mockResolvedValue(okResult({ history: [] }));
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [] }));
    ctx.rpi.listFilesRequest = jest
        .fn()
        .mockResolvedValue(okResult({ files: [] }));
    // после обрыва сервис сверяет программу с сервером
    ctx.rpi.getProjectRequest = jest.fn().mockResolvedValue(
        okResult({
            program: { segments: [], parameters: { roundStrategy: 'noRound' } },
        })
    );
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
        numberIterations: 500,
        maxTokens: 100000,
    });
    // поле очищается сразу, запрос уходит в ленту
    expect(ctx.repository.chatViewModelRepository.input()).toBe('');
    expect(ctx.repository.chatViewModelRepository.messages()).toHaveLength(1);
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe(
        'connecting'
    );
});

test('agent-settings-max-tokens-offers-login-to-a-guest', () => {
    const ctx = setup(false);
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');

    ctx.agentChatService.onMaxTokensChanged(200000);

    expect(ctx.repository.authViewModelRepository.currentView()).toBe('login');
    // значение осталось прежним, иначе гость поменял бы настройку в обход входа
    expect(ctx.repository.persistenceViewModelRepository.agentMaxTokens()).toBe(
        100000
    );
    // по источнику в аналитике видно, какая кнопка привела человека в окно входа
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_AUTH_MODAL_OPENED,
        expect.objectContaining({ source: 'agent_settings' })
    );
    expect(onEvent).not.toHaveBeenCalledWith(
        Events.EVENT_AGENT_SETTINGS_CHANGED,
        expect.anything()
    );
});

test('agent-settings-iterations-offers-login-to-a-guest', () => {
    const ctx = setup(false);
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');

    ctx.agentChatService.onIterationsChanged(1000);

    expect(ctx.repository.authViewModelRepository.currentView()).toBe('login');
    expect(
        ctx.repository.persistenceViewModelRepository.agentIterations()
    ).toBe(500);
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_AUTH_MODAL_OPENED,
        expect.objectContaining({ source: 'agent_settings' })
    );
    expect(onEvent).not.toHaveBeenCalledWith(
        Events.EVENT_AGENT_SETTINGS_CHANGED,
        expect.anything()
    );
});

test('agent-settings-stay-editable-for-an-authorized-user', () => {
    const ctx = setup();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');

    ctx.agentChatService.onMaxTokensChanged(200000);
    ctx.agentChatService.onIterationsChanged(1000);

    expect(ctx.repository.persistenceViewModelRepository.agentMaxTokens()).toBe(
        200000
    );
    expect(
        ctx.repository.persistenceViewModelRepository.agentIterations()
    ).toBe(1000);
    // окно входа авторизованному не показываем, проверка не должна быть шире гостя
    expect(ctx.repository.authViewModelRepository.currentView()).toBe('closed');
    expect(onEvent).not.toHaveBeenCalledWith(
        Events.EVENT_AUTH_MODAL_OPENED,
        expect.anything()
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
    ['PromptTooLong'],
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

test.each([
    ['IterationLimit'],
    ['ContextOverflow'],
    ['Timeout'],
    ['QuotaExceeded'],
] as const)('agent-stop-reason-%s-keeps-the-answer', async (stopReason) => {
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
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('ok');
});

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
    const events: string[] = [];
    ctx.observerService.onEvent = (event: string) => events.push(event);
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();
    ctx.agentSocketState.handlers?.onClosed('closed');
    await settled();

    const messages = ctx.repository.chatViewModelRepository.messages();
    expect(messages[messages.length - 1]).toMatchObject({
        kind: 'error',
        reason: 'disconnected',
    });
    expect(ctx.agentChatService.isRunning()).toBe(false);
    expect(events).toContain(Events.EVENT_RPI_UNKNOWN);
    expect(Sentry.captureException).toHaveBeenCalled();
});

test('agent-timeout-unlocks-and-reports', async () => {
    const ctx = setup();
    const events: string[] = [];
    ctx.observerService.onEvent = (event: string) => events.push(event);
    ctx.repository.chatViewModelRepository.setInput('привет');

    await ctx.agentChatService.onPromptSubmit();
    ctx.agentSocketState.handlers?.onClosed('timeout');
    await settled();

    const messages = ctx.repository.chatViewModelRepository.messages();
    expect(messages[messages.length - 1]).toMatchObject({
        kind: 'error',
        reason: 'timeout',
    });
    expect(events).toContain(Events.EVENT_AGENT_TIMEOUT);
    expect(events).toContain(Events.EVENT_AGENT_STARTED);
    expect(Sentry.captureException).toHaveBeenCalled();
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

/**
 * Лимит для незарегистрированных вошедшему приходить не должен, а если сервер
 * его всё-таки прислал, окном входа делу не поможешь: человек уже вошёл
 */
test('unauthorized-limit-does-not-open-login-for-an-authorized-user', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('сделай');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'UnauthorizedLimitExceeded',
    });

    expect(ctx.repository.authViewModelRepository.currentView()).toBe('closed');
    // молчать тут нельзя: нарушение контракта иначе не видно ниоткуда
    expect(Sentry.captureException).toHaveBeenCalled();
});

test('unauthorized-limit-does-not-report-a-guest', async () => {
    const ctx = setup(false);
    ctx.repository.chatViewModelRepository.setInput('сделай');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'UnauthorizedLimitExceeded',
    });

    // гостевой лимит это штатный отказ, в Sentry ему делать нечего
    expect(ctx.repository.authViewModelRepository.currentView()).toBe('login');
    expect(Sentry.captureException).not.toHaveBeenCalled();
});

/**
 * Под ошибкой гостю предлагают войти, а вход открывает проект заново и чистит
 * ленту. Запрос переживает это только в поле ввода, туда его и возвращаем
 */
test('agent-error-returns-the-prompt-to-a-guest', async () => {
    const ctx = setup(false);
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'UnknownError',
    });

    expect(ctx.repository.chatViewModelRepository.input()).toBe(
        'сделай таблицу'
    );
    // вход чистит ленту, и набранное должно остаться в поле после этого тоже
    ctx.agentChatService.onProjectChanged();
    expect(ctx.repository.chatViewModelRepository.input()).toBe(
        'сделай таблицу'
    );
});

test('agent-error-leaves-the-field-empty-for-an-authorized-user', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');

    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'UnknownError',
    });

    // вошедшему возвращать нечего: лента никуда не денется, запрос виден в ней
    expect(ctx.repository.chatViewModelRepository.input()).toBe('');
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

test('unauthorized-redo-returns-agent-result-and-later-edit', async () => {
    const ctx = setup(false);
    const { programEditorService } = ctx;
    const text = () =>
        ctx.repository.projectViewModelRepository.currentProgram().segments[0]
            ?.text;
    programEditorService.onAddSegmentClicked('md');
    await programEditorService.onSegmentTextEdited(0, 'mine', 4);
    await programEditorService.onProgramSaveTimeout();
    ctx.repository.chatViewModelRepository.setInput('сделай');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
        program: {
            segments: [
                { type: 'md', parameters: { visible: true }, text: 'LLM' },
            ],
            parameters: { roundStrategy: 'noRound' },
        },
        hunks: [],
    });
    await programEditorService.onProgramSaveTimeout();
    await programEditorService.onSegmentTextEdited(0, 'LLM!', 4);
    await programEditorService.onProgramSaveTimeout();

    // у гостя ответ агента откатывается только через undo, значит и повтор должен его вернуть
    await programEditorService.onPrevVersionButtonClicked();
    await programEditorService.onPrevVersionButtonClicked();
    expect(text()).toBe('mine');
    await programEditorService.onNextVersionButtonClicked();
    expect(text()).toBe('LLM');
    await programEditorService.onNextVersionButtonClicked();
    expect(text()).toBe('LLM!');
});

test('unauthorized-redo-through-two-agent-replies-keeps-each-step', async () => {
    const ctx = setup(false);
    const { programEditorService } = ctx;
    const texts = () =>
        ctx.repository.projectViewModelRepository
            .currentProgram()
            .segments.map((segment) => segment.text);
    const agentReply = async (replyTexts: string[]) => {
        ctx.repository.chatViewModelRepository.setInput('сделай');
        await ctx.agentChatService.onPromptSubmit();
        await emit(ctx, {
            kind: 'finished',
            message: 'готово',
            stopReason: 'Done',
            program: {
                segments: replyTexts.map((text) => ({
                    type: 'md',
                    parameters: { visible: true },
                    text,
                })),
                parameters: { roundStrategy: 'noRound' },
            },
            hunks: [],
        });
        await programEditorService.onProgramSaveTimeout();
    };
    const step = async (kind: 'undo' | 'redo') => {
        if (kind === 'undo') {
            await programEditorService.onPrevVersionButtonClicked();
        } else {
            await programEditorService.onNextVersionButtonClicked();
        }
        await programEditorService.onProgramSaveTimeout();
        return texts();
    };
    programEditorService.onAddSegmentClicked('md');
    await programEditorService.onSegmentTextEdited(0, 'mine', 4);
    await programEditorService.onProgramSaveTimeout();
    await agentReply(['A', 'B']);
    await programEditorService.deleteSegment(1);
    await agentReply(['C']);

    // удаление между ответами правит сегменты первого ответа, и повтор первого ответа должен их не видеть
    const kinds: ('undo' | 'redo')[] = [
        'undo',
        'undo',
        'undo',
        'redo',
        'redo',
        'redo',
        'undo',
        'undo',
        'undo',
    ];
    const trail: string[][] = [];
    for (const kind of kinds) {
        trail.push(await step(kind));
    }

    expect(trail).toEqual([
        ['A'],
        ['A', 'B'],
        ['mine'],
        ['A', 'B'],
        ['A'],
        ['C'],
        ['A'],
        ['A', 'B'],
        ['mine'],
    ]);
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

// сборку агент запускает посреди прогона: после неё он ещё думает и правит
test('compilation-events-do-not-end-the-run', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('собери документ');
    await ctx.agentChatService.onPromptSubmit();

    const frames: AgentEvent[] = [
        { kind: 'compilationStarted' },
        {
            kind: 'compilationFinished',
            pdfUri: 'https://files.labkeeper.io/generated/result1.pdf',
            markdown: undefined,
        },
        {
            kind: 'compilationFailed',
            errors: { errors: [], unfinishedPdfUri: undefined },
        },
    ];
    for (const frame of frames) {
        await emit(ctx, frame);
        // после каждого кадра, иначе прогон, закрытый вторым кадром и снова открытый третьим, прошёл бы
        expect({
            frame: frame.kind,
            state: ctx.repository.chatViewModelRepository.requestState(),
            running: ctx.agentChatService.isRunning(),
            responses: ctx.repository.chatViewModelRepository
                .messages()
                .filter((message) => message.kind === 'response').length,
        }).toEqual({
            frame: frame.kind,
            state: 'running',
            running: true,
            responses: 0,
        });
    }

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
});

test('prompt-too-long-returns-the-text-to-the-field', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('очень длинный запрос');
    await ctx.agentChatService.onPromptSubmit();
    expect(ctx.repository.chatViewModelRepository.input()).toBe('');

    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'PromptTooLong',
    });

    // сокращать текст человеку удобнее там, где он его писал
    expect(ctx.repository.chatViewModelRepository.input()).toBe(
        'очень длинный запрос'
    );
});

test('prompt-too-long-for-a-guest-does-not-replace-program', async () => {
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
        stopReason: 'PromptTooLong',
        program: {
            segments: [{ type: 'md', parameters: {}, text: 'LLM GENERATED' }],
            parameters: { roundStrategy: 'noRound' },
        },
        hunks: [],
    });

    const program = ctx.repository.projectViewModelRepository.currentProgram();
    expect(program.segments[0].text).toBe('ORIGINAL');
});

test('quota-exceeded-for-a-guest-keeps-what-was-done', async () => {
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
        stopReason: 'QuotaExceeded',
        program: {
            segments: [{ type: 'md', parameters: {}, text: 'ДО ЛИМИТА' }],
            parameters: { roundStrategy: 'noRound' },
        },
        hunks: [],
    });

    // упор в лимит на одном шаге не отменяет шаги до него
    const program = ctx.repository.projectViewModelRepository.currentProgram();
    expect(program.segments[0].text).toBe('ДО ЛИМИТА');
});

test('stop-reason-prompt-too-long-tracks-agent-failed', async () => {
    const ctx = setup();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'PromptTooLong',
    });

    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_AGENT_FAILED,
        expect.objectContaining({ reason: 'PromptTooLong' })
    );
    expect(Sentry.captureException).not.toHaveBeenCalled();
});

test.each([['PromptTooLong'], ['QuotaExceeded']] as const)(
    'stop-reason-%s-is-not-reported-as-a-failure',
    async (stopReason) => {
        const ctx = setup();
        ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
        await ctx.agentChatService.onPromptSubmit();

        await emit(ctx, { kind: 'finished', message: null, stopReason });

        // это ограничения, о которых сказали человеку, а не сбой для разбора
        expect(Sentry.captureException).not.toHaveBeenCalled();
    }
);

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
    expect(events).toContain(Events.EVENT_AGENT_FAILED);
});

test('stop-reason-locked-reports-unknown-rpi-event', async () => {
    const ctx = setup();
    const events: string[] = [];
    ctx.observerService.onEvent = (event: string) => events.push(event);
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'Locked',
    });

    expect(events).toContain(Events.EVENT_RPI_UNKNOWN);
    expect(Sentry.captureException).toHaveBeenCalled();
});

test.each([
    ['authorized', true],
    ['guest', false],
] as const)(
    'stop-reason-locked-sends-one-project-locked-event-for-%s',
    async (_who, authenticated) => {
        const ctx = setup(authenticated);
        const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
        ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
        await ctx.agentChatService.onPromptSubmit();

        await emit(ctx, {
            kind: 'finished',
            message: null,
            stopReason: 'Locked',
        });

        const locked = onEvent.mock.calls.filter(
            ([event]) => event === Events.EVENT_PROJECT_LOCKED
        );
        expect(locked).toHaveLength(1);
        expect(locked[0][1]).toMatchObject({
            source: 'agent',
            operation: 'agent_run',
            expected: true,
            project_id: PROJECT_ID,
        });
    }
);

test.each(AGENT_STOP_REASONS.filter((reason) => reason !== 'Locked'))(
    'stop-reason-%s-does-not-send-project-locked-event',
    async (stopReason) => {
        const ctx = setup();
        const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
        ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
        await ctx.agentChatService.onPromptSubmit();

        await emit(ctx, { kind: 'finished', message: null, stopReason });

        // финал разобран до конца, иначе отсутствие события ничего не значит
        expect(['ok', 'error']).toContain(
            ctx.repository.chatViewModelRepository.requestState()
        );
        expect(onEvent).not.toHaveBeenCalledWith(
            Events.EVENT_PROJECT_LOCKED,
            expect.anything()
        );
    }
);

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

/**
 * Повторную правку того же места сервер дописывает в прежний hunk и id не
 * меняет, поэтому новых hunks после неё нет, а текст на сервере уже другой
 */

const oneSegment = (text: string): Program => ({
    segments: [{ id: 1, type: 'md', text, parameters: { visible: true } }],
    parameters: { roundStrategy: 'noRound' },
});

const addedLines = (endLine: number, text: string): Hunk => ({
    id: 'same',
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 2,
    endLine,
    text,
});

function answerInTurn(hunks: Hunk[][], texts: string[]) {
    return {
        hunks: hunks.reduce(
            (mock, list) =>
                mock.mockResolvedValueOnce(okResult({ hunks: list })),
            jest.fn()
        ),
        project: texts.reduce(
            (mock, text) =>
                mock.mockResolvedValueOnce(
                    okResult({ program: oneSegment(text) })
                ),
            jest.fn()
        ),
    };
}

const segmentText = (ctx: ReturnType<typeof setup>) =>
    ctx.repository.projectViewModelRepository.currentProgram().segments[0]
        ?.text;

const events = (ctx: ReturnType<typeof setup>) =>
    ctx.repository.chatViewModelRepository
        .messages()
        .filter((message) => message.kind === 'event');

test('tool-call-reloads-the-program-when-the-same-hunk-grows', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('добавь две строки');
    await ctx.agentChatService.onPromptSubmit();
    const server = answerInTurn(
        [[addedLines(2, 'X')], [addedLines(3, 'X\nY')]],
        ['a\nX', 'a\nX\nY']
    );
    ctx.rpi.listHunksRequest = server.hunks;
    ctx.rpi.getProjectRequest = server.project;

    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });

    expect(segmentText(ctx)).toBe('a\nX\nY');
    // вторая строка ленты тоже знает, где правка
    expect(events(ctx)[1]).toMatchObject({
        labelKey: 'add_lines_to_segment',
        segmentId: 1,
        lines: '#L2-3',
    });
});

test('tool-call-reloads-the-program-when-the-agent-removes-its-own-lines', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('добавь и убери строку');
    await ctx.agentChatService.onPromptSubmit();
    // удалив всё, что добавил, агент убирает и сам hunk
    const server = answerInTurn([[addedLines(2, 'X')], []], ['a\nX', 'a']);
    ctx.rpi.listHunksRequest = server.hunks;
    ctx.rpi.getProjectRequest = server.project;

    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, {
        kind: 'toolCall',
        toolName: 'delete_lines_from_segment',
    });

    expect(segmentText(ctx)).toBe('a');
    expect(events(ctx)[1]).toMatchObject({
        labelKey: 'delete_lines_from_segment_plain',
    });
});

test('tool-call-reloads-the-program-for-a-hunk-left-from-a-previous-run', async () => {
    const ctx = setup();
    ctx.repository.ideViewModelRepository.setHunks([addedLines(2, 'X')]);
    ctx.repository.chatViewModelRepository.setInput('добавь ещё строку');
    await ctx.agentChatService.onPromptSubmit();
    const server = answerInTurn([[addedLines(3, 'X\nY')]], ['a\nX\nY']);
    ctx.rpi.listHunksRequest = server.hunks;
    ctx.rpi.getProjectRequest = server.project;

    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });

    expect(segmentText(ctx)).toBe('a\nX\nY');
    expect(events(ctx)[0]).toMatchObject({ segmentId: 1, lines: '#L2-3' });
});

test('tool-call-reloads-the-files-when-the-same-file-hunk-grows', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('допиши файл');
    await ctx.agentChatService.onPromptSubmit();
    const fileLines = (endLine: number, text: string): Hunk => ({
        id: 'same',
        type: 'addLinesToFile',
        fileName: 'notes.txt',
        startLine: 1,
        endLine,
        text,
    });
    ctx.rpi.listHunksRequest = answerInTurn(
        [[fileLines(1, 'A')], [fileLines(2, 'A\nB')]],
        []
    ).hunks;
    ctx.rpi.getProjectRequest = jest.fn();

    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_file' });
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_file' });

    expect(ctx.rpi.listFilesRequest).toHaveBeenCalledTimes(2);
    expect(ctx.rpi.getProjectRequest).not.toHaveBeenCalled();
});

/**
 * Не вышло перечитать или сокет оборвался: редактор мог разойтись с сервером,
 * и следующее сохранение записало бы старый текст поверх правки агента
 */

const failedResult = {
    code: 502,
    body: undefined,
    isOk: false,
    isUnauth: false,
    isForbidden: false,
};

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

function pending<T>() {
    let resolve: (value: T) => void = () => {};
    const promise = new Promise<T>((done) => (resolve = done));
    return { promise, resolve };
}

async function submitAndFailReload(ctx: ReturnType<typeof setup>) {
    ctx.repository.chatViewModelRepository.setInput('добавь строку');
    await ctx.agentChatService.onPromptSubmit();
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [addedLines(2, 'X')] }));
    ctx.rpi.getProjectRequest = jest.fn().mockResolvedValue(failedResult);
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
}

const savedTexts = (ctx: ReturnType<typeof setup>) =>
    (ctx.rpi.saveProgramRequest as jest.Mock).mock.calls.map(
        ([, program]) => (program as Program).segments[0]?.text
    );

test('failed-reload-is-retried-when-the-run-ends', async () => {
    const ctx = setup();
    await submitAndFailReload(ctx);
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockResolvedValue(okResult({ program: oneSegment('a\nX') }));

    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    expect(segmentText(ctx)).toBe('a\nX');
});

test('successful-resync-is-not-repeated-by-the-next-request', async () => {
    const ctx = setup();
    await submitAndFailReload(ctx);
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockResolvedValue(okResult({ program: oneSegment('a\nX') }));
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });
    (ctx.rpi.getProjectRequest as jest.Mock).mockClear();

    ctx.repository.chatViewModelRepository.setInput('ещё');
    await ctx.agentChatService.onPromptSubmit();

    expect(ctx.rpi.getProjectRequest).not.toHaveBeenCalled();
});

test('failed-reload-is-retried-when-the-run-ends-with-an-error', async () => {
    const ctx = setup();
    await submitAndFailReload(ctx);
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockResolvedValue(okResult({ program: oneSegment('a\nX') }));

    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'UnknownError',
    });

    expect(segmentText(ctx)).toBe('a\nX');
});

test('run-stays-locked-until-the-program-is-resynced', async () => {
    const ctx = setup();
    await submitAndFailReload(ctx);
    const server = pending<unknown>();
    ctx.rpi.getProjectRequest = jest.fn().mockReturnValue(server.promise);

    const finished = emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });
    await settled();

    // пока старая программа в редакторе, человек не должен её править
    expect(ctx.agentChatService.isRunning()).toBe(true);
    server.resolve(okResult({ program: oneSegment('a\nX') }));
    await finished;
    expect(ctx.agentChatService.isRunning()).toBe(false);
});

test('dropped-connection-resyncs-the-program-before-unlocking', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('добавь строку');
    await ctx.agentChatService.onPromptSubmit();
    const server = pending<unknown>();
    ctx.rpi.getProjectRequest = jest.fn().mockReturnValue(server.promise);

    // события после обрыва выбрасываются, и правка агента могла остаться в очереди
    ctx.agentSocketState.handlers?.onClosed('closed');
    await settled();
    expect(ctx.agentChatService.isRunning()).toBe(true);

    server.resolve(okResult({ program: oneSegment('a\nX') }));
    await settled();
    expect(segmentText(ctx)).toBe('a\nX');
    expect(ctx.agentChatService.isRunning()).toBe(false);
});

test('connection-that-never-opened-does-not-resync', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('добавь строку');
    await ctx.agentChatService.onPromptSubmit();
    ctx.rpi.getProjectRequest = jest.fn();

    ctx.agentSocketState.handlers?.onClosed('connect_failed');
    await settled();

    expect(ctx.rpi.getProjectRequest).not.toHaveBeenCalled();
});

test('guest-connection-drop-does-not-resync', async () => {
    const ctx = setup(false);
    ctx.repository.chatViewModelRepository.setInput('добавь строку');
    await ctx.agentChatService.onPromptSubmit();
    ctx.rpi.getProjectRequest = jest.fn();

    ctx.agentSocketState.handlers?.onClosed('closed');
    await settled();

    expect(ctx.rpi.getProjectRequest).not.toHaveBeenCalled();
});

test('next-request-resyncs-before-saving', async () => {
    const ctx = setup();
    await submitAndFailReload(ctx);
    // и в конце прогона сверить не вышло
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockResolvedValue(okResult({ program: oneSegment('a\nX') }));
    (ctx.rpi.saveProgramRequest as jest.Mock).mockClear();

    ctx.repository.chatViewModelRepository.setInput('ещё');
    await ctx.agentChatService.onPromptSubmit();

    expect(savedTexts(ctx)).toEqual(['a\nX']);
});

test('next-request-does-not-start-over-a-stale-program', async () => {
    const ctx = setup();
    await submitAndFailReload(ctx);
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });
    (ctx.rpi.saveProgramRequest as jest.Mock).mockClear();
    ctx.agentSocketState.started = null;

    ctx.repository.chatViewModelRepository.setInput('ещё');
    await ctx.agentChatService.onPromptSubmit();

    expect(ctx.rpi.saveProgramRequest).not.toHaveBeenCalled();
    expect(ctx.agentSocketState.started).toBeNull();
    const messages = ctx.repository.chatViewModelRepository.messages();
    // своя причина: дело не в сохранении, а в том, что программа не сверена
    expect(messages[messages.length - 1]).toMatchObject({
        kind: 'error',
        reason: 'sync_failed',
    });
});

test('project-change-forgets-a-stale-program', async () => {
    const ctx = setup();
    await submitAndFailReload(ctx);
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    ctx.agentChatService.onProjectChanged();
    ctx.rpi.getProjectRequest = jest.fn();
    ctx.repository.chatViewModelRepository.setInput('в новом проекте');
    await ctx.agentChatService.onPromptSubmit();

    expect(ctx.rpi.getProjectRequest).not.toHaveBeenCalled();
    expect(ctx.agentSocketState.started).toMatchObject({
        prompt: 'в новом проекте',
    });
});

test('late-reload-after-a-drop-keeps-what-the-user-typed', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('добавь строку');
    await ctx.agentChatService.onPromptSubmit();
    ctx.rpi.listHunksRequest = answerInTurn([[addedLines(2, 'X')]], []).hunks;
    const late = pending<unknown>();
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockReturnValueOnce(late.promise)
        .mockResolvedValueOnce(okResult({ program: oneSegment('a\nX') }));

    const toolCall = emit(ctx, {
        kind: 'toolCall',
        toolName: 'add_lines_to_segment',
    });
    await settled();
    ctx.agentSocketState.handlers?.onClosed('closed');
    await settled();
    // сверка прошла, замок снят, и человек начал печатать
    ctx.repository.projectViewModelRepository.setCurrentProgram(
        oneSegment('мой текст')
    );
    ctx.repository.ideViewModelRepository.markProgramChanged();
    late.resolve(okResult({ program: oneSegment('a\nX') }));
    await toolCall;

    expect(segmentText(ctx)).toBe('мой текст');
});

test('reload-answer-for-a-left-project-is-dropped', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('добавь строку');
    await ctx.agentChatService.onPromptSubmit();
    ctx.rpi.listHunksRequest = answerInTurn([[addedLines(2, 'X')]], []).hunks;
    const server = pending<unknown>();
    ctx.rpi.getProjectRequest = jest.fn().mockReturnValue(server.promise);

    const toolCall = emit(ctx, {
        kind: 'toolCall',
        toolName: 'add_lines_to_segment',
    });
    await settled();
    // человек ушёл в другой проект, пока ехала программа прошлого
    ctx.agentChatService.onProjectChanged();
    ctx.repository.projectViewModelRepository.setCurrentProgram(
        oneSegment('проект B')
    );
    server.resolve(okResult({ program: oneSegment('проект A') }));
    await toolCall;
    await settled();

    expect(segmentText(ctx)).toBe('проект B');
    expect(
        ctx.repository.ideViewModelRepository.editorNavigationTarget()
    ).toBeFalsy();
});

/** Инструмент, которого фронт ещё не знает: сервер добавляет их раньше, чем обновится фронт, и такой инструмент может писать, не оставив понятных hunks */

const NEW_TOOL = 'replace_in_segment';

async function runNewTool(ctx: ReturnType<typeof setup>, serverText: string) {
    ctx.repository.chatViewModelRepository.setInput('перепиши сегмент');
    await ctx.agentChatService.onPromptSubmit();
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockResolvedValue(okResult({ program: oneSegment(serverText) }));
    (ctx.rpi.listFilesRequest as jest.Mock).mockClear();
    await emit(ctx, { kind: 'toolCall', toolName: NEW_TOOL });
}

test('unknown-tool-call-brings-its-edit-into-the-editor', async () => {
    const ctx = setup();

    await runNewTool(ctx, 'текст агента');

    expect(segmentText(ctx)).toBe('текст агента');
    // файлы он мог поменять так же молча
    expect(ctx.rpi.listFilesRequest).toHaveBeenCalledTimes(1);
    expect(events(ctx)).toEqual([
        expect.objectContaining({ labelKey: 'unknown_tool' }),
    ]);
});

test('next-request-after-an-unknown-tool-does-not-overwrite-its-edit', async () => {
    const ctx = setup();
    await runNewTool(ctx, 'текст агента');
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });
    (ctx.rpi.saveProgramRequest as jest.Mock).mockClear();

    ctx.repository.chatViewModelRepository.setInput('ещё');
    await ctx.agentChatService.onPromptSubmit();

    // запрос сохраняет программу целиком, старая затёрла бы текст агента на сервере
    expect(savedTexts(ctx)).toEqual(['текст агента']);
});

test('unknown-tool-call-of-a-guest-gives-the-common-line-without-requests', async () => {
    const ctx = setup(false);
    ctx.repository.chatViewModelRepository.setInput('перепиши сегмент');
    await ctx.agentChatService.onPromptSubmit();

    await emit(ctx, { kind: 'toolCall', toolName: NEW_TOOL });

    expect(events(ctx)).toEqual([
        expect.objectContaining({ labelKey: 'unknown_tool' }),
    ]);
    // гостю программа с правками приезжает в финале, с сервера читать нечего
    expect(ctx.rpi.getProjectRequest).not.toHaveBeenCalled();
    expect(ctx.rpi.listFilesRequest).not.toHaveBeenCalled();
});

/** Открыт текстовый файл, а незнакомый инструмент может его удалить или переименовать */
function withOpenFile(ctx: ReturnType<typeof setup>) {
    ctx.repository.projectViewModelRepository.setFiles([
        { autogenerated: false, fileName: FILE_NAME, url: FILE_URL },
    ]);
    ctx.repository.ideViewModelRepository.setActiveTextFile(FILE_NAME);
    ctx.repository.ideViewModelRepository.setTextFileContent('старый текст');
    ctx.repository.ideViewModelRepository.setLoadTextFileRequestState('ok');
    ctx.rpi.uploadFileRequest = jest.fn().mockResolvedValue(okResult({}));
    global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => 'старый текст',
    });
}

async function runFileTool(
    ctx: ReturnType<typeof setup>,
    files: { fileName: string; url: string }[],
    hunks: Hunk[] = []
) {
    ctx.repository.chatViewModelRepository.setInput('убери файл');
    await ctx.agentChatService.onPromptSubmit();
    ctx.rpi.listFilesRequest = jest.fn().mockResolvedValue(
        okResult({
            files: files.map((file) => ({ autogenerated: false, ...file })),
        })
    );
    ctx.rpi.listHunksRequest = jest.fn().mockResolvedValue(okResult({ hunks }));
    // файла на сервере больше нет
    global.fetch = jest.fn().mockResolvedValue({
        ok: files.length > 0,
        status: files.length > 0 ? 200 : 404,
        text: async () => 'старый текст',
    });
    await emit(ctx, { kind: 'toolCall', toolName: 'delete_file' });
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });
}

test('open-file-removed-by-an-unknown-tool-is-closed', async () => {
    const ctx = setup();
    withOpenFile(ctx);

    await runFileTool(ctx, []);
    (ctx.rpi.uploadFileRequest as jest.Mock).mockClear();
    ctx.repository.chatViewModelRepository.setInput('ещё');
    await ctx.agentChatService.onPromptSubmit();

    expect(ctx.repository.ideViewModelRepository.activeTextFile()).toBeNull();
    // открытым он ушёл бы на сервер со следующим запросом и ожил бы там
    expect(ctx.rpi.uploadFileRequest).not.toHaveBeenCalled();
});

test('open-file-that-survives-an-unknown-tool-stays-open', async () => {
    const ctx = setup();
    withOpenFile(ctx);

    await runFileTool(ctx, [{ fileName: FILE_NAME, url: FILE_URL }]);

    expect(ctx.repository.ideViewModelRepository.activeTextFile()).toBe(
        FILE_NAME
    );
});

test('open-file-known-only-from-hunks-stays-open', async () => {
    const ctx = setup();
    withOpenFile(ctx);

    // файл, который агент создал, может быть виден только по hunks
    await runFileTool(
        ctx,
        [],
        [{ id: 'a', type: 'addFile', fileName: FILE_NAME }]
    );

    expect(ctx.repository.ideViewModelRepository.activeTextFile()).toBe(
        FILE_NAME
    );
});

/**
 * На телефоне чат и редактор это разные экраны. После прогона агента телефон
 * открывает редактор там, где агент правил последним
 */

const threeSegments = {
    segments: [
        {
            id: 1,
            type: 'md',
            text: 'a\nb\nc\nd\ne\nf\ng',
            parameters: { visible: true },
        },
        { id: 2, type: 'md', text: 'a\nb\nc', parameters: { visible: true } },
        {
            id: 3,
            type: 'md',
            text: 'a\nb\nc\nd\ne',
            parameters: { visible: true },
        },
    ],
    parameters: { roundStrategy: 'noRound' as const },
} as Program;

const segmentHunk = (
    id: string,
    segmentId: number,
    startLine: number
): Hunk => ({
    id,
    type: 'addLinesToSegment',
    segmentId,
    startLine,
    endLine: startLine,
});

function phoneSetup(authenticated = true) {
    const ctx = setup(authenticated);
    ctx.repository.projectViewModelRepository.setCurrentProgram(threeSegments);
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockResolvedValue(okResult({ program: threeSegments }));
    ctx.repository.settingsViewModelRepository.setMobileView = jest.fn();
    return ctx;
}

const openedEditorAt = (ctx: ReturnType<typeof phoneSetup>) => ({
    view: (
        ctx.repository.settingsViewModelRepository.setMobileView as jest.Mock
    ).mock.calls,
    target: ctx.repository.ideViewModelRepository.editorNavigationTarget(),
});

test('finished-run-on-a-phone-opens-the-last-change', async () => {
    const ctx = phoneSetup();
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValueOnce(okResult({ hunks: [segmentHunk('a', 2, 1)] }))
        .mockResolvedValueOnce(
            okResult({
                hunks: [
                    segmentHunk('a', 2, 1),
                    segmentHunk('b', 3, 4),
                    segmentHunk('c', 1, 7),
                ],
            })
        );
    ctx.repository.chatViewModelRepository.setInput('сделай');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    await ctx.agentChatService.onAgentFinishedOnPhone();

    // последняя правка это сегмент 1, а не первая из последней пачки
    expect(openedEditorAt(ctx)).toEqual({
        view: [['editor']],
        target: { segmentIndex: 0, line: 7, focus: false },
    });
});

test('finished-guest-run-on-a-phone-opens-the-last-change', async () => {
    const ctx = phoneSetup(false);
    ctx.repository.chatViewModelRepository.setInput('сделай');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
        program: threeSegments,
        hunks: [segmentHunk('a', 1, 2), segmentHunk('b', 3, 5)],
    });

    await ctx.agentChatService.onAgentFinishedOnPhone();

    expect(openedEditorAt(ctx)).toEqual({
        view: [['editor']],
        target: { segmentIndex: 2, line: 5, focus: false },
    });
});

test('finished-run-without-changes-on-a-phone-stays-in-chat', async () => {
    const ctx = phoneSetup();
    ctx.repository.chatViewModelRepository.setInput('что тут написано');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'finished', message: 'ответ', stopReason: 'Done' });

    await ctx.agentChatService.onAgentFinishedOnPhone();

    // агент только ответил, человек читает ответ, уводить его некуда
    expect(openedEditorAt(ctx).view).toEqual([]);
});

test('failed-run-on-a-phone-stays-in-chat', async () => {
    const ctx = phoneSetup();
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [segmentHunk('a', 2, 1)] }));
    ctx.repository.chatViewModelRepository.setInput('сделай');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, {
        kind: 'finished',
        message: null,
        stopReason: 'UnknownError',
    });

    await ctx.agentChatService.onAgentFinishedOnPhone();

    // ошибка написана в чате, её надо прочитать там
    expect(openedEditorAt(ctx).view).toEqual([]);
});

test('next-run-forgets-the-previous-change', async () => {
    const ctx = phoneSetup();
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [segmentHunk('a', 2, 1)] }));
    ctx.repository.chatViewModelRepository.setInput('сделай');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    ctx.repository.chatViewModelRepository.setInput('а что получилось');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'finished', message: 'ответ', stopReason: 'Done' });
    await ctx.agentChatService.onAgentFinishedOnPhone();

    expect(openedEditorAt(ctx).view).toEqual([]);
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

// финал гостя с препрода 28.09: замена приходит одним hunk вместе с программой
test('guest-replace-from-the-final-frame-is-stored-and-shown-in-the-editor', async () => {
    const ctx = setup(false);
    ctx.repository.projectViewModelRepository.setCurrentProgram(threeSegments);
    const replace = {
        id: 'replace',
        type: 'replaceTextInSegment',
        fileName: null,
        segmentId: 1,
        startLine: 3,
        endLine: 3,
        text: 'Alpha line one.',
    } as unknown as Hunk;
    ctx.repository.chatViewModelRepository.setInput('замени строку');
    await ctx.agentChatService.onPromptSubmit();

    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
        program: threeSegments,
        hunks: [replace],
    });

    expect(ctx.repository.ideViewModelRepository.hunks()).toEqual([replace]);
    // новые строки на месте, редактор ведём к ним
    expect(
        ctx.repository.ideViewModelRepository.editorNavigationTarget()
    ).toEqual({ segmentIndex: 0, line: 3, focus: false });
});

/**
 * Согласие на трансграничную передачу данных в DeepSeek.
 * Пока оно не дано, запрос не должен уходить ни у вошедшего, ни у гостя
 */

const okEmpty = () => ({
    code: 200,
    body: undefined,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
});

const consentModalShown = (ctx: ReturnType<typeof setup>) =>
    (ctx.repository as MockViewModelRepository).mockState()
        .showCrossBorderConsentModal;

function setupWithoutConsent(authenticated = true) {
    const ctx = setup(authenticated);
    ctx.repository.persistenceViewModelRepository.setCrossBorderConsentAcceptedLocally(
        false
    );
    ctx.repository.userViewModelRepository.setUserInfo({
        isAuthenticated: authenticated,
        email: 'a@gmail.com',
        id: USER_ID,
        privacyPolicyAccepted: true,
        crossBorderDataTransferPolicyAccepted: false,
        tokenBalance: 10,
    });
    ctx.rpi.acceptCrossBorderDataTransferPolicyRequest = jest
        .fn()
        .mockResolvedValue(okEmpty());
    return ctx;
}

test('cross-border-consent-blocks-the-request', async () => {
    const ctx = setupWithoutConsent();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');

    await ctx.agentChatService.onPromptSubmit();

    expect(consentModalShown(ctx)).toBe(true);
    expect(ctx.agentSocketState.startCalls).toBe(0);
    // текст остаётся в поле, иначе после согласия отправлять будет нечего
    expect(ctx.repository.chatViewModelRepository.input()).toBe(
        'сделай таблицу'
    );
    expect(ctx.repository.chatViewModelRepository.messages()).toHaveLength(0);
});

test('cross-border-consent-accept-sends-the-same-request', async () => {
    const ctx = setupWithoutConsent();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    await ctx.agentChatService.onCrossBorderConsentAccepted();

    expect(consentModalShown(ctx)).toBe(false);
    expect(
        ctx.rpi.acceptCrossBorderDataTransferPolicyRequest
    ).toHaveBeenCalledTimes(1);
    expect(ctx.agentSocketState.started?.prompt).toBe('сделай таблицу');
});

test('cross-border-consent-dismiss-keeps-the-prompt', async () => {
    const ctx = setupWithoutConsent();
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    ctx.agentChatService.onCrossBorderConsentDismissed();

    expect(consentModalShown(ctx)).toBe(false);
    expect(ctx.agentSocketState.startCalls).toBe(0);
    expect(ctx.repository.chatViewModelRepository.input()).toBe(
        'сделай таблицу'
    );
});

test('cross-border-consent-is-asked-only-once', async () => {
    const ctx = setupWithoutConsent();
    ctx.repository.chatViewModelRepository.setInput('первый');
    await ctx.agentChatService.onPromptSubmit();
    await ctx.agentChatService.onCrossBorderConsentAccepted();
    ctx.agentSocketState.handlers?.onClosed('closed');
    await settled();

    ctx.repository.chatViewModelRepository.setInput('второй');
    await ctx.agentChatService.onPromptSubmit();

    expect(consentModalShown(ctx)).toBe(false);
    expect(ctx.agentSocketState.started?.prompt).toBe('второй');
});

test('cross-border-consent-of-a-guest-goes-to-local-storage-only', async () => {
    const ctx = setupWithoutConsent(false);
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    await ctx.agentChatService.onCrossBorderConsentAccepted();

    // гостю сервер согласие записать некуда, пока он не вошёл
    expect(
        ctx.rpi.acceptCrossBorderDataTransferPolicyRequest
    ).not.toHaveBeenCalled();
    expect(
        ctx.repository.persistenceViewModelRepository.crossBorderConsentAcceptedLocally()
    ).toBe(true);
    expect(ctx.agentSocketState.program).not.toBeNull();
});

test('cross-border-consent-accepted-on-the-server-is-not-asked-again', async () => {
    const ctx = setupWithoutConsent();
    ctx.repository.userViewModelRepository.setUserInfo({
        isAuthenticated: true,
        email: 'a@gmail.com',
        id: USER_ID,
        privacyPolicyAccepted: true,
        crossBorderDataTransferPolicyAccepted: true,
        tokenBalance: 10,
    });
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');

    await ctx.agentChatService.onPromptSubmit();

    expect(consentModalShown(ctx)).toBe(false);
    expect(ctx.agentSocketState.started?.prompt).toBe('сделай таблицу');
});

test('cross-border-consent-survives-a-failed-save', async () => {
    const ctx = setupWithoutConsent();
    ctx.rpi.acceptCrossBorderDataTransferPolicyRequest = jest
        .fn()
        .mockResolvedValue({
            code: 500,
            body: undefined,
            isOk: false,
            isUnauth: false,
            isForbidden: false,
        });
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    await ctx.agentChatService.onCrossBorderConsentAccepted();

    // сервер не записал, но человек согласился: запрос уходит, вопрос не повторяем
    expect(ctx.agentSocketState.started?.prompt).toBe('сделай таблицу');
    expect(
        ctx.repository.persistenceViewModelRepository.crossBorderConsentAcceptedLocally()
    ).toBe(true);
});

/**
 * Кнопка «отправить ошибки агенту» в панели ошибок: текст ошибок встаёт в поле
 * запроса, а чат открывается, если был закрыт
 */

const withCompileErrors = (ctx: ReturnType<typeof setup>) => {
    ctx.repository.projectViewModelRepository.setCompileErrorResult({
        errors: [
            {
                code: 301,
                payload: {
                    segmentId: 2,
                    line: 0,
                    position: 2,
                    variable: 'x',
                },
            } as never,
        ],
    });
    ctx.repository.settingsViewModelRepository.setViewerTab = jest.fn();
    ctx.repository.settingsViewModelRepository.setMobileView = jest.fn();
    return ctx;
};

const toasts = (ctx: ReturnType<typeof setup>) =>
    (ctx.repository as MockViewModelRepository).mockState().toasts;

test('send-errors-puts-them-into-an-empty-prompt-and-opens-the-chat', () => {
    const ctx = withCompileErrors(setup());

    ctx.agentChatService.onSendErrorsToAgent();

    expect(ctx.repository.chatViewModelRepository.input()).toBe(
        'Fix the compilation errors:\n- Segment №2, line 1.2: No such variable x'
    );
    expect(
        ctx.repository.settingsViewModelRepository.setViewerTab
    ).toHaveBeenCalledWith('chat');
    // на телефоне чат это отдельный экран, его тоже надо открыть
    expect(
        ctx.repository.settingsViewModelRepository.setMobileView
    ).toHaveBeenCalledWith('chat');
    // только подставляем текст, отправляет человек сам
    expect(ctx.agentSocketState.startCalls).toBe(0);
});

test('send-errors-does-not-touch-a-prompt-with-text', () => {
    const ctx = withCompileErrors(setup());
    ctx.repository.chatViewModelRepository.setInput('мой запрос');

    ctx.agentChatService.onSendErrorsToAgent();

    expect(ctx.repository.chatViewModelRepository.input()).toBe('мой запрос');
    expect(toasts(ctx)).toHaveLength(1);
    expect(
        ctx.repository.settingsViewModelRepository.setViewerTab
    ).not.toHaveBeenCalled();
});

test('send-errors-waits-for-a-running-agent', async () => {
    const ctx = withCompileErrors(setup());
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    await ctx.agentChatService.onPromptSubmit();

    ctx.agentChatService.onSendErrorsToAgent();

    // поле пустое, но заблокировано: текст ошибок поверх идущего прогона не кладём
    expect(ctx.repository.chatViewModelRepository.input()).toBe('');
    expect(toasts(ctx)).toHaveLength(1);
});

test('send-errors-without-errors-does-nothing', () => {
    const ctx = setup();
    ctx.repository.settingsViewModelRepository.setViewerTab = jest.fn();

    ctx.agentChatService.onSendErrorsToAgent();

    expect(ctx.repository.chatViewModelRepository.input()).toBe('');
    expect(
        ctx.repository.settingsViewModelRepository.setViewerTab
    ).not.toHaveBeenCalled();
});

test('send-errors-on-a-foreign-project-does-nothing', () => {
    const ctx = withCompileErrors(setup());
    ctx.repository.projectViewModelRepository.setReadOnly(true);

    ctx.agentChatService.onSendErrorsToAgent();

    // у чужого проекта чата нет, открывать нечего
    expect(ctx.repository.chatViewModelRepository.input()).toBe('');
    expect(
        ctx.repository.settingsViewModelRepository.setViewerTab
    ).not.toHaveBeenCalled();
});

/** Прогон, который уже идёт: сессия открыта, замок правок стоит */
async function runningAgent(
    ctx: ReturnType<typeof setup>,
    prompt = 'сделай таблицу'
) {
    ctx.repository.chatViewModelRepository.setInput(prompt);
    await ctx.agentChatService.onPromptSubmit();
}

const lastMessage = (ctx: ReturnType<typeof setup>) => {
    const list = ctx.repository.chatViewModelRepository.messages();
    return list[list.length - 1];
};

test('abort-closes-the-socket-and-unlocks-the-project', async () => {
    const ctx = setup();
    await runningAgent(ctx);
    expect(ctx.editingLockService.isLocked()).toBe(true);

    await ctx.agentChatService.onAbortClicked();

    // что close даёт код 1000, снимает таймер и не зовёт onClosed, уже доказано
    // в web/agentSocket.test.ts: close-stops-the-socket-and-the-timer-without-on-closed
    expect(ctx.agentSocketState.closeCalls).toBe(1);
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('idle');
    expect(ctx.editingLockService.isLocked()).toBe(false);
    // закрытие по своей воле обработчик разрыва не зовёт, ошибке взяться неоткуда
    expect(
        ctx.repository.chatViewModelRepository
            .messages()
            .some((message) => message.kind === 'error')
    ).toBe(false);
    expect(lastMessage(ctx)).toMatchObject({
        kind: 'notice',
        reason: 'aborted_nothing',
    });
});

test('abort-lists-the-places-the-agent-changed', async () => {
    const ctx = setup();
    await runningAgent(ctx);
    ctx.rpi.listHunksRequest = jest.fn().mockResolvedValue(
        okResult({
            hunks: [
                segmentHunk('h1', 3, 1),
                { id: 'h2', type: 'deleteLinesFromSegment', segmentId: 3 },
                { id: 'h3', type: 'addLinesToFile', fileName: 'main.tex' },
            ],
        })
    );
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });

    await ctx.agentChatService.onAbortClicked();

    // список считается от снимка на старте прогона, а не от последнего toolCall
    expect(lastMessage(ctx)).toMatchObject({
        kind: 'notice',
        reason: 'aborted',
        changes: [
            { labelKey: 'segment', segmentId: 3 },
            { labelKey: 'file', file: 'main.tex' },
        ],
    });
});

test('abort-picks-up-what-the-last-tool-call-changed', async () => {
    const ctx = setup();
    await runningAgent(ctx);
    // на toolCall список ещё пуст, правка доезжает только к прерыванию
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValueOnce(okResult({ hunks: [] }))
        .mockResolvedValue(okResult({ hunks: [segmentHunk('h1', 7, 1)] }));
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });

    await ctx.agentChatService.onAbortClicked();

    expect(lastMessage(ctx)).toMatchObject({
        reason: 'aborted',
        changes: [{ labelKey: 'segment', segmentId: 7 }],
    });
});

test('abort-of-a-guest-run-says-the-result-is-lost', async () => {
    const ctx = setup(false);
    await runningAgent(ctx);
    ctx.rpi.listHunksRequest = jest.fn();
    ctx.rpi.getProjectRequest = jest.fn();

    await ctx.agentChatService.onAbortClicked();

    expect(lastMessage(ctx)).toMatchObject({
        kind: 'notice',
        reason: 'aborted_guest',
    });
    // у гостя правки приезжают в финале, тянуть с сервера нечего
    expect(ctx.rpi.listHunksRequest).not.toHaveBeenCalled();
    expect(ctx.rpi.getProjectRequest).not.toHaveBeenCalled();
});

test.each([['getProjectRequest'], ['listHunksRequest']] as const)(
    'abort-does-not-invent-a-list-when-%s-fails',
    async (request) => {
        const ctx = setup();
        await runningAgent(ctx);
        ctx.repository.ideViewModelRepository.setHunks([
            segmentHunk('h1', 3, 1),
        ]);
        ctx.rpi[request] = jest.fn().mockResolvedValue(failedResult);

        await ctx.agentChatService.onAbortClicked();

        expect(lastMessage(ctx)).toMatchObject({
            kind: 'notice',
            reason: 'aborted_unsynced',
        });
        expect(ctx.repository.chatViewModelRepository.requestState()).toBe(
            'idle'
        );
    }
);

test('abort-keeps-the-answer-that-already-arrived', async () => {
    const ctx = setup();
    await submitAndFailReload(ctx);
    const server = pending<unknown>();
    ctx.rpi.getProjectRequest = jest.fn().mockReturnValue(server.promise);

    const finishing = emit(ctx, {
        kind: 'finished',
        message: 'ответ модели',
        stopReason: 'Done',
    });
    await settled();
    // финал уже разбирается, а состояние ещё 'running' и кнопка прерывания на экране
    await ctx.agentChatService.onAbortClicked();
    server.resolve(okResult({ program: oneSegment('a\nX') }));
    await finishing;

    expect(ctx.agentSocketState.closeCalls).toBe(0);
    expect(lastMessage(ctx)).toMatchObject({
        kind: 'response',
        text: 'ответ модели',
    });
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('ok');
});

test('events-and-a-drop-after-abort-do-not-reach-the-chat', async () => {
    const ctx = setup();
    await runningAgent(ctx);
    const handlers = ctx.agentSocketState.handlers;

    await ctx.agentChatService.onAbortClicked();
    const shown = ctx.repository.chatViewModelRepository.messages().length;
    await handlers?.onEvent({
        kind: 'finished',
        message: 'опоздавший ответ',
        stopReason: 'Done',
    });
    handlers?.onClosed('closed');
    await settled();

    expect(ctx.repository.chatViewModelRepository.messages()).toHaveLength(
        shown
    );
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('idle');
});

test('abort-does-not-revert-what-the-agent-already-applied', async () => {
    const ctx = setup();
    ctx.rpi.deleteHunkRequest = jest.fn();
    await runningAgent(ctx);
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [segmentHunk('h1', 3, 1)] }));
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });

    await ctx.agentChatService.onAbortClicked();

    // прерывание останавливает агента, а не отменяет сделанное им
    expect(ctx.repository.ideViewModelRepository.hunks()).toHaveLength(1);
    expect(ctx.rpi.deleteHunkRequest).not.toHaveBeenCalled();
});

test('abort-before-the-run-starts-does-not-touch-the-project', async () => {
    const ctx = setup();
    let releaseSave: () => void = () => {};
    ctx.rpi.saveProgramRequest = jest.fn().mockReturnValue(
        new Promise((resolve) => {
            releaseSave = () => resolve(okResult({}));
        })
    );
    ctx.repository.chatViewModelRepository.setInput('сделай таблицу');
    const submit = ctx.agentChatService.onPromptSubmit();
    await settled();
    ctx.rpi.getProjectRequest = jest.fn();

    await ctx.agentChatService.onAbortClicked();
    releaseSave();
    await submit;

    expect(ctx.agentSocketState.started).toBeNull();
    // сессии ещё не было: ответ сервера затёр бы то, что человек не успел сохранить
    expect(ctx.rpi.getProjectRequest).not.toHaveBeenCalled();
    expect(lastMessage(ctx)).toMatchObject({
        kind: 'notice',
        reason: 'aborted_nothing',
    });
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('idle');
});

test('abort-clicked-twice-writes-one-notice-with-the-list', async () => {
    const ctx = setup();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
    await runningAgent(ctx);
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [segmentHunk('h1', 3, 1)] }));
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    const server = pending<unknown>();
    ctx.rpi.getProjectRequest = jest.fn().mockReturnValue(server.promise);

    const first = ctx.agentChatService.onAbortClicked();
    await settled();
    // досинхронизация ещё идёт, состояние 'running' и кнопка прерывания на экране
    await ctx.agentChatService.onAbortClicked();
    server.resolve(okResult({ program: emptyProgram }));
    await first;

    expect(lastMessage(ctx)).toMatchObject({
        kind: 'notice',
        reason: 'aborted',
        changes: [{ labelKey: 'segment', segmentId: 3 }],
    });
    expect(
        ctx.repository.chatViewModelRepository
            .messages()
            .filter((message) => message.kind === 'notice')
    ).toHaveLength(1);
    expect(
        onEvent.mock.calls.filter(
            ([name]) => name === Events.EVENT_AGENT_ABORTED
        )
    ).toHaveLength(1);
});

test('abort-during-a-drop-leaves-the-disconnect-error', async () => {
    const ctx = setup();
    await runningAgent(ctx);
    const server = pending<unknown>();
    ctx.rpi.getProjectRequest = jest.fn().mockReturnValue(server.promise);

    ctx.agentSocketState.handlers?.onClosed('closed');
    await settled();
    // обрыв уже разбирается, состояние ещё 'running' и кнопка прерывания на экране
    await ctx.agentChatService.onAbortClicked();
    server.resolve(okResult({ program: emptyProgram }));
    await settled();

    expect(lastMessage(ctx)).toMatchObject({
        kind: 'error',
        reason: 'disconnected',
    });
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('error');
    // прогон кончился сам, закрывать уже нечего
    expect(ctx.agentSocketState.closeCalls).toBe(0);
});

test('a-failed-hunk-reload-on-abort-makes-the-next-run-resync', async () => {
    const ctx = setup();
    await runningAgent(ctx);
    // правка ушла на сервер, а список на клиент не доехал ни на вызове, ни на прерывании
    ctx.rpi.listHunksRequest = jest.fn().mockResolvedValue(failedResult);
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });

    await ctx.agentChatService.onAbortClicked();

    expect(lastMessage(ctx)).toMatchObject({
        kind: 'notice',
        reason: 'aborted_unsynced',
    });
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockResolvedValue(okResult({ program: emptyProgram }));
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [segmentHunk('h1', 3, 1)] }));

    await runningAgent(ctx, 'ещё раз');

    // прошлый список остался неизвестным, поэтому второй прогон обязан свериться до старта
    expect(ctx.rpi.getProjectRequest).toHaveBeenCalled();
    expect(ctx.rpi.listHunksRequest).toHaveBeenCalled();
    ctx.rpi.listHunksRequest = jest.fn().mockResolvedValue(
        okResult({
            hunks: [segmentHunk('h1', 3, 1), segmentHunk('h2', 5, 1)],
        })
    );
    const shown = events(ctx).length;
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });

    // в ленте второго прогона только его собственная правка
    expect(events(ctx)).toHaveLength(shown + 1);
});

// Сборку агент запускает сам посреди прогона: результат ложится тем же разбором, что у кнопки Run, а вкладку не трогаем, иначе лента ушла бы за PDF

const RESULT_PDF =
    'https://files.labkeeper.io/generated/user-1/project-1/result7.pdf';
const UNFINISHED_PDF =
    'https://files.labkeeper.io/generated/user-1/project-1/result8.pdf';
const GUEST_PDF = 'https://files.labkeeper.io/incognito/7c1d.pdf';

/** Ошибка LaTeX в том виде, в каком её прислал препрод: строка на 1 меньше строки сегмента */
const LATEX_ERROR = {
    code: CompileError.LATEX_ERROR,
    payload: {
        line: 9,
        position: 0,
        segmentId: 1,
        latexErrorMessage: 'Undefined control sequence.',
    },
} as CompileErrorResult;

const FILE_ERROR = {
    code: CompileError.FILE_USAGE_NOT_ALLOWED,
    payload: { line: 1, position: 0, segmentId: 1 },
} as CompileErrorResult;

const CALCULATED: CompileSuccessResult = {
    segments: [
        {
            type: 'computational',
            statements: [
                { type: 'table', items: [['a', '10']] } as TableStatement,
            ],
        } as ComputationalOutputSegment,
    ],
};

async function compilingRun(
    ctx: ReturnType<typeof setup>,
    mode: ProjectType = 'latex'
) {
    ctx.repository.projectViewModelRepository.setProjectType(mode);
    ctx.repository.settingsViewModelRepository.setViewerTab = jest.fn();
    ctx.repository.settingsViewModelRepository.setMobileView = jest.fn();
    ctx.repository.chatViewModelRepository.setInput('собери документ');
    await ctx.agentChatService.onPromptSubmit();
}

/** Всё, чем интерфейс уводит на результат: счётчик для эффекта страницы и сами вкладки */
const resultShown = (ctx: ReturnType<typeof setup>) => ({
    pdfUpdated: ctx.repository.ideViewModelRepository.pdfUpdated(),
    viewerTab: (
        ctx.repository.settingsViewModelRepository.setViewerTab as jest.Mock
    ).mock.calls,
    mobileView: (
        ctx.repository.settingsViewModelRepository.setMobileView as jest.Mock
    ).mock.calls,
});

const NOTHING_SHOWN = { pdfUpdated: 0, viewerTab: [], mobileView: [] };

const eventLabels = (ctx: ReturnType<typeof setup>) =>
    ctx.repository.chatViewModelRepository
        .messages()
        .flatMap((message) =>
            message.kind === 'event' ? [message.labelKey] : []
        );

test('agent-compilation-puts-the-pdf-into-the-viewer-and-keeps-the-chat', async () => {
    const ctx = setup();
    ctx.repository.projectViewModelRepository.setCompileErrorResult({
        errors: [LATEX_ERROR],
    });
    await compilingRun(ctx);

    await emit(ctx, { kind: 'compilationStarted' });
    await emit(ctx, {
        kind: 'compilationFinished',
        pdfUri: RESULT_PDF,
        markdown: undefined,
    });

    expect(ctx.repository.projectViewModelRepository.pdfUri()).toBe(RESULT_PDF);
    // сборка прошла, прежние ошибки уже не про этот документ
    expect(
        ctx.repository.projectViewModelRepository.compileErrorResult()
    ).toEqual({ errors: [] });
    expect(resultShown(ctx)).toEqual(NOTHING_SHOWN);
    expect(eventLabels(ctx)).toEqual(['compile_started', 'compile_finished']);
});

test.each([
    ['an-authorized-user', true],
    ['a-guest', false],
])(
    'agent-compilation-of-markdown-puts-the-result-into-segments-for-%s',
    async (_name, authenticated) => {
        const ctx = setup(authenticated);
        await compilingRun(ctx, 'markdown');

        // отсутствующее поле лежит ключом со значением undefined, так его отдаёт сокет
        await emit(ctx, {
            kind: 'compilationFinished',
            pdfUri: undefined,
            markdown: CALCULATED,
        });

        expect(
            ctx.repository.projectViewModelRepository.compileSuccessResult()
        ).toEqual(CALCULATED);
        expect(
            ctx.repository.projectViewModelRepository.pdfUri()
        ).toBeUndefined();
        expect(resultShown(ctx)).toEqual(NOTHING_SHOWN);
        expect(eventLabels(ctx)).toEqual(['compile_finished']);
    }
);

test('agent-compilation-errors-open-the-panel-with-the-unfinished-pdf', async () => {
    const ctx = setup();
    await compilingRun(ctx);

    await emit(ctx, { kind: 'compilationStarted' });
    await emit(ctx, {
        kind: 'compilationFailed',
        errors: {
            errors: [LATEX_ERROR, FILE_ERROR],
            unfinishedPdfUri: UNFINISHED_PDF,
        },
    });

    expect(
        ctx.repository.projectViewModelRepository.compileErrorResult()
    ).toEqual({
        errors: [LATEX_ERROR, FILE_ERROR],
        unfinishedPdfUri: UNFINISHED_PDF,
    });
    expect(
        ctx.repository.settingsViewModelRepository.expandProblemViewer()
    ).toBe(true);
    expect(ctx.repository.projectViewModelRepository.pdfUri()).toBe(
        UNFINISHED_PDF
    );
    // окно входа от кнопки Run перекрыло бы ленту посреди прогона
    expect(ctx.repository.authViewModelRepository.currentView()).toBe('closed');
    expect(resultShown(ctx)).toEqual(NOTHING_SHOWN);
    expect(eventLabels(ctx)).toEqual(['compile_started', 'compile_failed']);
});

test('agent-compilation-errors-without-an-unfinished-pdf-keep-the-last-pdf', async () => {
    const ctx = setup();
    ctx.repository.projectViewModelRepository.setPdfUri(RESULT_PDF);
    await compilingRun(ctx);

    await emit(ctx, {
        kind: 'compilationFailed',
        errors: { errors: [LATEX_ERROR], unfinishedPdfUri: undefined },
    });

    expect(ctx.repository.projectViewModelRepository.pdfUri()).toBe(RESULT_PDF);
    expect(
        ctx.repository.projectViewModelRepository.compileErrorResult()
    ).toEqual({ errors: [LATEX_ERROR], unfinishedPdfUri: undefined });
});

test.each([
    [
        'finished',
        {
            kind: 'compilationFinished',
            pdfUri: RESULT_PDF,
            markdown: undefined,
        },
    ],
    [
        'failed',
        {
            kind: 'compilationFailed',
            errors: { errors: [LATEX_ERROR], unfinishedPdfUri: UNFINISHED_PDF },
        },
    ],
] as [string, AgentEvent][])(
    'agent-compilation-%s-refreshes-the-files-and-the-balance',
    async (_name, result) => {
        const ctx = setup();
        const pdf = {
            fileName: 'result7.pdf',
            url: RESULT_PDF,
            autogenerated: true,
        };
        ctx.rpi.listFilesRequest = jest
            .fn()
            .mockResolvedValue(okResult({ files: [pdf] }));
        await compilingRun(ctx);
        mockUserInfoWithDefaultUser(ctx.rpi);

        await emit(ctx, { kind: 'compilationStarted' });
        // до результата обновлять нечего
        expect(ctx.rpi.listFilesRequest).not.toHaveBeenCalled();
        expect(ctx.rpi.getUserInfoRequest).not.toHaveBeenCalled();

        await emit(ctx, result);

        // собранный pdf ложится в файлы проекта, а сборка стоит токенов
        expect(ctx.rpi.listFilesRequest).toHaveBeenCalledWith(PROJECT_ID);
        expect(ctx.repository.projectViewModelRepository.files()).toEqual([
            pdf,
        ]);
        expect(ctx.rpi.getUserInfoRequest).toHaveBeenCalledTimes(1);
        expect(ctx.repository.userViewModelRepository.tokenBalance()).toBe(0);
    }
);

test('agent-compilation-result-survives-the-next-edit-of-the-agent', async () => {
    const ctx = setup();
    const program = (text: string): Program => ({
        segments: [
            {
                id: 1,
                type: 'computational',
                text,
                parameters: { visible: true },
            },
        ],
        parameters: { roundStrategy: 'noRound' },
    });
    await compilingRun(ctx, 'markdown');
    await emit(ctx, {
        kind: 'compilationFinished',
        pdfUri: undefined,
        markdown: CALCULATED,
    });
    ctx.rpi.listHunksRequest = jest.fn().mockResolvedValue(
        okResult({
            hunks: [
                {
                    id: 'r1',
                    type: 'replaceTextInSegment',
                    segmentId: 1,
                    startLine: 1,
                    endLine: 1,
                    text: 'a = 10',
                },
            ],
        })
    );
    // любая правка агента обнуляет результат проекта на сервере
    ctx.rpi.getProjectRequest = jest
        .fn()
        .mockResolvedValue(
            okResult({ program: program('a = 20'), lastProgramResult: null })
        );

    await emit(ctx, { kind: 'toolCall', toolName: 'replace_text_in_segment' });

    expect(ctx.rpi.getProjectRequest).toHaveBeenCalled();
    expect(
        ctx.repository.projectViewModelRepository.currentProgram().segments[0]
            .text
    ).toBe('a = 20');
    expect(
        ctx.repository.projectViewModelRepository.compileSuccessResult()
    ).toEqual(CALCULATED);
});

test('agent-compilation-of-a-left-run-writes-nothing', async () => {
    const ctx = setup();
    await compilingRun(ctx);
    const leftRun = ctx.agentSocketState.handlers;
    await ctx.agentChatService.onAbortClicked();
    const shown = ctx.repository.chatViewModelRepository.messages().length;
    ctx.rpi.listFilesRequest = jest.fn();

    // кадры, которые успели встать в очередь до закрытия сокета
    await leftRun?.onEvent({ kind: 'compilationStarted' });
    await leftRun?.onEvent({
        kind: 'compilationFinished',
        pdfUri: RESULT_PDF,
        markdown: undefined,
    });
    await leftRun?.onEvent({
        kind: 'compilationFailed',
        errors: { errors: [LATEX_ERROR], unfinishedPdfUri: UNFINISHED_PDF },
    });

    expect(ctx.repository.projectViewModelRepository.pdfUri()).toBeUndefined();
    expect(
        ctx.repository.projectViewModelRepository.compileErrorResult()
    ).toBeUndefined();
    expect(
        ctx.repository.settingsViewModelRepository.expandProblemViewer()
    ).toBe(false);
    expect(ctx.repository.chatViewModelRepository.messages()).toHaveLength(
        shown
    );
    expect(ctx.rpi.listFilesRequest).not.toHaveBeenCalled();
});

test('guest-agent-compilation-shows-the-pdf-of-a-latex-program', async () => {
    const ctx = setup(false);
    ctx.rpi.getUserInfoRequest = jest.fn();
    await compilingRun(ctx, 'latex');

    await emit(ctx, {
        kind: 'compilationFinished',
        pdfUri: GUEST_PDF,
        markdown: undefined,
    });

    expect(ctx.repository.projectViewModelRepository.pdfUri()).toBe(GUEST_PDF);
    expect(resultShown(ctx)).toEqual(NOTHING_SHOWN);
    // у гостя нет ни файлов проекта на сервере, ни баланса
    expect(ctx.rpi.listFilesRequest).not.toHaveBeenCalled();
    expect(ctx.rpi.getUserInfoRequest).not.toHaveBeenCalled();
});

test('guest-agent-pdf-in-markdown-mode-is-not-shown', async () => {
    const ctx = setup(false);
    await compilingRun(ctx, 'markdown');
    jest.mocked(Sentry.addBreadcrumb).mockClear();

    await emit(ctx, {
        kind: 'compilationFinished',
        pdfUri: GUEST_PDF,
        markdown: undefined,
    });
    await emit(ctx, {
        kind: 'compilationFailed',
        errors: { errors: [LATEX_ERROR], unfinishedPdfUri: GUEST_PDF },
    });

    // вкладка результата в markdown рисует только сегменты, pdf там показать негде
    expect(ctx.repository.projectViewModelRepository.pdfUri()).toBeUndefined();
    // ошибки относятся к сегментам и видны в любом режиме
    expect(
        ctx.repository.projectViewModelRepository.compileErrorResult()
    ).toEqual({ errors: [LATEX_ERROR] });
    expect(eventLabels(ctx)).toEqual(['compile_finished', 'compile_failed']);
    expect(
        jest
            .mocked(Sentry.addBreadcrumb)
            .mock.calls.filter(
                ([crumb]) =>
                    crumb.category === 'agent' &&
                    crumb.message === 'compilation result does not fit the mode'
            )
    ).toHaveLength(2);
});

test('agent-markdown-result-in-latex-mode-is-not-applied', async () => {
    const ctx = setup();
    ctx.repository.projectViewModelRepository.setPdfUri(RESULT_PDF);
    ctx.repository.projectViewModelRepository.setCompileErrorResult({
        errors: [LATEX_ERROR],
    });
    await compilingRun(ctx, 'latex');
    const segmentsBefore =
        ctx.repository.projectViewModelRepository.compileSuccessResult();
    jest.mocked(Sentry.addBreadcrumb).mockClear();

    await emit(ctx, {
        kind: 'compilationFinished',
        pdfUri: undefined,
        markdown: CALCULATED,
    });

    // сегменты latex не рисуют результат markdown, а ошибки и pdf остаются от прошлой сборки
    expect(
        ctx.repository.projectViewModelRepository.compileSuccessResult()
    ).toBe(segmentsBefore);
    expect(
        ctx.repository.projectViewModelRepository.compileErrorResult()
    ).toEqual({ errors: [LATEX_ERROR] });
    expect(ctx.repository.projectViewModelRepository.pdfUri()).toBe(RESULT_PDF);
    expect(resultShown(ctx)).toEqual(NOTHING_SHOWN);
    expect(eventLabels(ctx)).toEqual(['compile_finished']);
    expect(
        jest
            .mocked(Sentry.addBreadcrumb)
            .mock.calls.filter(
                ([crumb]) =>
                    crumb.category === 'agent' &&
                    crumb.message === 'compilation result does not fit the mode'
            )
    ).toHaveLength(1);
});

test('finished-run-tells-analytics-whether-the-agent-compiled', async () => {
    const ctx = setup();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
    await compilingRun(ctx);
    await emit(ctx, {
        kind: 'compilationFailed',
        errors: { errors: [LATEX_ERROR], unfinishedPdfUri: undefined },
    });
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    // второй прогон: сборка началась, но результата не дала
    ctx.repository.chatViewModelRepository.setInput('ещё раз');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'compilationStarted' });
    await emit(ctx, {
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
    });

    expect(
        onEvent.mock.calls
            .filter(([event]) => event === Events.EVENT_AGENT_FINISHED)
            .map(([, properties]) => properties?.compiled)
    ).toEqual([true, false]);
});

// После прогона со сборкой открывается результат, но только если прогон кончился сам и без отказа

const PDF_BUILT: AgentEvent = {
    kind: 'compilationFinished',
    pdfUri: RESULT_PDF,
    markdown: undefined,
};

const PDF_FAILED: AgentEvent = {
    kind: 'compilationFailed',
    errors: { errors: [LATEX_ERROR], unfinishedPdfUri: UNFINISHED_PDF },
};

const done = (stopReason: AgentStopReason = 'Done'): AgentEvent => ({
    kind: 'finished',
    message: 'готово',
    stopReason,
});

/** Телефон после конца прогона делает свой шаг, десктоп нет: так видно оба экрана */
async function phoneAfterRun(ctx: ReturnType<typeof setup>) {
    await ctx.agentChatService.onAgentFinishedOnPhone();
    return {
        ...resultShown(ctx),
        target: ctx.repository.ideViewModelRepository.editorNavigationTarget(),
    };
}

test.each([
    ['a-built-document', PDF_BUILT, 'Done'],
    ['build-errors', PDF_FAILED, 'Done'],
    ['an-iteration-limit', PDF_BUILT, 'IterationLimit'],
] as [string, AgentEvent, AgentStopReason][])(
    'finished-run-with-%s-opens-the-pdf-on-a-desktop',
    async (_name, result, stopReason) => {
        const ctx = setup();
        await compilingRun(ctx);
        await emit(ctx, { kind: 'compilationStarted' });
        await emit(ctx, result);

        // посреди прогона человек читает ленту
        expect(resultShown(ctx)).toEqual(NOTHING_SHOWN);

        await emit(ctx, done(stopReason));

        // вкладку ставит сервис, а не счётчик результата: на телефоне он гонялся бы с концом прогона
        expect(resultShown(ctx)).toEqual({
            pdfUpdated: 0,
            viewerTab: [['pdf']],
            mobileView: [],
        });
    }
);

test('finished-run-with-a-compilation-on-a-phone-opens-the-pdf-instead-of-the-change', async () => {
    const ctx = phoneSetup();
    ctx.repository.settingsViewModelRepository.setViewerTab = jest.fn();
    ctx.repository.projectViewModelRepository.setProjectType('latex');
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValueOnce(okResult({ hunks: [segmentHunk('a', 2, 1)] }))
        .mockResolvedValue(
            okResult({
                hunks: [
                    segmentHunk('a', 2, 1),
                    segmentHunk('b', 3, 4),
                    segmentHunk('c', 1, 7),
                ],
            })
        );
    ctx.repository.chatViewModelRepository.setInput('поправь и собери');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, PDF_BUILT);
    await emit(ctx, done());

    // редактор остаётся там, куда его поставил шаг агента, а экран уходит на результат
    expect(await phoneAfterRun(ctx)).toEqual({
        pdfUpdated: 0,
        viewerTab: [['pdf']],
        mobileView: [['pdf']],
        target: { segmentIndex: 2, line: 4, focus: false },
    });
});

test.each([
    ['no-compilation', []],
    ['a-compilation-that-only-started', [{ kind: 'compilationStarted' }]],
] as [string, AgentEvent[]][])(
    'run-with-%s-opens-the-last-change-as-before',
    async (_name, frames) => {
        const ctx = phoneSetup();
        ctx.repository.settingsViewModelRepository.setViewerTab = jest.fn();
        ctx.rpi.listHunksRequest = jest
            .fn()
            .mockResolvedValue(okResult({ hunks: [segmentHunk('a', 2, 1)] }));
        ctx.repository.chatViewModelRepository.setInput('сделай');
        await ctx.agentChatService.onPromptSubmit();
        await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
        for (const frame of frames) {
            await emit(ctx, frame);
        }
        await emit(ctx, done());

        // без результата сборки показывать нечего: десктоп на чате, телефон в редакторе на правке
        expect(await phoneAfterRun(ctx)).toEqual({
            pdfUpdated: 0,
            viewerTab: [],
            mobileView: [['editor']],
            target: { segmentIndex: 1, line: 1, focus: false },
        });
    }
);

test.each([
    [
        'an-error',
        async (ctx: ReturnType<typeof setup>) => {
            await emit(ctx, {
                kind: 'finished',
                message: null,
                stopReason: 'UnknownError',
            });
        },
        'error',
    ],
    [
        'an-abort',
        async (ctx: ReturnType<typeof setup>) => {
            await ctx.agentChatService.onAbortClicked();
        },
        'idle',
    ],
    [
        'a-dropped-connection',
        async (ctx: ReturnType<typeof setup>) => {
            ctx.agentSocketState.handlers?.onClosed('closed');
            await settled();
        },
        'error',
    ],
] as const)(
    'run-with-a-compilation-that-ends-with-%s-keeps-the-chat',
    async (_name, end, state) => {
        const ctx = phoneSetup();
        ctx.repository.settingsViewModelRepository.setViewerTab = jest.fn();
        ctx.repository.projectViewModelRepository.setProjectType('latex');
        ctx.rpi.listHunksRequest = jest
            .fn()
            .mockResolvedValue(okResult({ hunks: [segmentHunk('a', 2, 1)] }));
        ctx.repository.chatViewModelRepository.setInput('собери документ');
        await ctx.agentChatService.onPromptSubmit();
        await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
        await emit(ctx, PDF_BUILT);

        await end(ctx);

        // в ленте ошибка или итог прерывания, их надо прочитать там
        expect(ctx.repository.chatViewModelRepository.requestState()).toBe(
            state
        );
        expect(await phoneAfterRun(ctx)).toEqual({
            ...NOTHING_SHOWN,
            target: { segmentIndex: 1, line: 1, focus: false },
        });
    }
);

test('next-run-forgets-the-compilation-of-the-previous-one', async () => {
    const ctx = phoneSetup();
    ctx.repository.settingsViewModelRepository.setViewerTab = jest.fn();
    ctx.repository.projectViewModelRepository.setProjectType('latex');
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [segmentHunk('a', 2, 1)] }));
    ctx.repository.chatViewModelRepository.setInput('собери документ');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, PDF_BUILT);
    await emit(ctx, done());
    await ctx.agentChatService.onAgentFinishedOnPhone();

    ctx.repository.chatViewModelRepository.setInput('поправь');
    await ctx.agentChatService.onPromptSubmit();
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, done());

    // второй прогон без сборки: вкладка PDF только от первого, телефон идёт к правке
    expect(await phoneAfterRun(ctx)).toEqual({
        pdfUpdated: 0,
        viewerTab: [['pdf']],
        mobileView: [['pdf'], ['editor']],
        target: { segmentIndex: 1, line: 1, focus: false },
    });
});

test('run-left-during-the-final-sync-does-not-open-the-pdf', async () => {
    const ctx = setup();
    await compilingRun(ctx);
    // перечитать после правки не вышло: финал сверится с сервером и будет его ждать
    ctx.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(okResult({ hunks: [addedLines(2, 'X')] }));
    ctx.rpi.getProjectRequest = jest.fn().mockResolvedValue(failedResult);
    await emit(ctx, { kind: 'toolCall', toolName: 'add_lines_to_segment' });
    await emit(ctx, PDF_BUILT);
    const server = pending<unknown>();
    ctx.rpi.getProjectRequest = jest.fn().mockReturnValue(server.promise);

    const finished = emit(ctx, done());
    await settled();
    ctx.agentChatService.onProjectChanged();
    server.resolve(okResult({ program: oneSegment('a\nX') }));
    await finished;

    // прогон остался в прошлом проекте, а вкладку нового он менять не должен
    expect(ctx.rpi.getProjectRequest).toHaveBeenCalledTimes(1);
    expect(resultShown(ctx)).toEqual(NOTHING_SHOWN);
});
