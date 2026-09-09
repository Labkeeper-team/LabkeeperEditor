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
    /** Новые hunks относительно уже известных, в исходном порядке. */
    newHunks(previous: Hunk[], next: Hunk[]): Hunk[] {
        const known = new Set(previous.map((hunk) => hunk.id));
        return next.filter((hunk) => !known.has(hunk.id));
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

    /** Нужно ли перезагружать программу и файлы после этой пачки hunks. */
    reloadScope(fresh: Hunk[]): { program: boolean; files: boolean } {
        let program = false;
        let files = false;
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
