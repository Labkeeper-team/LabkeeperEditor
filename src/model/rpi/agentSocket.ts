import { Hunk, Program } from '../domain.ts';

/**
 * Общий срок на прогон: столько ждём финальное событие с момента запуска.
 * Серверный срок больше, и с коротким фронт рубил соединение агенту, который
 * просто долго думает. С этим числом связаны ещё два места: текст stop.timeout
 * в обоих словарях и proxy_read_timeout в конфигах nginx, править вместе.
 */
export const AGENT_TIMEOUT_MS = 10 * 60 * 1000;

/** Значения из макета: Context Size и Max Iterations. Первое в списке — по умолчанию. */
export const AGENT_TOKEN_OPTIONS = [10000, 30000, 100000];
export const AGENT_ITERATION_OPTIONS = [5, 12, 20];

/** Почему агент остановился. Совпадает с AgentStopReason из asyncapi. */
export type AgentStopReason =
    | 'Done'
    | 'ContextOverflow'
    | 'IterationLimit'
    | 'Timeout'
    | 'UnauthorizedLimitExceeded'
    | 'PaymentRequired'
    | 'Locked'
    | 'UnknownError';

export const AGENT_STOP_REASONS: AgentStopReason[] = [
    'Done',
    'ContextOverflow',
    'IterationLimit',
    'Timeout',
    'UnauthorizedLimitExceeded',
    'PaymentRequired',
    'Locked',
    'UnknownError',
];

/** Инструменты агента. Совпадает с enum toolName из AgentToolCallSpec. */
export type AgentToolName =
    | 'list_workspace'
    | 'read_segment'
    | 'read_segments'
    | 'search_segments'
    | 'read_file'
    | 'add_segment'
    | 'add_lines_to_segment'
    | 'delete_lines_from_segment'
    | 'add_file'
    | 'add_lines_to_file'
    | 'delete_lines_from_file'
    | 'done';

export type AgentEvent =
    | { kind: 'modelFinished'; totalTokens: number; elapsedTimeMillis: number }
    | { kind: 'toolCall'; toolName: AgentToolName }
    | {
          kind: 'finished';
          message: string | null;
          stopReason: AgentStopReason;
          /** Только у неавторизованного: программа приезжает в финальном событии */
          program?: Program;
          /** Только у неавторизованного: hunks приезжают одним куском */
          hunks?: Hunk[];
      };

/**
 * Почему сессия закончилась без финального события.
 * `timeout` — финальное событие не пришло за отведённый срок,
 * `closed` — сервер закрыл соединение раньше времени,
 * `connect_failed` — соединение не удалось установить вовсе.
 */
export type AgentClosedReason = 'timeout' | 'closed' | 'connect_failed';

export interface AgentHandlers {
    /** Обработка события может быть асинхронной: на toolCall подтягиваются hunks */
    onEvent: (event: AgentEvent) => void | Promise<void>;
    onClosed: (reason: AgentClosedReason) => void;
}

export interface AgentSessionParams {
    prompt: string;
    numberIterations: number;
    maxTokens: number;
}

export interface AgentSession {
    /** Закрыть соединение и снять таймер. Идемпотентно. */
    close(): void;
}

/**
 * Порт агента. Отдельно от Rpi, потому что это не запрос-ответ, а поток событий.
 * Реализация живёт в web/server, viewModel про WebSocket ничего не знает.
 */
export interface AgentSocket {
    startAgent(
        projectId: string,
        params: AgentSessionParams,
        handlers: AgentHandlers
    ): AgentSession;

    startAgentUnauthorized(
        params: AgentSessionParams & { program: Program },
        handlers: AgentHandlers
    ): AgentSession;
}
