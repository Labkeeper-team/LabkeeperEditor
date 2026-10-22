import { AgentHistoryEntry } from '../../../model/domain.ts';
import { ChatMessage } from '../../../viewModel/repository';
import {
    agentCheckpointView,
    checkpointBaseOf,
    checkpointEntryIds,
    checkpointStart,
    linkHistoryToRequests,
    liveLinks,
    requestIdsFrom,
    withoutRuns,
} from '../../../viewModel/utils/agentCheckpoint.ts';

const entry = (
    id: string,
    minute: number,
    request = `запрос ${id}`
): AgentHistoryEntry => ({
    id,
    request,
    response: 'ответ',
    createdAt: `2026-10-21T10:${String(minute).padStart(2, '0')}:00Z`,
});

const request = (id: number, text: string): ChatMessage => ({
    kind: 'request',
    id,
    text,
    createdAt: '2026-10-21T10:00:00Z',
});
const step = (id: number): ChatMessage => ({
    kind: 'event',
    id,
    labelKey: 'read_segment',
});
const response = (id: number): ChatMessage => ({
    kind: 'response',
    id,
    text: 'готово',
});

describe('checkpointBaseOf', () => {
    test('base-is-the-youngest-entry-by-time-not-by-position', () => {
        expect(
            checkpointBaseOf([entry('b', 5), entry('a', 1), entry('c', 3)])
        ).toEqual({ entryId: 'b', createdAt: '2026-10-21T10:05:00Z' });
    });

    test('empty-history-gives-an-empty-base', () => {
        expect(checkpointBaseOf([])).toEqual({
            entryId: null,
            createdAt: null,
        });
    });
});

describe('checkpointEntryIds', () => {
    const history = [entry('a', 1), entry('b', 2), entry('c', 3)];

    // GH-189: откатывать надо невключительно до самого молодого entry старше правок
    test('entries-newer-than-the-base-go-and-the-base-stays', () => {
        expect(
            checkpointEntryIds(history, {
                entryId: 'a',
                createdAt: '2026-10-21T10:01:00Z',
            })
        ).toEqual(['b', 'c']);
    });

    test('empty-base-takes-every-entry', () => {
        expect(
            checkpointEntryIds(history, { entryId: null, createdAt: null })
        ).toEqual(['a', 'b', 'c']);
    });

    test('deleted-base-still-cuts-by-its-time', () => {
        expect(
            checkpointEntryIds([entry('b', 2), entry('c', 3)], {
                entryId: 'a',
                createdAt: '2026-10-21T10:02:30Z',
            })
        ).toEqual(['c']);
    });

    test('unknown-base-takes-only-the-last-entry', () => {
        expect(checkpointEntryIds(history, undefined)).toEqual(['c']);
        expect(checkpointEntryIds([], undefined)).toEqual([]);
    });
});

describe('linkHistoryToRequests', () => {
    test('new-entries-link-to-requests-by-text-in-order', () => {
        const messages = [
            request(1, 'одно'),
            step(2),
            response(3),
            request(4, 'одно'),
            response(5),
        ];
        const history = [
            entry('old', 0, 'одно'),
            entry('e1', 1, 'одно'),
            entry('e2', 2, ' одно '),
        ];

        expect(
            linkHistoryToRequests(new Set(['old']), history, messages, {})
        ).toEqual({ 1: 'e1', 4: 'e2' });
    });

    test('linked-requests-and-entries-are-not-linked-twice', () => {
        const messages = [request(1, 'одно'), request(4, 'два')];

        expect(
            linkHistoryToRequests(
                new Set(),
                [entry('e1', 1, 'одно'), entry('e2', 2, 'два')],
                messages,
                { 1: 'e1' }
            )
        ).toEqual({ 1: 'e1', 4: 'e2' });
    });

    // находка разбора: повтор после отказа, у которого записи нет, получает запись своего прогона
    test('repeated-request-after-a-refusal-gets-the-entry', () => {
        const messages = [
            request(1, 'одно'),
            { kind: 'error', id: 2, reason: 'PaymentRequired' } as ChatMessage,
            request(3, 'одно'),
            response(4),
        ];

        expect(
            linkHistoryToRequests(
                new Set(),
                [entry('e1', 1, 'одно')],
                messages,
                {}
            )
        ).toEqual({ 3: 'e1' });
    });

    test('running-request-does-not-take-an-entry', () => {
        // запись прерванного прогона с тем же текстом пришла, пока идёт новый
        expect(
            linkHistoryToRequests(
                new Set(),
                [entry('eA', 1, 'одно')],
                [request(1, 'одно'), request(5, 'одно')],
                {},
                5
            )
        ).toEqual({ 1: 'eA' });
    });

    test('entry-without-a-matching-request-stays-unlinked', () => {
        // запись из другой вкладки: в этой ленте её запроса нет
        expect(
            linkHistoryToRequests(
                new Set(),
                [entry('e1', 1, 'чужой')],
                [request(1, 'свой')],
                {}
            )
        ).toEqual({});
    });
});

