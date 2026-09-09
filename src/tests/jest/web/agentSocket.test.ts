/**
 * Транспорт агента поверх WebSocket.
 * constants.ts читает глобаль, которую в сборке подставляет vite, поэтому подкладываем её
 * сами и берём настоящий модуль: адреса каналов проверяются как есть, без выдуманных строк.
 */
jest.mock('../../../constants.ts', () => {
    (globalThis as unknown as { __BUILD_INFO__: unknown }).__BUILD_INFO__ = {
        major: '4',
        minor: '0',
    };
    return jest.requireActual('../../../constants.ts');
});

import { WebAgentSocket } from '../../../web/server/agentSocket.ts';
import {
    AGENT_TIMEOUT_MS,
    AgentEvent,
    AgentSessionParams,
} from '../../../model/rpi/agentSocket.ts';
import { Hunk, Program } from '../../../model/domain.ts';

/**
 * Заглушка глобального WebSocket: настоящий в jsdom реально идёт в сеть.
 * Запоминает адрес и отправленные кадры, а события соединения дёргает тест.
 */
class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    /** Все созданные сокеты по порядку создания */
    static instances: FakeWebSocket[] = [];
    /** Имитация отказа ещё на конструкторе */
    static failOnCreate = false;

    readonly url: string;
    readyState: number = FakeWebSocket.CONNECTING;
    /** Всё, что транспорт отправил через send */
    readonly sent: string[] = [];
    /** Коды, с которыми звали close */
    readonly closeCodes: number[] = [];

    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(url: string) {
        if (FakeWebSocket.failOnCreate) {
            throw new Error('соединение не установлено');
        }
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    send(data: string): void {
        this.sent.push(data);
    }

    close(code?: number): void {
        this.closeCodes.push(code ?? 0);
        this.readyState = FakeWebSocket.CLOSED;
    }

    /** Соединение открылось */
    fireOpen(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    /** Кадр от сервера */
    fireMessage(frame: object): void {
        this.fireRaw(JSON.stringify(frame));
    }

    /** Сырые данные от сервера, в том числе не JSON */
    fireRaw(data: string): void {
        this.onmessage?.({ data });
    }

    /** Сервер закрыл соединение */
    fireClose(): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.();
    }

    fireError(): void {
        this.onerror?.();
    }
}

const lastSocket = (): FakeWebSocket => {
    const socket = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
    if (!socket) {
        throw new Error('сокет не создан');
    }
    return socket;
};

/** Прокручивает очередь микрозадач, чтобы обработчики событий успели отработать */
const flush = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve();
    }
};

const makeHandlers = (
    onEvent: (event: AgentEvent) => void | Promise<void> = () => {}
) => ({
    onEvent: jest.fn(onEvent),
    onClosed: jest.fn(),
});

type StartFrame = {
    type: string;
    prompt: string;
    numberIterations: number;
    maxTokens: number;
    program?: Program;
};

const parseStartFrame = (socket: FakeWebSocket): StartFrame =>
    JSON.parse(socket.sent[0]) as StartFrame;

const PARAMS: AgentSessionParams = {
    prompt: 'посчитай площадь',
    numberIterations: 12,
    maxTokens: 30000,
};

const PROGRAM: Program = {
    segments: [
        { type: 'md', parameters: {}, text: 'заголовок' },
        // чужой id должен быть перенумерован перед отправкой
        { id: 77, type: 'computational', parameters: {}, text: 'a = 1' },
    ],
    parameters: { roundStrategy: 'noRound' },
};

const HUNKS: Hunk[] = [
    { id: 'h-1', type: 'addSegment', segmentId: 2, text: 'новый сегмент' },
];

let originalWebSocket: unknown;

beforeEach(() => {
    jest.useFakeTimers();
    FakeWebSocket.instances = [];
    FakeWebSocket.failOnCreate = false;
    originalWebSocket = globalThis.WebSocket;
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
});

afterEach(() => {
    (globalThis as unknown as { WebSocket: unknown }).WebSocket =
        originalWebSocket;
    jest.useRealTimers();
});

