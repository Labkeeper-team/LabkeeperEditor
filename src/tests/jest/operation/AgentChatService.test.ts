import {
    mockContext,
    mockSaveProgramRequest,
    mockUserInfoWithDefaultUser,
    PROJECT_ID,
    PROJECT_TITLE,
    USER_ID,
} from '../common.ts';
import { AgentEvent } from '../../../model/rpi/agentSocket.ts';
import { Hunk, Program } from '../../../model/domain.ts';
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

test('agent-settings-max-tokens-offers-login-to-a-guest', () => {
    const ctx = setup(false);
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');

    ctx.agentChatService.onMaxTokensChanged(30000);

    expect(ctx.repository.authViewModelRepository.currentView()).toBe('login');
    // значение осталось прежним, иначе гость поменял бы настройку в обход входа
    expect(ctx.repository.persistenceViewModelRepository.agentMaxTokens()).toBe(
        10000
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

    ctx.agentChatService.onIterationsChanged(12);

    expect(ctx.repository.authViewModelRepository.currentView()).toBe('login');
    expect(
        ctx.repository.persistenceViewModelRepository.agentIterations()
    ).toBe(5);
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

    ctx.agentChatService.onMaxTokensChanged(30000);
    ctx.agentChatService.onIterationsChanged(12);

    expect(ctx.repository.persistenceViewModelRepository.agentMaxTokens()).toBe(
        30000
    );
    expect(
        ctx.repository.persistenceViewModelRepository.agentIterations()
    ).toBe(12);
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