describe('checkpointStart', () => {
    test('first-unlinked-history-entry-in-range-starts-the-block', () => {
        expect(
            checkpointStart({
                history: [entry('a', 1), entry('b', 2), entry('c', 3)],
                entryIds: ['b', 'c'],
                links: { 7: 'c' },
                messages: [request(7, 'запрос c')],
                fromRequestId: null,
            })
        ).toEqual({ kind: 'entry', entryId: 'b' });
    });

    test('linked-request-starts-the-block-when-history-has-none', () => {
        expect(
            checkpointStart({
                history: [entry('a', 1), entry('c', 3)],
                entryIds: ['c'],
                links: { 7: 'c' },
                messages: [request(5, 'старый'), request(7, 'запрос c')],
                fromRequestId: null,
            })
        ).toEqual({ kind: 'request', requestId: 7 });
    });

    test('request-sent-without-changes-starts-the-block-before-its-entry-exists', () => {
        // гость и идущий прогон: записи на сервере ещё нет
        expect(
            checkpointStart({
                history: [],
                entryIds: [],
                links: {},
                messages: [request(1, 'раз'), request(4, 'два')],
                fromRequestId: 4,
            })
        ).toEqual({ kind: 'request', requestId: 4 });
    });

    test('start-follows-time-not-the-server-order', () => {
        expect(
            checkpointStart({
                history: [entry('c', 3), entry('b', 2), entry('a', 1)],
                entryIds: ['b', 'c'],
                links: {},
                messages: [],
                fromRequestId: null,
            })
        ).toEqual({ kind: 'entry', entryId: 'b' });
    });

    test('nothing-to-frame-gives-null', () => {
        expect(
            checkpointStart({
                history: [entry('a', 1)],
                entryIds: [],
                links: {},
                messages: [],
                fromRequestId: null,
            })
        ).toBeNull();
    });
});

test('runs-from-the-start-request-go-with-their-steps-and-answers', () => {
    const messages = [
        request(1, 'раз'),
        step(2),
        response(3),
        request(4, 'два'),
        step(5),
        response(6),
    ];

    expect(requestIdsFrom(messages, { kind: 'request', requestId: 4 })).toEqual(
        [4]
    );
    expect(requestIdsFrom(messages, { kind: 'entry', entryId: 'x' })).toEqual([
        1, 4,
    ]);
    expect(requestIdsFrom(messages, null)).toEqual([]);
    expect(withoutRuns(messages, [4])).toEqual(messages.slice(0, 3));
});

test('links-of-requests-gone-from-the-feed-are-dropped', () => {
    expect(liveLinks([request(4, 'два')], { 1: 'e1', 4: 'e4' })).toEqual({
        4: 'e4',
    });
});

describe('agentCheckpointView', () => {
    const base = { entryId: 'a', createdAt: '2026-10-21T10:01:00Z' };

    test('no-changes-means-nothing-to-revert', () => {
        expect(
            agentCheckpointView({
                hunkCount: 0,
                authenticated: true,
                history: [entry('a', 1), entry('b', 2)],
                links: {},
                messages: [],
                fromRequestId: null,
                base,
            })
        ).toBeNull();
    });

    test('guest-reverts-no-entries-and-frames-from-its-request', () => {
        expect(
            agentCheckpointView({
                hunkCount: 1,
                authenticated: false,
                history: [],
                links: {},
                messages: [request(1, 'раз'), response(2)],
                fromRequestId: 1,
                base: undefined,
            })
        ).toEqual({
            entryIds: [],
            start: { kind: 'request', requestId: 1 },
            requestIds: [1],
        });
    });

    test('stale-link-to-a-removed-request-does-not-hide-the-start', () => {
        // запрос 1 ушёл откатом, а новый прогон получил тот же номер
        expect(
            agentCheckpointView({
                hunkCount: 1,
                authenticated: true,
                history: [entry('a', 1), entry('b', 2)],
                links: { 1: 'b', 9: 'gone' },
                messages: [request(1, 'запрос b')],
                fromRequestId: null,
                base,
            })
        ).toEqual({
            entryIds: ['b'],
            start: { kind: 'request', requestId: 1 },
            requestIds: [1],
        });
    });
});
