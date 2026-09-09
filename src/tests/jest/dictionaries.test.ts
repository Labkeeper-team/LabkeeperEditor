import { AGENT_STOP_REASONS } from '../../model/rpi/agentSocket.ts';
import { ru } from '../../viewModel/dictionaries/ru.ts';
import { en } from '../../viewModel/dictionaries/en.ts';
import { AgentToolName } from '../../model/rpi/agentSocket.ts';

const DICTIONARIES = [
    ['ru', ru],
    ['en', en],
] as const;

/** Ключи, которые лента собирает сама, поэтому типом они не проверяются */
const EXTRA_STOP_KEYS = [
    'timeout',
    'disconnected',
    'connect_failed',
    'save_failed',
];

const TOOL_NAMES: AgentToolName[] = [
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
];

const WRITE_TOOLS = TOOL_NAMES.filter(
    (name) => name.startsWith('add_') || name.startsWith('delete_')
);

test.each(DICTIONARIES)(
    'every-stop-reason-has-a-text-in-%s',
    (_name, dictionary) => {
        const stop = dictionary.agent_chat.stop as Record<string, string>;
        // Done это успех, для него текста нет и не должно быть
        const explained = AGENT_STOP_REASONS.filter(
            (reason) => reason !== 'Done'
        );
        for (const reason of [...explained, ...EXTRA_STOP_KEYS]) {
            expect(stop[reason]?.trim()).toBeTruthy();
        }
    }
);

test.each(DICTIONARIES)(
    'every-agent-event-has-a-text-in-%s',
    (_name, dictionary) => {
        const events = dictionary.agent_chat.event as Record<string, string>;
        const keys = [
            'model_call',
            ...TOOL_NAMES.filter((name) => !WRITE_TOOLS.includes(name)),
            'add_segment',
            'add_lines_to_segment',
            'delete_lines_from_segment',
            'add_file',
            'add_lines_to_file',
            'delete_lines_from_file',
            ...WRITE_TOOLS.map((name) => `${name}_plain`),
        ];
        for (const key of keys) {
            expect(events[key]?.trim()).toBeTruthy();
        }
    }
);

test.each(DICTIONARIES)(
    'segment-event-texts-do-not-end-on-a-dangling-word-in-%s',
    (_name, dictionary) => {
        const events = dictionary.agent_chat.event as Record<string, string>;
        // строка без объекта не должна обрываться на предлоге: для этого есть _plain
        for (const key of ['add_segment', 'add_lines_to_segment']) {
            expect(events[key]).toContain('{segment}');
        }
    }
);
