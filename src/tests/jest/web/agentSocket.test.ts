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

// след в Sentry тоже часть договора: по нему потом ищут, что прислал сервер
jest.mock('../../../viewModel/utils/logBreadcrumb.ts', () => ({
    logBreadcrumb: jest.fn(),
}));

import { logBreadcrumb } from '../../../viewModel/utils/logBreadcrumb.ts';
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
const flush = async (turns = 10): Promise<void> => {
    for (let i = 0; i < turns; i++) {
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
    jest.mocked(logBreadcrumb).mockClear();
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

// свежие копии модулей: sessionId модульный, и без изоляции он утёк бы в соседние случаи
test('both-channels-carry-the-session-id', async () => {
    await jest.isolateModulesAsync(async () => {
        const { adoptAnalyticsSessionId } =
            await import('../../../web/session.ts');
        const { WebAgentSocket: IsolatedSocket } =
            await import('../../../web/server/agentSocket.ts');
        adoptAnalyticsSessionId('s-1');

        new IsolatedSocket().startAgent('project-42', PARAMS, makeHandlers());

        expect(lastSocket().url).toBe(
            'ws://localhost/api/v4/ws/project/project-42?sessionId=s-1'
        );

        new IsolatedSocket().startAgentUnauthorized(
            { ...PARAMS, program: PROGRAM },
            makeHandlers()
        );

        expect(lastSocket().url).toBe(
            'ws://localhost/api/v4/ws/prompt?sessionId=s-1'
        );
    });
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
    await flush();

    expect(handlers.onEvent).not.toHaveBeenCalled();
});

// выброшенный вызов не перечитал бы проект, и следующее сохранение затёрло бы его правку
test.each([
    ['an-unknown-name', 'replace_in_segment', 'replace_in_segment'],
    ['an-empty-name', '', ''],
    ['no-name', undefined, ''],
    ['a-number', 42, ''],
    ['an-object', { name: 'replace_in_segment' }, ''],
])('tool-call-with-%s-reaches-on-event', async (_case, toolName, expected) => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    socket.fireMessage({ type: 'toolCall', toolName });
    await flush();

    expect(handlers.onEvent.mock.calls.map((call) => call[0])).toEqual([
        { kind: 'toolCall', toolName: expected },
    ]);
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

test('unknown-stop-reason-becomes-an-error-not-a-success', async () => {
    const handlers = makeHandlers();
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    // сервер добавил причину, о которой фронт ещё не знает
    socket.fireMessage({
        type: 'agentFinished',
        message: null,
        stopReason: 'SomethingNew',
    });
    await flush();

    expect(handlers.onEvent).toHaveBeenCalledWith({
        kind: 'finished',
        message: null,
        stopReason: 'UnknownError',
    });
});

test.each([['PromptTooLong'], ['QuotaExceeded']])(
    'known-stop-reason-%s-passes-through-as-is',
    async (stopReason) => {
        const handlers = makeHandlers();
        new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
        const socket = lastSocket();
        socket.fireOpen();

        socket.fireMessage({
            type: 'agentFinished',
            message: null,
            stopReason,
        });
        await flush();

        expect(handlers.onEvent).toHaveBeenCalledWith({
            kind: 'finished',
            message: null,
            stopReason,
        });
    }
);

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

// кадры ниже сняты с препрода 28.09 (бэкенд 4.10.1.886) как есть, обезличены только адреса pdf
const LATEX_PDF =
    'https://files.labkeeper.io/generated/user-7/project-00000000-0000-4000-8000-000000000001/result73567724.pdf';
const UNFINISHED_PDF =
    'https://files.labkeeper.io/generated/user-7/project-00000000-0000-4000-8000-000000000001/result73669685.pdf';
const GUEST_PDF =
    'https://files.labkeeper.io/incognito/00000000-0000-4000-8000-000000000002.pdf';

/** Ошибка LaTeX из compilationFailed: все поля payload, в том числе null */
const LATEX_ERROR = {
    code: 700,
    payload: {
        line: 9,
        segmentId: 1,
        variable: null,
        operators: null,
        quotaIndex: 0,
        value: null,
        limit: null,
        position: 0,
        functionName: null,
        description: null,
        latexErrorMessage: 'Undefined control sequence.',
        latexFile: null,
    },
};

/** Авторизованный latex-проект: замена строки в сегменте, потом компиляция без ошибок */
const LATEX_RUN_FRAMES = [
    { type: 'modelFinished', totalTokens: 0.398574, elapsedTimeMillis: 1074 },
    { type: 'toolCall', toolName: 'list_workspace' },
    { type: 'modelFinished', totalTokens: 0.3993462, elapsedTimeMillis: 923 },
    { type: 'toolCall', toolName: 'read_segment' },
    { type: 'modelFinished', totalTokens: 0.41877, elapsedTimeMillis: 882 },
    { type: 'toolCall', toolName: 'replace_text_in_segment' },
    { type: 'modelFinished', totalTokens: 0.4114638, elapsedTimeMillis: 678 },
    { type: 'compilationStarted' },
    {
        type: 'compilationFinished',
        pdf: { pdfUri: LATEX_PDF },
        markdown: null,
    },
    { type: 'modelFinished', totalTokens: 0.4241754, elapsedTimeMillis: 824 },
    { type: 'toolCall', toolName: 'read_segment' },
    {
        type: 'modelFinished',
        totalTokens: 0.44995500000000005,
        elapsedTimeMillis: 1162,
    },
    { type: 'toolCall', toolName: 'done' },
    {
        type: 'agentFinished',
        stopReason: 'Done',
        message:
            'Готово: в сегменте 1 строка `Alpha line one.` заменена на `Beta line one.`, проект успешно скомпилирован. Больше ничего не изменялось.',
    },
];

/** Тот же проект, замена с ошибкой LaTeX: сборка падает, агент после неё ещё работает */
const FAILED_COMPILATION_RUN_FRAMES = [
    { type: 'modelFinished', totalTokens: 0.4277394, elapsedTimeMillis: 841 },
    { type: 'toolCall', toolName: 'read_segment' },
    { type: 'modelFinished', totalTokens: 0.455301, elapsedTimeMillis: 1404 },
    { type: 'toolCall', toolName: 'replace_text_in_segment' },
    { type: 'modelFinished', totalTokens: 0.4483512, elapsedTimeMillis: 818 },
    { type: 'compilationStarted' },
    {
        type: 'compilationFailed',
        errors: { errors: [LATEX_ERROR], unfinishedPdfUri: UNFINISHED_PDF },
    },
    {
        type: 'modelFinished',
        totalTokens: 0.49171319999999996,
        elapsedTimeMillis: 1395,
    },
    { type: 'toolCall', toolName: 'done' },
    {
        type: 'agentFinished',
        stopReason: 'Done',
        message:
            'Заменил в сегменте 1 строку `Gamma closing line.` на `Gamma \\undefinedprobecmd closing line.` и один раз скомпилировал. Компиляция ожидаемо упала: `Undefined control sequence` в сегменте 1, строка 10. Ошибку не исправлял, как просили.',
    },
];

const MARKDOWN_RESULT = {
    segments: [
        {
            id: 1,
            type: 'md',
            statements: null,
            text: '# Probe title\n\nHello new text.\n\nAnother md line.',
        },
    ],
};

/** Авторизованный markdown-проект: результат приходит сегментами, pdf нет */
const MARKDOWN_RUN_FRAMES = [
    { type: 'modelFinished', totalTokens: 0.3588948, elapsedTimeMillis: 894 },
    { type: 'toolCall', toolName: 'list_workspace' },
    {
        type: 'modelFinished',
        totalTokens: 0.36388440000000005,
        elapsedTimeMillis: 950,
    },
    { type: 'toolCall', toolName: 'read_segment' },
    { type: 'modelFinished', totalTokens: 0.3787344, elapsedTimeMillis: 875 },
    { type: 'toolCall', toolName: 'replace_text_in_segment' },
    { type: 'modelFinished', totalTokens: 0.3734478, elapsedTimeMillis: 725 },
    { type: 'compilationStarted' },
    { type: 'compilationFinished', pdf: null, markdown: MARKDOWN_RESULT },
    { type: 'modelFinished', totalTokens: 0.3978612, elapsedTimeMillis: 1381 },
    { type: 'toolCall', toolName: 'done' },
    {
        type: 'agentFinished',
        stopReason: 'Done',
        message:
            'Строка 3 сегмента 1 заменена на «Hello new text.», проект успешно скомпилирован.',
    },
];

/** Гость с latex-программой: компиляция посреди прогона, hunks замены в финале */
const GUEST_RUN_FRAMES = [
    { type: 'modelFinished', totalTokens: 0.3486186, elapsedTimeMillis: 778 },
    { type: 'toolCall', toolName: 'list_workspace' },
    {
        type: 'modelFinished',
        totalTokens: 0.35527139999999996,
        elapsedTimeMillis: 814,
    },
    { type: 'toolCall', toolName: 'read_segment' },
    { type: 'modelFinished', totalTokens: 0.3748734, elapsedTimeMillis: 866 },
    { type: 'toolCall', toolName: 'replace_text_in_segment' },
    { type: 'modelFinished', totalTokens: 0.3672108, elapsedTimeMillis: 825 },
    { type: 'compilationStarted' },
    {
        type: 'compilationFinished',
        pdf: { pdfUri: GUEST_PDF },
        markdown: null,
    },
    { type: 'modelFinished', totalTokens: 0.399168, elapsedTimeMillis: 1221 },
    { type: 'toolCall', toolName: 'done' },
    {
        type: 'agentFinishedUnauthorized',
        stopReason: 'Done',
        program: {
            segments: [
                {
                    id: 1,
                    type: 'latex',
                    parameters: {
                        visible: true,
                        hideAssignment: false,
                        hideAssignmentWithValues: false,
                        hideValue: false,
                        hideGeneralFormula: false,
                        hideInflAssignment: false,
                        hideInflAssignmentWithValues: false,
                        hideInfl: false,
                    },
                    text: '\\documentclass{article}\n\\begin{document}\nBeta line one.\n\nSecond paragraph line.\nThird paragraph line.\n\nDelete me line.\n\nGamma closing line.\n\\end{document}',
                },
            ],
            parameters: { roundStrategy: 'noRound' },
        },
        hunks: [
            {
                id: '14d876ef-b5bf-4d26-9ccf-5be1ea18e19f',
                type: 'replaceTextInSegment',
                fileName: null,
                segmentId: 1,
                startLine: 3,
                endLine: 3,
                text: 'Alpha line one.',
            },
        ],
        message:
            'Готово: в сегменте 1 строка `Alpha line one.` заменена на `Beta line one.`, документ успешно скомпилирован. Другие изменения не вносились.',
    },
];

/** Короткая метка события: имя инструмента у toolCall, иначе вид */
const label = (event: AgentEvent): string =>
    event.kind === 'toolCall' ? event.toolName : event.kind;

const isCompilation = (event: AgentEvent): boolean =>
    event.kind.startsWith('compilation');

/** Открывает сессию, шлёт кадры по одному и отдаёт всё, что дошло до onEvent */
const deliver = async (
    frames: object[],
    channel: 'project' | 'guest' = 'project'
): Promise<{ events: AgentEvent[]; socket: FakeWebSocket }> => {
    const handlers = makeHandlers();
    if (channel === 'guest') {
        new WebAgentSocket().startAgentUnauthorized(
            { ...PARAMS, program: PROGRAM },
            handlers
        );
    } else {
        new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    }
    const socket = lastSocket();
    socket.fireOpen();
    for (const frame of frames) {
        socket.fireMessage(frame);
    }
    // на каждое событие очередь тратит пару микрозадач
    await flush(100);
    return {
        events: handlers.onEvent.mock.calls.map((call) => call[0]),
        socket,
    };
};

const warnedAbout = (message: string) =>
    jest
        .mocked(logBreadcrumb)
        .mock.calls.some(
            ([category, text, , level]) =>
                category === 'agent' && text === message && level === 'warning'
        );

test('latex-run-from-preprod-delivers-the-compilation-between-tool-calls', async () => {
    const { events, socket } = await deliver(LATEX_RUN_FRAMES);

    expect(events.map(label)).toEqual([
        'modelFinished',
        'list_workspace',
        'modelFinished',
        'read_segment',
        'modelFinished',
        'replace_text_in_segment',
        'modelFinished',
        'compilationStarted',
        'compilationFinished',
        'modelFinished',
        'read_segment',
        'modelFinished',
        'done',
        'finished',
    ]);
    // "markdown": null у latex-проекта значит «нет», в событие null не попадает
    expect(events.filter(isCompilation)).toEqual([
        { kind: 'compilationStarted' },
        { kind: 'compilationFinished', pdfUri: LATEX_PDF },
    ]);
    expect(warnedAbout('compilation without result')).toBe(false);
    expect(socket.closeCodes).toEqual([1000]);
});

test('failed-compilation-from-preprod-keeps-the-run-going', async () => {
    const { events, socket } = await deliver(FAILED_COMPILATION_RUN_FRAMES);

    // после ошибки сборки агент ещё думает и зовёт done: сессия не должна закрыться
    expect(events.map(label)).toEqual([
        'modelFinished',
        'read_segment',
        'modelFinished',
        'replace_text_in_segment',
        'modelFinished',
        'compilationStarted',
        'compilationFailed',
        'modelFinished',
        'done',
        'finished',
    ]);
    expect(events.filter(isCompilation)).toEqual([
        { kind: 'compilationStarted' },
        {
            kind: 'compilationFailed',
            errors: { errors: [LATEX_ERROR], unfinishedPdfUri: UNFINISHED_PDF },
        },
    ]);
    expect(warnedAbout('bad compilation errors')).toBe(false);
    expect(socket.closeCodes).toEqual([1000]);
});

test('markdown-compilation-from-preprod-carries-the-segments', async () => {
    const { events } = await deliver(MARKDOWN_RUN_FRAMES);

    // "pdf": null у markdown-проекта тоже отсутствие, а не ссылка
    expect(events.filter(isCompilation)).toEqual([
        { kind: 'compilationStarted' },
        { kind: 'compilationFinished', markdown: MARKDOWN_RESULT },
    ]);
    expect(events.map(label).slice(-3)).toEqual([
        'modelFinished',
        'done',
        'finished',
    ]);
    expect(warnedAbout('compilation without result')).toBe(false);
});

test('guest-compilation-from-preprod-carries-the-pdf', async () => {
    const { events, socket } = await deliver(GUEST_RUN_FRAMES, 'guest');

    expect(events.filter(isCompilation)).toEqual([
        { kind: 'compilationStarted' },
        { kind: 'compilationFinished', pdfUri: GUEST_PDF },
    ]);
    expect(events[events.length - 1]).toMatchObject({
        kind: 'finished',
        stopReason: 'Done',
        hunks: [
            {
                type: 'replaceTextInSegment',
                segmentId: 1,
                startLine: 3,
                endLine: 3,
                text: 'Alpha line one.',
            },
        ],
    });
    expect(events).toHaveLength(GUEST_RUN_FRAMES.length);
    expect(socket.closeCodes).toEqual([1000]);
});

// кадр значит, что сборка была: без него прогон потерял бы сам факт компиляции
test.each([
    ['no-fields', {}],
    ['null-fields', { pdf: null, markdown: null }],
    ['a-pdf-without-a-link', { pdf: {}, markdown: null }],
    ['a-null-link', { pdf: { pdfUri: null } }],
    ['a-numeric-link', { pdf: { pdfUri: 42 } }],
    ['a-link-instead-of-an-object', { pdf: LATEX_PDF }],
    ['null-segments', { markdown: { segments: null } }],
    ['segments-as-an-object', { markdown: { segments: {} } }],
    ['markdown-as-a-list', { markdown: [] }],
])(
    'compilation-finished-with-%s-is-an-event-without-a-result',
    async (_case, fields) => {
        const { events } = await deliver([
            { type: 'compilationFinished', ...fields },
        ]);

        expect(events).toEqual([{ kind: 'compilationFinished' }]);
        // по спеке одно из полей есть всегда, нарушение должно остаться в следе
        expect(warnedAbout('compilation without result')).toBe(true);
    }
);

test.each([
    ['no-errors', {}],
    ['null-errors', { errors: null }],
    ['a-bare-list', { errors: [LATEX_ERROR] }],
    ['a-null-inner-list', { errors: { errors: null } }],
    ['an-object-inner-list', { errors: { errors: {} } }],
    ['a-string', { errors: 'Undefined control sequence.' }],
])(
    'compilation-failed-with-%s-gives-an-empty-list-and-a-warning',
    async (_case, fields) => {
        const { events } = await deliver([
            { type: 'compilationFailed', ...fields },
        ]);

        expect(events).toEqual([
            { kind: 'compilationFailed', errors: { errors: [] } },
        ]);
        expect(warnedAbout('bad compilation errors')).toBe(true);
    }
);

test.each([
    ['null', null],
    ['a-number', 42],
    ['missing', undefined],
])('unfinished-pdf-uri-as-%s-is-left-out', async (_case, unfinishedPdfUri) => {
    const { events } = await deliver([
        {
            type: 'compilationFailed',
            errors: { errors: [LATEX_ERROR], unfinishedPdfUri },
        },
    ]);

    expect(events).toEqual([
        { kind: 'compilationFailed', errors: { errors: [LATEX_ERROR] } },
    ]);
});

// недособранный pdf есть и без списка ошибок, терять его незачем
test('compilation-failed-with-a-broken-list-keeps-the-unfinished-pdf', async () => {
    const { events } = await deliver([
        {
            type: 'compilationFailed',
            errors: { errors: null, unfinishedPdfUri: UNFINISHED_PDF },
        },
    ]);

    expect(events).toEqual([
        {
            kind: 'compilationFailed',
            errors: { errors: [], unfinishedPdfUri: UNFINISHED_PDF },
        },
    ]);
});

test('compilation-events-wait-for-a-slow-tool-call', async () => {
    const log: string[] = [];
    let releaseToolCall = () => {};
    const toolCallDone = new Promise<void>((resolve) => {
        releaseToolCall = resolve;
    });
    const handlers = makeHandlers(async (event) => {
        const tag = label(event);
        log.push(`начало ${tag}`);
        // на toolCall сервис ждёт hunks из сети
        if (tag === 'replace_text_in_segment') {
            await toolCallDone;
        }
        log.push(`конец ${tag}`);
    });
    new WebAgentSocket().startAgent('project-42', PARAMS, handlers);
    const socket = lastSocket();
    socket.fireOpen();

    for (const frame of LATEX_RUN_FRAMES.slice(5, 9)) {
        socket.fireMessage(frame);
    }
    await flush();

    // результат сборки не должен лечь раньше, чем правка, которую он собрал
    expect(log).toEqual(['начало replace_text_in_segment']);

    releaseToolCall();
    await flush(100);

    expect(log).toEqual([
        'начало replace_text_in_segment',
        'конец replace_text_in_segment',
        'начало modelFinished',
        'конец modelFinished',
        'начало compilationStarted',
        'конец compilationStarted',
        'начало compilationFinished',
        'конец compilationFinished',
    ]);
});
