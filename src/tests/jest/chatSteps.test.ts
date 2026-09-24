import { groupChatSteps } from '../../viewModel/utils/chatSteps.ts';
import { ChatMessage } from '../../viewModel/repository';

const request = (id: number): ChatMessage => ({
    kind: 'request',
    id,
    text: `запрос ${id}`,
    createdAt: '2026-09-24T10:00:00Z',
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

test('current-run-is-never-collapsed', () => {
    // прогон закончился, но нового запроса ещё нет: шаги остаются на виду
    expect(groupChatSteps([request(1), step(2), step(3), response(4)])).toEqual(
        { stepOwner: [null, null, null, null], pastStepCounts: {} }
    );
});

test('new-request-collapses-only-steps-of-the-previous-run', () => {
    const messages = [
        request(1),
        step(2),
        step(3),
        response(4),
        request(5),
        step(6),
    ];

    expect(groupChatSteps(messages)).toEqual({
        stepOwner: [null, 1, 1, null, null, null],
        pastStepCounts: { 1: 2 },
    });
});

test('run-without-steps-gets-no-toggle', () => {
    // сверка перед запуском не удалась: у прогона только запрос и ошибка
    const messages: ChatMessage[] = [
        request(1),
        { kind: 'error', id: 2, reason: 'sync_failed' },
        request(3),
    ];

    expect(groupChatSteps(messages)).toEqual({
        stepOwner: [null, null, null],
        pastStepCounts: {},
    });
});

test('stopped-run-keeps-its-list-of-changes-visible', () => {
    const messages: ChatMessage[] = [
        request(1),
        step(2),
        {
            kind: 'notice',
            id: 3,
            reason: 'aborted',
            changes: [{ labelKey: 'segment', segmentId: 1 }],
        },
        request(4),
    ];

    expect(groupChatSteps(messages)).toEqual({
        stepOwner: [null, 1, null, null],
        pastStepCounts: { 1: 1 },
    });
});

test('each-past-run-counts-its-own-steps', () => {
    const messages: ChatMessage[] = [
        request(1),
        step(2),
        { kind: 'error', id: 3, reason: 'ContextOverflow' },
        request(4),
        step(5),
        step(6),
        step(7),
        response(8),
        request(9),
    ];

    expect(groupChatSteps(messages)).toEqual({
        stepOwner: [null, 1, null, null, 4, 4, 4, null, null],
        pastStepCounts: { 1: 1, 4: 3 },
    });
});

test('steps-before-any-request-stay-visible', () => {
    // очистка истории оставляет ленту пустой, но если строка всё же пришла без запроса, прятать её не под чем
    expect(groupChatSteps([step(1), request(2), step(3)])).toEqual({
        stepOwner: [null, null, null],
        pastStepCounts: {},
    });
});
