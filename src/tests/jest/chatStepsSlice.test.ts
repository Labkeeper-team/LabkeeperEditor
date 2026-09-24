import {
    appendChatMessage,
    chatSlice,
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
