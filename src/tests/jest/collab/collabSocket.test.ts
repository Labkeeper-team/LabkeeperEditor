/**
 * WebSocket adapter of the collaboration channel: address, frame parsing, reconnect
 * with backoff, no retry on 1008, heartbeat.
 */
jest.mock('../../../constants.ts', () => {
    (globalThis as unknown as { __BUILD_INFO__: unknown }).__BUILD_INFO__ = {
        major: '4',
        minor: '0',
    };
    return jest.requireActual('../../../constants.ts');
});
jest.mock('../../../viewModel/utils/logBreadcrumb.ts', () => ({
    logBreadcrumb: jest.fn(),
}));
jest.mock('../../../viewModel/utils/reportUnexpectedError.ts', () => ({
    reportToSentry: jest.fn(),
}));

import {
    collabReconnectDelay,
    COLLAB_PING_INTERVAL_MS,
    COLLAB_RECONNECT_MAX_MS,
    parseCollabFrame,
    WebCollabSocket,
} from '../../../web/server/collabSocket.ts';

class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readyState = FakeWebSocket.CONNECTING;
    readonly sent: string[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onclose: ((event: { code: number }) => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(readonly url: string) {
        FakeWebSocket.instances.push(this);
    }

    send(data: string): void {
        this.sent.push(data);
    }

    close(): void {
        this.readyState = FakeWebSocket.CLOSED;
    }

    open(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    message(frame: object | string): void {
        this.onmessage?.({
            data: typeof frame === 'string' ? frame : JSON.stringify(frame),
        });
    }

    serverClose(code: number): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({ code });
    }
}

const last = () => FakeWebSocket.instances[FakeWebSocket.instances.length - 1];

beforeEach(() => {
    FakeWebSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket;
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

function handlers() {
    return {
        onOpen: jest.fn(),
        onFrame: jest.fn(),
        onClose: jest.fn(),
    };
}

test('connects to the collab channel of the project', () => {
    new WebCollabSocket().connect('p-1', handlers());
    expect(last().url).toBe('ws://localhost/api/v4/ws/project/p-1/collab');
});

test('parses known frames and drops anything else', () => {
    expect(parseCollabFrame('{"type":"pong","requestId":"x"}')).toEqual({
        type: 'pong',
        requestId: 'x',
    });
    expect(parseCollabFrame('not json')).toBeNull();
    expect(parseCollabFrame('[1,2]')).toBeNull();
    expect(parseCollabFrame('{"type":"somethingNew"}')).toBeNull();
    expect(parseCollabFrame(42)).toBeNull();

    const h = handlers();
    new WebCollabSocket().connect('p-1', h);
    last().open();
    last().message('garbage');
    last().message({ type: 'pong', requestId: 'p' });
    expect(h.onFrame).toHaveBeenCalledTimes(1);
});

test('reconnects with growing delays and stops on 1008', () => {
    const h = handlers();
    const connection = new WebCollabSocket().connect('p-1', h);
    last().serverClose(1006);
    expect(h.onClose).toHaveBeenLastCalledWith('closed', true);
    expect(FakeWebSocket.instances).toHaveLength(1);
    jest.advanceTimersByTime(COLLAB_RECONNECT_MAX_MS);
    expect(FakeWebSocket.instances).toHaveLength(2);
    last().serverClose(1011);
    jest.advanceTimersByTime(COLLAB_RECONNECT_MAX_MS);
    expect(FakeWebSocket.instances).toHaveLength(3);

    last().serverClose(1008);
    expect(h.onClose).toHaveBeenLastCalledWith('denied', false);
    jest.advanceTimersByTime(COLLAB_RECONNECT_MAX_MS * 4);
    expect(FakeWebSocket.instances).toHaveLength(3);
    expect(connection.isOpen()).toBe(false);
});

test('backoff doubles, is capped and jittered', () => {
    expect(collabReconnectDelay(1, () => 1)).toBe(500);
    expect(collabReconnectDelay(1, () => 0)).toBe(250);
    expect(collabReconnectDelay(3, () => 1)).toBe(2000);
    expect(collabReconnectDelay(20, () => 1)).toBe(COLLAB_RECONNECT_MAX_MS);
});

test('sends ping while open and nothing after close', () => {
    const connection = new WebCollabSocket().connect('p-1', handlers());
    last().open();
    jest.advanceTimersByTime(COLLAB_PING_INTERVAL_MS + 1);
    expect(last().sent.map((s) => JSON.parse(s).type)).toEqual(['ping']);
    connection.close();
    jest.advanceTimersByTime(COLLAB_PING_INTERVAL_MS * 3);
    expect(last().sent).toHaveLength(1);
    expect(connection.send({ type: 'ping', requestId: 'x' })).toBe(false);
});

test('a welcome with a short presence timeout pings at least every third of it', () => {
    new WebCollabSocket().connect('p-1', handlers());
    last().open();
    last().message({
        type: 'welcome',
        presenceTimeoutSeconds: 30,
        connectionId: 'c',
        segments: [],
    });
    jest.advanceTimersByTime(10_001);
    expect(last().sent.map((s) => JSON.parse(s).type)).toEqual(['ping']);
});
