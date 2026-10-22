import { AgentCheckpointBase } from '../../../../viewModel/utils/agentCheckpoint.ts';
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
            // по той же причине привязки к записям истории и начало отката живут, только пока жив их запрос
            const requestIds = new Set(
                payload.filter((m) => m.kind === 'request').map((m) => m.id)
            );
            state.entryIdByRequestId = Object.fromEntries(
                Object.entries(state.entryIdByRequestId).filter(([id]) =>
                    requestIds.has(Number(id))
                )
            );
            if (
                state.checkpointFromRequestId !== null &&
                !requestIds.has(state.checkpointFromRequestId)
            ) {
                state.checkpointFromRequestId = null;
            }
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
        applyChatHistoryRefresh(
            state,
            {
                payload,
            }: PayloadAction<{
                history: AgentHistoryEntry[];
                links: Record<number, string>;
            }>
        ) {
            state.history = payload.history;
            state.entryIdByRequestId = payload.links;
        },
        setChatCheckpointFromRequestId(
            state,
            { payload }: PayloadAction<number | null>
        ) {
            state.checkpointFromRequestId = payload;
        },
        setChatCheckpointBase(
            state,
            { payload }: PayloadAction<AgentCheckpointBase | null>
        ) {
            state.checkpointBase = payload;
        },
        setChatHistorySyncing(state, { payload }: PayloadAction<boolean>) {
            state.historySyncing = payload;
        },
        setChatRecentFiles(state, { payload }: PayloadAction<string[]>) {
            state.recentFiles = payload;
        },
        resetChat() {
            return {
                ...chatInitialState,
                messages: [],
                history: [],
                recentFiles: [],
                entryIdByRequestId: {},
            };
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
    setChatRecentFiles,
    applyChatHistoryRefresh,
    setChatCheckpointFromRequestId,
    setChatCheckpointBase,
    setChatHistorySyncing,
    resetChat,
} = chatSlice.actions;
