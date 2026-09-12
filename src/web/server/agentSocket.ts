import { Program } from '../../model/domain.ts';
import {
    AgentClosedReason,
    AgentEvent,
    AgentHandlers,
    AgentSession,
    AgentSessionParams,
    AgentSocket,
    AgentStopReason,
    AgentToolName,
    AGENT_STOP_REASONS,
    AGENT_TIMEOUT_MS,
} from '../../model/rpi/agentSocket.ts';
import { Hunk } from '../../model/domain.ts';
import { wsUrl, WS_URLS } from '../../constants.ts';
import { withSegmentIds } from '../../viewModel/utils/segmentId.ts';
import { logBreadcrumb } from '../../viewModel/utils/logBreadcrumb.ts';

type ServerFrame = {
    type?: string;
    totalTokens?: number;
    elapsedTimeMillis?: number;
    toolName?: AgentToolName;
    message?: string | null;
    stopReason?: AgentStopReason;
    program?: Program;
    hunks?: Hunk[];
};

/**
 * Причина, которой фронт не знает, считается ошибкой. Иначе новая причина с
 * сервера молча прошла бы как успех, а гостю применилась бы программа
 */
function toStopReason(value: unknown): AgentStopReason {
    if (AGENT_STOP_REASONS.includes(value as AgentStopReason)) {
        return value as AgentStopReason;
    }
    if (value != null) {
        logBreadcrumb(
            'agent',
            'unknown stop reason',
            { stopReason: String(value) },
            'warning'
        );
    }
    return 'UnknownError';
}

/** Превращает кадр сервера в событие домена. Неизвестный тип отбрасывается. */
function toEvent(frame: ServerFrame): AgentEvent | null {
    switch (frame.type) {
        case 'modelFinished':
            return {
                kind: 'modelFinished',
                totalTokens: Number(frame.totalTokens ?? 0),
                elapsedTimeMillis: Number(frame.elapsedTimeMillis ?? 0),
            };
        case 'toolCall':
            return frame.toolName
                ? { kind: 'toolCall', toolName: frame.toolName }
                : null;
        case 'agentFinished':
        case 'agentFinishedUnauthorized':
            return {
                kind: 'finished',
                message: frame.message ?? null,
                stopReason: toStopReason(frame.stopReason),
                program: frame.program,
                hunks: frame.hunks,
            };
        default:
            return null;
    }
}

/**
 * Одна сессия агента поверх WebSocket.
 * Завершиться можно четырьмя способами: финальным событием, таймаутом, обрывом и ошибкой.
 * Все они сходятся в settle(), иначе получим либо двойное завершение,
 * либо навсегда висящий чат в состоянии загрузки.
 */
function openSession(
    url: string,
    startFrame: object,
    handlers: AgentHandlers,
    timeoutMs: number
): AgentSession {
    let settled = false;
    let opened = false;
    // после закрытия сессии очередь не должна дописывать события: смена проекта
    // гасит сокет, а висящий в очереди обработчик написал бы уже в чужую ленту
    let cancelled = false;
    let socket: WebSocket;
    // события обрабатываются асинхронно (на toolCall уходит запрос за hunks),
    // поэтому очередь, иначе финальный ответ обгонит строки ленты
    let queue: Promise<void> = Promise.resolve();

    const timer = setTimeout(() => settle('timeout'), timeoutMs);

    function settle(reason?: AgentClosedReason): void {
        if (settled) {
            return;
        }
        settled = true;
        if (reason) {
            cancelled = true;
        }
        logBreadcrumb(
            'agent',
            reason ? `closed ${reason}` : cancelled ? 'cancelled' : 'finished',
            {
                reason: reason ?? (cancelled ? 'cancelled' : 'finished'),
                opened,
            },
            reason && reason !== 'timeout' ? 'warning' : 'info'
        );
        clearTimeout(timer);
        if (socket) {
            socket.onopen = null;
            socket.onmessage = null;
            socket.onclose = null;
            socket.onerror = null;
            if (
                socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING
            ) {
                socket.close(1000);
            }
        }
        if (reason) {
            handlers.onClosed(reason);
        }
    }

    try {
        logBreadcrumb('agent', 'connect', { url });
        socket = new WebSocket(url);
    } catch {
        clearTimeout(timer);
        settled = true;
        cancelled = true;
        logBreadcrumb('agent', 'connect_failed', { url }, 'error');
        // отложенно: вызывающий ещё не получил сессию, и сброс session
        // внутри onClosed был бы тут же перезатёрт присваиванием
        queueMicrotask(() => handlers.onClosed('connect_failed'));
        return { close: () => {} };
    }

    socket.onopen = () => {
        opened = true;
        logBreadcrumb('agent', 'open', { url });
        socket.send(JSON.stringify(startFrame));
    };

    const enqueue = (event: AgentEvent) => {
        queue = queue
            .then(() => (cancelled ? undefined : handlers.onEvent(event)))
            .catch(() => {});
    };

    socket.onmessage = (raw) => {
        let frame: ServerFrame;
        try {
            frame = JSON.parse(String(raw.data));
        } catch {
            logBreadcrumb('agent', 'bad frame', undefined, 'warning');
            return;
        }
        const event = toEvent(frame);
        if (!event) {
            logBreadcrumb(
                'agent',
                `ignored frame ${String(frame.type ?? 'unknown')}`,
                { type: frame.type },
                'debug'
            );
            return;
        }
        logBreadcrumb('agent', `event ${event.kind}`, {
            kind: event.kind,
            ...(event.kind === 'toolCall' ? { toolName: event.toolName } : {}),
            ...(event.kind === 'finished'
                ? { stopReason: event.stopReason }
                : {}),
        });
        if (event.kind === 'finished') {
            // по ТЗ соединение живёт ровно один запрос: гасим его сами, не ждём сервер
            settle();
        }
        enqueue(event);
    };

    socket.onerror = () => settle(opened ? 'closed' : 'connect_failed');
    socket.onclose = () => settle(opened ? 'closed' : 'connect_failed');

    return {
        close: () => {
            cancelled = true;
            settle();
        },
    };
}

export class WebAgentSocket implements AgentSocket {
    constructor(private timeoutMs: number = AGENT_TIMEOUT_MS) {}

    startAgent(
        projectId: string,
        params: AgentSessionParams,
        handlers: AgentHandlers
    ): AgentSession {
        return openSession(
            wsUrl(WS_URLS.projectAgent.replace('{id}', projectId)),
            { type: 'startAgent', ...params },
            handlers,
            this.timeoutMs
        );
    }

    startAgentUnauthorized(
        params: AgentSessionParams & { program: Program },
        handlers: AgentHandlers
    ): AgentSession {
        return openSession(
            wsUrl(WS_URLS.unauthorizedAgent),
            {
                type: 'startAgentUnauthorized',
                ...params,
                // без id сегментов сервер не сопоставит hunks
                program: withSegmentIds(params.program),
            },
            handlers,
            this.timeoutMs
        );
    }
}
