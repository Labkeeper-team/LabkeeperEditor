import { eventLabel } from '../../../view/pages/project/viewer/chat/eventLabel.ts';
import { en } from '../../../viewModel/dictionaries/en.ts';

const events = en.agent_chat.event as Record<string, string>;

test('event-label-puts-the-segment-number-in', () => {
    expect(eventLabel(events, 'add_lines_to_segment', 3)).toBe(
        'Changes have been made to segment №3'
    );
});

test('event-label-without-a-segment-drops-the-number', () => {
    expect(eventLabel(events, 'add_lines_to_segment')).toBe(
        'Changes have been made to segment'
    );
});

// ключ, которого нет в словаре, не должен ни ронять страницу, ни показываться сырым
test.each([
    ['a-missing-key', 'replace_in_segment_plain'],
    ['constructor', 'constructor'],
    ['toString', 'toString'],
    ['__proto__', '__proto__'],
    ['a-number', 42],
    ['no-key', undefined],
])('event-label-of-%s-is-the-common-line', (_case, labelKey) => {
    expect(eventLabel(events, labelKey as unknown as string, 2)).toBe(
        'The agent performed an action'
    );
});
