import { Hunk } from '../../model/domain.ts';
import { AgentToolName } from '../../model/rpi/agentSocket.ts';
import { AgentChangeSummary, ChatMessage } from '../repository';

type EventMessage = Extract<ChatMessage, { kind: 'event' }>;
export type AgentEventDraft = Omit<EventMessage, 'id'>;

// имена инструментов и типы hunk приходят с сервера как есть, поэтому Set и Map: объект по 'constructor' нашёл бы функцию

/** Инструменты, которые только читают проект и не порождают hunks. Подпись совпадает с именем */
const READ_ONLY_TOOLS = new Set<string>([
    'list_workspace',
    'read_segment',
    'read_segments',
    'search_segments',
    'read_file',
    'done',
] satisfies AgentToolName[]);

const HUNK_LABELS = new Map<string, string>([
    ['addSegment', 'add_segment'],
    ['addLinesToSegment', 'add_lines_to_segment'],
    ['deleteLinesFromSegment', 'delete_lines_from_segment'],
    ['addFile', 'add_file'],
    ['addLinesToFile', 'add_lines_to_file'],
    ['deleteLinesFromFile', 'delete_lines_from_file'],
]);

const SEGMENT_TOOLS = new Set<string>([
    'add_segment',
    'add_lines_to_segment',
    'delete_lines_from_segment',
] satisfies AgentToolName[]);

const FILE_TOOLS = new Set<string>([
    'add_file',
    'add_lines_to_file',
    'delete_lines_from_file',
] satisfies AgentToolName[]);

/** Общая строка ленты для инструмента, о котором фронт ничего не знает */
const UNKNOWN_TOOL_LABEL = 'unknown_tool';

const isKnownTool = (toolName: string) =>
    READ_ONLY_TOOLS.has(toolName) ||
    SEGMENT_TOOLS.has(toolName) ||
    FILE_TOOLS.has(toolName);

/** Незнакомую правку назвать нечем, поэтому подписываем её местом, как правку строк */
function unknownHunkLabel(hunk: Hunk): string {
    if (hunk.segmentId != null) {
        return 'add_lines_to_segment';
    }
    return hunk.fileName ? 'add_lines_to_file' : UNKNOWN_TOOL_LABEL;
}

const lineSpan = (hunk: Hunk) =>
    hunk.startLine == null
        ? null
        : (hunk.endLine ?? hunk.startLine) - hunk.startLine;

/** Та же ли это правка. Сдвиг из-за правки выше не в счёт: сам hunk никто не трогал */
const isSameChange = (a: Hunk, b: Hunk) =>
    a.type === b.type &&
    a.segmentId === b.segmentId &&
    a.fileName === b.fileName &&
    a.text === b.text &&
    lineSpan(a) === lineSpan(b);

/** Сколько мест перечисляем в итоге прерывания: остальное человек найдёт в самой ленте */
const CHANGE_SUMMARY_LIMIT = 5;

/** Типы, к которым осмысленно скроллить: удалённых строк на месте уже нет. */
const NAVIGABLE_HUNK_TYPES = new Set([
    'addSegment',
    'addLinesToSegment',
    'addFile',
    'addLinesToFile',
]);

function formatLines(hunk: Hunk): string | undefined {
    const { startLine, endLine, type } = hunk;
    if (startLine == null) {
        return undefined;
    }
    const isDelete =
        type === 'deleteLinesFromFile' || type === 'deleteLinesFromSegment';
    if (endLine == null || endLine === startLine) {
        return `#L${startLine}`;
    }
    // удаление в макете перечислением, добавление диапазоном
    return isDelete
        ? `#L${startLine}, #${endLine}`
        : `#L${startLine}-${endLine}`;
}

export class AgentEventService {
    /**
     * Hunks, которые вызов добавил или поменял, в исходном порядке. Повторную
     * правку того же места сервер дописывает в прежний hunk с тем же id
     */
    changedHunks(previous: Hunk[], next: Hunk[]): Hunk[] {
        const known = new Map(previous.map((hunk) => [hunk.id, hunk]));
        return next.filter((hunk) => {
            const before = known.get(hunk.id);
            return !before || !isSameChange(before, hunk);
        });
    }