test('authorized-channel-is-built-from-the-project-id', () => {
    new WebAgentSocket().startAgent('project-42', PARAMS, makeHandlers());

    expect(lastSocket().url).toBe(
        'ws://localhost/api/v4/ws/project/project-42'
    );
});

test('unauthorized-channel-has-no-project-id', () => {
    new WebAgentSocket().startAgentUnauthorized(
        { ...PARAMS, program: PROGRAM },
        makeHandlers()
    );

    expect(lastSocket().url).toBe('ws://localhost/api/v4/ws/prompt');
});

test('start-frame-is-sent-only-after-the-socket-opens', () => {
    new WebAgentSocket().startAgent('project-42', PARAMS, makeHandlers());
    const socket = lastSocket();

    expect(socket.sent).toEqual([]);

    socket.fireOpen();

    expect(socket.sent).toHaveLength(1);
    expect(parseStartFrame(socket)).toEqual({
        type: 'startAgent',
        prompt: 'посчитай площадь',
        numberIterations: 12,
        maxTokens: 30000,
    });
});

test('unauthorized-start-frame-carries-the-program-with-segment-ids', () => {
    new WebAgentSocket().startAgentUnauthorized(
        { ...PARAMS, program: PROGRAM },
        makeHandlers()
    );
    const socket = lastSocket();
    socket.fireOpen();

    const frame = parseStartFrame(socket);

    expect(frame.type).toBe('startAgentUnauthorized');
    expect(frame.prompt).toBe('посчитай площадь');
    expect(frame.numberIterations).toBe(12);
    expect(frame.maxTokens).toBe(30000);
    expect(frame.program?.segments.map((segment) => segment.id)).toEqual([
        1, 2,
    ]);
});

test('server-frames-reach-on-event-parsed', async () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireMessage({
        type: 'modelFinished',
        totalTokens: 1200,
        elapsedTimeMillis: 4500,
    });
    socket.fireMessage({ type: 'toolCall', toolName: 'read_segment' });
    await flush();

    expect(handlers.onEvent.mock.calls.map((call) => call[0])).toEqual([
        { kind: 'modelFinished', totalTokens: 1200, elapsedTimeMillis: 4500 },
        { kind: 'toolCall', toolName: 'read_segment' },
    ]);
});

test('unparsable-frames-never-reach-on-event', async () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireRaw('это не json');
    socket.fireMessage({ type: 'somethingNew' });
    socket.fireMessage({ type: 'toolCall' });
    await flush();

    expect(handlers.onEvent).not.toHaveBeenCalled();
});

test('async-on-event-handlers-are-queued', async () => {
    const log: string[] = [];
    let releaseFirst = () => {};
    const first = new Promise<void>((resolve) => {
        releaseFirst = resolve;
    });
    const handlers = makeHandlers(async (event) => {
        const tag = event.kind === 'toolCall' ? event.toolName : event.kind;
        log.push(`начало ${tag}`);
        if (tag === 'read_segment') {
            await first;
        }
        log.push(`конец ${tag}`);
    });
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireMessage({ type: 'toolCall', toolName: 'read_segment' });
    socket.fireMessage({ type: 'toolCall', toolName: 'search_segments' });
    await flush();

    // второе событие не должно обгонять незавершённое первое
    expect(log).toEqual(['начало read_segment']);

    releaseFirst();
    await flush();

    expect(log).toEqual([
        'начало read_segment',
        'конец read_segment',
        'начало search_segments',
        'конец search_segments',
    ]);
});

test('final-event-closes-the-socket-once-and-clears-the-timer', async () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireMessage({
        type: 'agentFinished',
        message: 'готово',
        stopReason: 'Done',
        hunks: HUNKS,
    });
    await flush();

    expect(handlers.onEvent).toHaveBeenCalledWith({
        kind: 'finished',
        message: 'готово',
        stopReason: 'Done',
        hunks: HUNKS,
    });
    expect(socket.closeCodes).toEqual([1000]);
    expect(handlers.onClosed).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);

    // после финала ни кадры, ни закрытие сервером, ни таймаут уже ничего не значат
    socket.fireMessage({ type: 'toolCall', toolName: 'done' });
    socket.fireClose();
    await jest.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS);

    expect(handlers.onEvent).toHaveBeenCalledTimes(1);
    expect(handlers.onClosed).not.toHaveBeenCalled();
    expect(socket.closeCodes).toEqual([1000]);
});

