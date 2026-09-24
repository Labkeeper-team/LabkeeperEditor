import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { chatInitialState } from '../index.ts';
import { AgentHistoryEntry } from '../../../../model/domain.ts';
import {
    AgentRequestState,
    ChatMessage,
    ChatMessageDraft,
    HistoryRequestState,
} from '../../../../viewModel/repository';

export const chatSlice = createSlice({
    name: 'chatSlice',
    initialState: chatInitialState,
    reducers: {
        /** id раздаёт слайс, чтобы сервис не тащил счётчик у себя */
        appendChatMessage(state, { payload }: PayloadAction<ChatMessageDraft>) {
            state.messages.push({
                ...payload,
                id: state.nextMessageId,
            } as ChatMessage);
            state.nextMessageId += 1;
            // новый запрос сворачивает шаги всех прошлых прогонов, даже развёрнутых руками
            if (payload.kind === 'request') {
                state.expandedStepRequestIds = [];
            }
        },
        setChatMessages(state, { payload }: PayloadAction<ChatMessage[]>) {
            state.messages = payload;
            state.nextMessageId =
                payload.reduce((max, m) => Math.max(max, m.id), 0) + 1;
            // id пойдут заново с 1, и старая развёрнутость досталась бы чужому прогону
            state.expandedStepRequestIds = [];
        },
        setChatRequestState(
            state,
            { payload }: PayloadAction<AgentRequestState>
        ) {
            state.requestState = payload;
        },
        setChatInput(state, { payload }: PayloadAction<string>) {
            state.input = payload;
        },
        setChatHistoryRequestState(
            state,
            { payload }: PayloadAction<HistoryRequestState>
        ) {
            state.historyRequestState = payload;
        },
        setChatHistory(state, { payload }: PayloadAction<AgentHistoryEntry[]>) {
            state.history = payload;
        },
        toggleChatSteps(state, { payload }: PayloadAction<number>) {
            const expanded = state.expandedStepRequestIds;
            state.expandedStepRequestIds = expanded.includes(payload)
                ? expanded.filter((id) => id !== payload)
                : [...expanded, payload];
        },
        resetChat() {
            return { ...chatInitialState, messages: [], history: [] };
        },
    },
});

export const {
    appendChatMessage,
    setChatMessages,
    setChatRequestState,
    setChatInput,
    setChatHistoryRequestState,
    setChatHistory,
    toggleChatSteps,
    resetChat,
} = chatSlice.actions;
