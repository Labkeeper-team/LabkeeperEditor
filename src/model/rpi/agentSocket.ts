import { Hunk, Program } from '../domain.ts';

/**
 * Общий срок на прогон: столько ждём финальное событие с момента запуска.
 * Серверный срок больше, и с коротким фронт рубил соединение агенту, который
 * просто долго думает. С этим числом связаны ещё три места: тексты stop.timeout
 * и guest_login_hint_limit в обоих словарях и proxy_read_timeout в конфигах
 * nginx, править вместе.
 */
export const AGENT_TIMEOUT_MS = 10 * 60 * 1000;

/** Значения из макета: Context Size и Max Iterations */
export const AGENT_TOKEN_OPTIONS = [10000, 30000, 100000];
export const AGENT_ITERATION_OPTIONS = [5, 12, 20];
/** По умолчанию наибольшие из списков, так решил заказчик. Сохранённые раньше переписывает миграция persistence */
export const AGENT_DEFAULT_MAX_TOKENS = 100000;
export const AGENT_DEFAULT_ITERATIONS = 20;

/** Почему агент остановился. Совпадает с AgentStopReason из asyncapi. */
export type AgentStopReason =
    | 'Done'
    | 'ContextOverflow'
    | 'IterationLimit'
    | 'Timeout'
    | 'UnauthorizedLimitExceeded'
    | 'PaymentRequired'
    | 'Locked'
    /** Текст запроса длиннее допустимого, прогона не было */
    | 'PromptTooLong'
    /** Агент попытался превысить лимит файла или сегментов, его остановили, сделанное сохранено */
    | 'QuotaExceeded'
    | 'UnknownError';

export const AGENT_STOP_REASONS: AgentStopReason[] = [
    'Done',
    'ContextOverflow',
    'IterationLimit',
    'Timeout',
    'UnauthorizedLimitExceeded',
    'PaymentRequired',
    'Locked',
    'PromptTooLong',
    'QuotaExceeded',
    'UnknownError',
];

/** Инструменты агента, которые знает фронт: это enum toolName из AgentToolCallSpec, но сервер добавляет новые раньше, чем обновится фронт */
export const AGENT_TOOL_NAMES = [
    'list_workspace',
    'read_segment',
    'read_segments',
    'search_segments',
    'read_file',
    'add_segment',
    'add_lines_to_segment',
    'delete_lines_from_segment',
    'add_file',
    'add_lines_to_file',
    'delete_lines_from_file',
    'done',
] as const;

export type AgentToolName = (typeof AGENT_TOOL_NAMES)[number];

export type AgentEvent =
    | { kind: 'modelFinished'; totalTokens: number; elapsedTimeMillis: number }
    /** Имя любое, в том числе пустое: незнакомый инструмент тоже мог поменять проект */
    | { kind: 'toolCall'; toolName: string }
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