test('unauthorized-final-event-carries-the-program-and-closes-the-socket', async () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgentUnauthorized(
        { ...PARAMS, program: PROGRAM },
        handlers
    );
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireMessage({
        type: 'agentFinishedUnauthorized',
        message: null,
        stopReason: 'UnauthorizedLimitExceeded',
        program: PROGRAM,
    });
    await flush();

    expect(handlers.onEvent).toHaveBeenCalledWith({
        kind: 'finished',
        message: null,
        stopReason: 'UnauthorizedLimitExceeded',
        program: PROGRAM,
    });
    expect(socket.closeCodes).toEqual([1000]);
});

test('silence-past-the-deadline-gives-timeout-and-a-closed-socket', async () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    await jest.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS - 1);

    expect(handlers.onClosed).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);

    expect(handlers.onClosed.mock.calls).toEqual([['timeout']]);
    expect(socket.closeCodes).toEqual([1000]);
});

test('drop-after-open-gives-closed', async () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireClose();

    expect(handlers.onClosed.mock.calls).toEqual([['closed']]);
    // таймер снят вместе с сессией
    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS);

    expect(handlers.onClosed).toHaveBeenCalledTimes(1);
});

test('drop-before-open-gives-connect-failed', () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);

    lastSocket().fireClose();

    expect(handlers.onClosed.mock.calls).toEqual([['connect_failed']]);
});

test('socket-error-after-open-gives-closed', () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireError();

    expect(handlers.onClosed.mock.calls).toEqual([['closed']]);
    expect(socket.closeCodes).toEqual([1000]);
});

test('socket-error-before-open-gives-connect-failed', () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);

    lastSocket().fireError();

    expect(handlers.onClosed.mock.calls).toEqual([['connect_failed']]);
});

test('unbuildable-socket-gives-connect-failed-and-a-usable-stub-session', async () => {
    FakeWebSocket.failOnCreate = true;
    const handlers = makeHandlers();

    const session = new WebAgentSocket().startAgent(
        'project-42',
        PARAMS,
        handlers
    );
    session.close();
    await jest.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS);

    expect(handlers.onClosed.mock.calls).toEqual([['connect_failed']]);
});

test('close-stops-the-socket-and-the-timer-without-on-closed', async () => {
    const handlers = makeHandlers();
    const session = new WebAgentSocket().startAgent(
        'project-42',
        PARAMS,
        handlers
    );
    const socket = lastSocket();
    socket.fireOpen();

    session.close();
    session.close();

    expect(socket.closeCodes).toEqual([1000]);
    expect(jest.getTimerCount()).toBe(0);

    await jest.advanceTimersByTimeAsync(AGENT_TIMEOUT_MS);

    expect(handlers.onClosed).not.toHaveBeenCalled();
});

test('a-failure-inside-on-event-does-not-break-the-transport', async () => {
    const seen: AgentEvent[] = [];
    const handlers = makeHandlers((event) => {
        seen.push(event);
        return seen.length === 1
            ? Promise.reject(new Error('обработчик упал'))
            : Promise.resolve();
    });
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireMessage({ type: 'toolCall', toolName: 'read_segment' });
    socket.fireMessage({ type: 'toolCall', toolName: 'done' });
    socket.fireMessage({
        type: 'agentFinished',
        message: 'готово',
        stopReason: 'Done',
    });
    await flush();

    expect(seen.map((event) => event.kind)).toEqual([
        'toolCall',
        'toolCall',
        'finished',
    ]);
    expect(socket.closeCodes).toEqual([1000]);
    expect(handlers.onClosed).not.toHaveBeenCalled();
});
