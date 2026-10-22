import {
    appendChatMessage,
    applyChatHistoryRefresh,
    chatSlice,
    setChatCheckpointFromRequestId,
    setChatMessages,
    toggleChatSteps,
} from '../../view/store/slices/chat';
import { chatInitialState } from '../../view/store/slices';

const reduce = chatSlice.reducer;

test('toggle-expands-and-collapses-a-past-run', () => {
    const expanded = reduce(chatInitialState, toggleChatSteps(1));
    expect(expanded.expandedStepRequestIds).toEqual([1]);

    const collapsed = reduce(expanded, toggleChatSteps(1));
    expect(collapsed.expandedStepRequestIds).toEqual([]);
});

test('new-request-collapses-every-expanded-run', () => {
    const expanded = reduce(chatInitialState, toggleChatSteps(1));

    // строка шага текущего прогона ничего не сворачивает
    const afterStep = reduce(
        expanded,
        appendChatMessage({ kind: 'event', labelKey: 'read_segment' })
    );
    expect(afterStep.expandedStepRequestIds).toEqual([1]);

    const afterRequest = reduce(
        afterStep,
        appendChatMessage({
            kind: 'request',
            text: 'ещё',
            createdAt: '2026-09-24T10:00:00Z',
        })
    );
    expect(afterRequest.expandedStepRequestIds).toEqual([]);
});

test('cleared-transcript-forgets-expanded-runs', () => {
    // после очистки id сообщений снова идут с 1, и старая развёрнутость досталась бы чужому прогону
    const expanded = reduce(chatInitialState, toggleChatSteps(1));

    const cleared = reduce(expanded, setChatMessages([]));

    expect(cleared.expandedStepRequestIds).toEqual([]);
});

// GH-189: после замены ленты номера идут заново, и привязка ушедшего запроса досталась бы новому
test('replaced-feed-drops-links-of-gone-requests', () => {
    let state = reduce(
        chatInitialState,
        appendChatMessage({
            kind: 'request',
            text: 'раз',
            createdAt: '2026-10-21T10:00:00Z',
        })
    );
    state = reduce(
        state,
        appendChatMessage({
            kind: 'request',
            text: 'два',
            createdAt: '2026-10-21T10:01:00Z',
        })
    );
    state = reduce(
        state,
        applyChatHistoryRefresh({ history: [], links: { 1: 'e1', 2: 'e2' } })
    );
    state = reduce(state, setChatCheckpointFromRequestId(2));

    state = reduce(state, setChatMessages(state.messages.slice(0, 1)));

    expect(state.entryIdByRequestId).toEqual({ 1: 'e1' });
    expect(state.checkpointFromRequestId).toBeNull();
});