    /**
     * Строки ленты для одного toolCall. Само событие несёт только имя инструмента,
     * поэтому детали (файл, сегмент, диапазон строк) берём из свежих hunks.
     */
    describeToolCall(toolName: string, fresh: Hunk[]): AgentEventDraft[] {
        if (READ_ONLY_TOOLS.has(toolName)) {
            return [{ kind: 'event', labelKey: toolName }];
        }
        if (fresh.length === 0) {
            // инструмент пишущий, но hunks не приехали (упал запрос либо неавторизованный):
            // показываем сам факт вызова отдельным текстом, без имени файла и номера сегмента
            const labelKey = isKnownTool(toolName)
                ? `${toolName}_plain`
                : UNKNOWN_TOOL_LABEL;
            return [{ kind: 'event', labelKey }];
        }
        return fresh.map((hunk) => this.describeHunk(hunk));
    }

    describeHunk(hunk: Hunk): AgentEventDraft {
        return {
            kind: 'event',
            labelKey: HUNK_LABELS.get(hunk.type) ?? unknownHunkLabel(hunk),
            file: hunk.fileName,
            segmentId: hunk.segmentId,
            lines: formatLines(hunk),
            target: this.navigationTarget(hunk),
        };
    }

    /**
     * Короткий список мест, которые агент успел поправить: по строке на цель,
     * в порядке первого появления. Счётчиков правок в строках нет, иначе
     * понадобились бы склонения на двух языках, а лента и так перечисляет каждую
     */
    describeChanges(
        hunks: Hunk[],
        limit: number = CHANGE_SUMMARY_LIMIT
    ): AgentChangeSummary[] {
        const targets = new Map<string, AgentChangeSummary>();
        for (const hunk of hunks) {
            if (hunk.segmentId != null) {
                targets.set(`segment:${hunk.segmentId}`, {
                    labelKey: 'segment',
                    segmentId: hunk.segmentId,
                });
            } else if (hunk.fileName) {
                targets.set(`file:${hunk.fileName}`, {
                    labelKey: 'file',
                    file: hunk.fileName,
                });
            } else {
                // место назвать нечем, но умолчать о правке нельзя: список бы соврал
                targets.set('other', { labelKey: 'other' });
            }
        }
        const list = [...targets.values()];
        return list.length > limit
            ? [...list.slice(0, limit), { labelKey: 'more' }]
            : list;
    }

    describeModelCall(): AgentEventDraft {
        return { kind: 'event', labelKey: 'model_call' };
    }

    /** Куда прокрутить редактор. undefined, если прыгать некуда. */
    navigationTarget(hunk: Hunk): EventMessage['target'] {
        if (!NAVIGABLE_HUNK_TYPES.has(hunk.type)) {
            return undefined;
        }
        const line = hunk.startLine ?? 1;
        if (hunk.fileName) {
            // focus: false, иначе редактор украдёт фокус из поля промпта
            return {
                segmentIndex: -1,
                line,
                file: hunk.fileName,
                focus: false,
            };
        }
        if (hunk.segmentId == null) {
            return undefined;
        }
        return { segmentIndex: hunk.segmentId - 1, line, focus: false };
    }

    /** Первая цель среди свежих hunks: прыгать по всем бессмысленно. */
    firstNavigationTarget(fresh: Hunk[]): EventMessage['target'] {
        for (const hunk of fresh) {
            const target = this.navigationTarget(hunk);
            if (target) {
                return target;
            }
        }
        return undefined;
    }

    /** Последняя цель среди свежих hunks: туда агент правил позже всего */
    lastNavigationTarget(fresh: Hunk[]): EventMessage['target'] {
        return this.firstNavigationTarget([...fresh].reverse());
    }

    /**
     * Что перечитать после вызова. Пишущий инструмент меняет проект, даже если
     * hunks не поменялись: агент мог убрать то, что сам добавил. Незнакомый
     * инструмент мог поменять что угодно, поэтому после него перечитываем всё
     */
    reloadScope(
        toolName: string,
        fresh: Hunk[]
    ): { program: boolean; files: boolean } {
        const unknown = !isKnownTool(toolName);
        let program = unknown || SEGMENT_TOOLS.has(toolName);
        let files = unknown || FILE_TOOLS.has(toolName);
        for (const hunk of fresh) {
            if (
                hunk.type === 'addSegment' ||
                hunk.type === 'addLinesToSegment' ||
                hunk.type === 'deleteLinesFromSegment'
            ) {
                program = true;
            }
            if (
                hunk.type === 'addFile' ||
                hunk.type === 'addLinesToFile' ||
                hunk.type === 'deleteLinesFromFile'
            ) {
                files = true;
            }
        }
        return { program, files };
    }
}
