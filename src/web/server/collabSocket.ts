import {
    CollabClientFrame,
    CollabConnection,
    CollabConnectionHandlers,
    CollabServerFrame,
    CollabSocket,
} from '../../model/rpi/collabSocket.ts';
import { wsUrl, WS_URLS } from '../../constants.ts';
import { withSessionQuery } from '../session.ts';
import { logBreadcrumb } from '../../viewModel/utils/logBreadcrumb.ts';
import { reportToSentry } from '../../viewModel/utils/reportUnexpectedError.ts';

/** First reconnect delay; doubles on every failed attempt */
export const COLLAB_RECONNECT_BASE_MS = 500;
/** Upper bound of the reconnect delay */
export const COLLAB_RECONNECT_MAX_MS = 30_000;
/** Heartbeat of the reference client (asyncapi CollabPingSpec) */
export const COLLAB_PING_INTERVAL_MS = 20_000;
/** Close code of access denied or unknown project: never retried */
export const COLLAB_CLOSE_DENIED = 1008;

const SERVER_FRAME_TYPES = new Set<string>([
    'welcome',
    'documentOpened',
    'documentResumed',
    'documentUpdates',
    'pushAccepted',
    'pushRejected',
    'reloadRequired',
    'segmentsChanged',
    'commandAccepted',
    'commandRejected',
    'filesChanged',
    'projectLockChanged',
    'presenceChanged',
    'participantsChanged',
    'collabError',
    'pong',
]);

/**
 * Parses one server frame defensively: anything that is not a JSON object with a
 * known `type` is dropped. Required fields are checked by the consumers, which read
 * every field with a type guard.
 */
export function parseCollabFrame(raw: unknown): CollabServerFrame | null {
    if (typeof raw !== 'string') {
        return null;
    }
    let value: unknown;
    try {
        value = JSON.parse(raw);
    } catch {
        return null;
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const type = (value as { type?: unknown }).type;
    if (typeof type !== 'string' || !SERVER_FRAME_TYPES.has(type)) {
        return null;
    }
    return value as CollabServerFrame;
}

/** Exponential backoff with full jitter: random in [delay/2, delay] */
export function collabReconnectDelay(
    attempt: number,
    random: () => number = Math.random
): number {
    const exp = Math.min(
        COLLAB_RECONNECT_MAX_MS,
        COLLAB_RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1)
    );
    return Math.round(exp / 2 + (random() * exp) / 2);
}

/**
 * One collaboration connection of a project. Reconnects by itself with exponential
 * backoff and jitter on every close except 1008, and sends `ping` while open.
 */
class WebCollabConnection implements CollabConnection {
    private socket: WebSocket | null = null;
    private closedForGood = false;
    private attempt = 0;
    private retryTimer: ReturnType<typeof setTimeout> | undefined;
    private pingTimer: ReturnType<typeof setInterval> | undefined;
    private pingCounter = 0;
    private onOnline = () => {
        // the network is back: do not wait for the rest of a long backoff
        if (!this.closedForGood && !this.socket && this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = undefined;
            this.open();
        }
    };

    constructor(
        private url: string,
        private handlers: CollabConnectionHandlers
    ) {
        if (typeof window !== 'undefined') {
            window.addEventListener('online', this.onOnline);
        }
        this.open();
    }

    private open(): void {
        if (this.closedForGood) {
            return;
        }
        this.attempt += 1;
        let created: WebSocket;
        try {
            logBreadcrumb('collab', 'connect', { attempt: this.attempt });
            created = new WebSocket(withSessionQuery(this.url));
        } catch (error) {
            // the browser rejected the address itself: a code bug, not the network
            reportToSentry('collab.socket_create', error);
            this.closedForGood = true;
            queueMicrotask(() => this.handlers.onClose('closed', false));
            return;
        }
        this.socket = created;
        created.onopen = () => {
            logBreadcrumb('collab', 'open', { attempt: this.attempt });
            this.startPing(COLLAB_PING_INTERVAL_MS);
            this.handlers.onOpen();
        };
        created.onmessage = (event: MessageEvent) => {
            const frame = parseCollabFrame(event.data);
            if (!frame) {
                logBreadcrumb('collab', 'bad frame', undefined, 'warning');
                return;
            }
            if (frame.type === 'welcome') {
                // a successful handshake resets the backoff
                this.attempt = 0;
                const timeout = Number(frame.presenceTimeoutSeconds);
                if (Number.isFinite(timeout) && timeout > 0) {
                    this.startPing(
                        Math.min(COLLAB_PING_INTERVAL_MS, (timeout * 1000) / 3)
                    );
                }
            }
            this.handlers.onFrame(frame);
        };
        created.onerror = () => {
            // close always follows error; the reconnect is decided there
        };
        created.onclose = (event: CloseEvent) => this.onGone(event.code);
    }

    private startPing(intervalMs: number): void {
        clearInterval(this.pingTimer);
        this.pingTimer = setInterval(() => {
            this.pingCounter += 1;
            this.send({ type: 'ping', requestId: `ping-${this.pingCounter}` });
        }, intervalMs);
    }

    private detach(): void {
        clearInterval(this.pingTimer);
        this.pingTimer = undefined;
        const socket = this.socket;
        this.socket = null;
        if (!socket) {
            return;
        }
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        if (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        ) {
            socket.close(1000);
        }
    }

    private onGone(code: number): void {
        this.detach();
        if (this.closedForGood) {
            return;
        }
        if (code === COLLAB_CLOSE_DENIED) {
            logBreadcrumb('collab', 'denied', { code }, 'warning');
            this.closedForGood = true;
            this.removeListeners();
            this.handlers.onClose('denied', false);
            return;
        }
        const delay = collabReconnectDelay(this.attempt + 1);
        logBreadcrumb('collab', 'closed, retry', { code, delay }, 'warning');
        this.handlers.onClose('closed', true);
        this.retryTimer = setTimeout(() => {
            this.retryTimer = undefined;
            this.open();
        }, delay);
    }

    private removeListeners(): void {
        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.onOnline);
        }
    }

    send = (frame: CollabClientFrame): boolean => {
        const socket = this.socket;
        if (!socket || socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        socket.send(JSON.stringify(frame));
        return true;
    };

    isOpen = (): boolean => this.socket?.readyState === WebSocket.OPEN;

    close = (): void => {
        if (this.closedForGood) {
            return;
        }
        this.closedForGood = true;
        clearTimeout(this.retryTimer);
        this.removeListeners();
        this.detach();
        logBreadcrumb('collab', 'closed by client');
    };
}

export class WebCollabSocket implements CollabSocket {
    connect(
        projectId: string,
        handlers: CollabConnectionHandlers
    ): CollabConnection {
        return new WebCollabConnection(
            wsUrl(WS_URLS.projectCollab.replace('{id}', projectId)),
            handlers
        );
    }
}
