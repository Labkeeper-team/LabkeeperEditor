import { AgentHistoryEntry } from '../../model/domain.ts';
import { ChatMessage } from '../repository';

/**
 * GH-189: что откатывается в агентском режиме.
 * last: перед новым запросом правки прошлого прогона принимаются сами, откатить можно только последний.
 * range: правки копятся, и откат уносит все прогоны с тех пор, как правок не было
 */
export type AgentCheckpointMode = 'last' | 'range';
export const AGENT_DEFAULT_CHECKPOINT_MODE: AgentCheckpointMode = 'last';

/**
 * Последняя запись истории на момент, когда правок агента в проекте не было.
 * Откат удаляет записи новее неё, а её саму оставляет. null в полях: истории
 * тогда не было вовсе, и откатываются все записи
 */
export type AgentCheckpointBase = {
    entryId: string | null;
    createdAt: string | null;
};

/** Сколько проектов помнит границу: старые вытесняются, чтобы localStorage не рос без конца */
export const AGENT_CHECKPOINT_PROJECTS_LIMIT = 50;

const entryTime = (createdAt: string | null): number => {
    if (createdAt === null) {
        return -Infinity;
    }
    const time = Date.parse(createdAt);
    return Number.isNaN(time) ? -Infinity : time;
};

/** Записи от старых к новым. Порядок ответа спека не задаёт, поэтому и лента, и откат идут по времени */
export function chronological(
    history: AgentHistoryEntry[]
): AgentHistoryEntry[] {
    return history
        .map((entry, index) => ({ entry, index }))
        .sort(
            (a, b) =>
                entryTime(a.entry.createdAt) - entryTime(b.entry.createdAt) ||
                a.index - b.index
        )
        .map(({ entry }) => entry);
}

/** Граница по текущей истории: её самая молодая запись */
export function checkpointBaseOf(
    history: AgentHistoryEntry[]
): AgentCheckpointBase {
    const sorted = chronological(history);
    const latest = sorted[sorted.length - 1];
    return latest
        ? { entryId: latest.id, createdAt: latest.createdAt }
        : { entryId: null, createdAt: null };
}

/**
 * Записи, которые уйдут при откате, от старых к новым. Без известной границы
 * берём одну последнюю: откат правок всё равно один на все, а удалить больше
 * записей, чем видно на экране, было бы хуже
 */
export function checkpointEntryIds(
    history: AgentHistoryEntry[],
    base: AgentCheckpointBase | undefined
): string[] {
    const sorted = chronological(history);
    if (!base) {
        const last = sorted[sorted.length - 1];
        return last ? [last.id] : [];
    }
    const baseTime = entryTime(base.createdAt);
    return sorted
        .filter(
            (entry) =>
                entry.id !== base.entryId &&
                entryTime(entry.createdAt) > baseTime
        )
        .map((entry) => entry.id);
}

/**
 * Свежие записи истории, которых лента ещё не знает, привязываются к запросам
 * ленты по тексту. Так запись, пришедшая после прогона, не рисуется второй раз
 * над тем же запросом, а у запроса появляется id для отката. Пары ищутся с
 * конца: повтор запроса после отказа, у которого записи нет, получает запись
 * своего прогона, а не неудачного. Идущий прогон записи ещё не имеет, его
 * запрос передаётся в pendingRequestId и не участвует
 */
export function linkHistoryToRequests(
    knownEntryIds: ReadonlySet<string>,
    history: AgentHistoryEntry[],
    messages: ChatMessage[],
    links: Readonly<Record<number, string>>,
    pendingRequestId: number | null = null
): Record<number, string> {
    const next = { ...links };
    const linkedEntries = new Set(Object.values(links));
    const pool = messages.filter(
        (message): message is Extract<ChatMessage, { kind: 'request' }> =>
            message.kind === 'request' &&
            next[message.id] === undefined &&
            message.id !== pendingRequestId
    );
    for (const entry of chronological(history).reverse()) {
        if (knownEntryIds.has(entry.id) || linkedEntries.has(entry.id)) {
            continue;
        }
        let index = pool.length - 1;
        while (index >= 0 && pool[index].text.trim() !== entry.request.trim()) {
            index -= 1;
        }
        if (index < 0) {
            continue;
        }
        next[pool[index].id] = entry.id;
        linkedEntries.add(entry.id);
        pool.splice(index, 1);
    }
    return next;
}

