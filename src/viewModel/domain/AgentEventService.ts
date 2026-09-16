import { Hunk } from '../../model/domain.ts';
import { AgentToolName } from '../../model/rpi/agentSocket.ts';
import { ChatMessage } from '../repository';

type EventMessage = Extract<ChatMessage, { kind: 'event' }>;
export type AgentEventDraft = Omit<EventMessage, 'id'>;

/** Инструменты, которые только читают проект и не порождают hunks. */
const READ_ONLY_TOOL_LABELS: Partial<Record<AgentToolName, string>> = {
    list_workspace: 'list_workspace',
    read_segment: 'read_segment',
    read_segments: 'read_segments',
    search_segments: 'search_segments',
    read_file: 'read_file',
    done: 'done',
};

const HUNK_LABELS = {
    addSegment: 'add_segment',
    addLinesToSegment: 'add_lines_to_segment',
    deleteLinesFromSegment: 'delete_lines_from_segment',
    addFile: 'add_file',
    addLinesToFile: 'add_lines_to_file',
    deleteLinesFromFile: 'delete_lines_from_file',
} as const;

const SEGMENT_TOOLS = new Set<AgentToolName>([
    'add_segment',
    'add_lines_to_segment',
    'delete_lines_from_segment',
]);

const FILE_TOOLS = new Set<AgentToolName>([
    'add_file',
    'add_lines_to_file',
    'delete_lines_from_file',
]);

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
    describeToolCall(
        toolName: AgentToolName,
        fresh: Hunk[]
    ): AgentEventDraft[] {
        const readOnlyLabel = READ_ONLY_TOOL_LABELS[toolName];
        if (readOnlyLabel) {
            return [{ kind: 'event', labelKey: readOnlyLabel }];
        }
        if (fresh.length === 0) {
            // инструмент пишущий, но hunks не приехали (упал запрос либо неавторизованный):
            // показываем сам факт вызова отдельным текстом, без имени файла и номера сегмента
            return [{ kind: 'event', labelKey: `${toolName}_plain` }];
        }
        return fresh.map((hunk) => this.describeHunk(hunk));
    }

    describeHunk(hunk: Hunk): AgentEventDraft {
        const labelKey = HUNK_LABELS[hunk.type as keyof typeof HUNK_LABELS];
        return {
            kind: 'event',
            labelKey: labelKey ?? 'done',
            file: hunk.fileName,
            segmentId: hunk.segmentId,
            lines: formatLines(hunk),
            target: this.navigationTarget(hunk),
        };
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
     * hunks не поменялись: агент мог убрать то, что сам добавил
     */
    reloadScope(
        toolName: AgentToolName,
        fresh: Hunk[]
    ): { program: boolean; files: boolean } {
        let program = SEGMENT_TOOLS.has(toolName);
        let files = FILE_TOOLS.has(toolName);
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