/**
 * С чего начинается подсвеченный кусок ленты: с записи истории или с запроса
 * текущей ленты. Всё, что ниже начала, входит в откат
 */
export type CheckpointStart =
    { kind: 'entry'; entryId: string } | { kind: 'request'; requestId: number };

export function checkpointStart({
    history,
    entryIds,
    links,
    messages,
    fromRequestId,
}: {
    history: AgentHistoryEntry[];
    entryIds: string[];
    links: Readonly<Record<number, string>>;
    messages: ChatMessage[];
    /** Запрос этой вкладки, отправленный, когда правок не было */
    fromRequestId: number | null;
}): CheckpointStart | null {
    const inRange = new Set(entryIds);
    const linkedEntries = new Set(Object.values(links));
    // записи истории рисуются выше ленты по времени, поэтому первая из них и есть начало
    const firstEntry = chronological(history).find(
        (entry) => inRange.has(entry.id) && !linkedEntries.has(entry.id)
    );
    if (firstEntry) {
        return { kind: 'entry', entryId: firstEntry.id };
    }
    const firstRequest = messages.find(
        (message) =>
            message.kind === 'request' &&
            ((links[message.id] !== undefined &&
                inRange.has(links[message.id])) ||
                message.id === fromRequestId)
    );
    return firstRequest
        ? { kind: 'request', requestId: firstRequest.id }
        : null;
}

/** Запросы ленты, которые откат уносит вместе с их шагами и ответами */
export function requestIdsFrom(
    messages: ChatMessage[],
    start: CheckpointStart | null
): number[] {
    if (!start) {
        return [];
    }
    const requests = messages.filter((message) => message.kind === 'request');
    if (start.kind === 'entry') {
        return requests.map((message) => message.id);
    }
    const index = requests.findIndex(
        (message) => message.id === start.requestId
    );
    return index < 0 ? [] : requests.slice(index).map((message) => message.id);
}

/** Лента без указанных прогонов: запрос уходит вместе со всем, что шло после него до следующего запроса */
export function withoutRuns(
    messages: ChatMessage[],
    requestIds: number[]
): ChatMessage[] {
    const drop = new Set(requestIds);
    let dropping = false;
    return messages.filter((message) => {
        if (message.kind === 'request') {
            dropping = drop.has(message.id);
        }
        return !dropping;
    });
}

/**
 * Привязки только тех запросов, что ещё в ленте. Запись, чей запрос ушёл из
 * ленты (откат, очистка), снова рисуется сама по себе
 */
export function liveLinks(
    messages: ChatMessage[],
    links: Readonly<Record<number, string>>
): Record<number, string> {
    const live: Record<number, string> = {};
    for (const message of messages) {
        if (message.kind === 'request' && links[message.id] !== undefined) {
            live[message.id] = links[message.id];
        }
    }
    return live;
}

/** Что сейчас откатывается и где это видно в ленте. null: правок агента нет, и откатывать нечего */
export type AgentCheckpointView = {
    /** Записи истории, которые откат удалит на сервере */
    entryIds: string[];
    start: CheckpointStart | null;
    /** Прогоны текущей ленты, которые откат уберёт с экрана */
    requestIds: number[];
};

export function agentCheckpointView({
    hunkCount,
    authenticated,
    history,
    links,
    messages,
    fromRequestId,
    base,
}: {
    hunkCount: number;
    authenticated: boolean;
    history: AgentHistoryEntry[];
    links: Readonly<Record<number, string>>;
    messages: ChatMessage[];
    fromRequestId: number | null;
    base: AgentCheckpointBase | undefined;
}): AgentCheckpointView | null {
    if (hunkCount === 0) {
        return null;
    }
    // у гостя истории на сервере нет, и границу задаёт только запрос этой вкладки
    const entryIds = authenticated ? checkpointEntryIds(history, base) : [];
    const start = checkpointStart({
        history,
        entryIds,
        links: liveLinks(messages, links),
        messages,
        fromRequestId,
    });
    return { entryIds, start, requestIds: requestIdsFrom(messages, start) };
}
