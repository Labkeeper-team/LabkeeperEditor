import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Language } from '../../../../viewModel/dictionaries';
import { Program } from '../../../../model/domain.ts';
import { persistenceInitialState } from '../index.ts';
import { createEmptyProgram } from '../../../../model/repository/ProgramRepository.ts';
import { AgentRunMode } from '../../../../model/rpi/agentSocket.ts';
import { AgentCheckpointMode } from '../../../../viewModel/utils/agentCheckpoint.ts';

export const persistenceSlice = createSlice({
    name: 'persistenceSlice',
    initialState: persistenceInitialState,
    reducers: {
        setInstructionExpanded(state, { payload }: PayloadAction<boolean>) {
            state.instructionExpanded = payload;
        },
        setLanguage: (state, { payload }: PayloadAction<Language>) => {
            state.language = payload;
        },
        setLastProgram(state, { payload }: PayloadAction<Program>) {
            state.lastProgram = payload;
        },
        clearLastProgram(state) {
            state.lastProgram = createEmptyProgram();
        },
        setLastOpenedProjectUuid(
            state,
            { payload }: PayloadAction<string | undefined>
        ) {
            state.lastOpenedProjectUuid = payload;
        },
        setAgentMaxTokens(state, { payload }: PayloadAction<number>) {
            state.agentMaxTokens = payload;
        },
        setAgentIterations(state, { payload }: PayloadAction<number>) {
            state.agentIterations = payload;
        },
        setAgentCompilationAllowed(state, { payload }: PayloadAction<boolean>) {
            state.agentCompilationAllowed = payload;
        },
        setAgentRunMode(state, { payload }: PayloadAction<AgentRunMode>) {
            state.agentRunMode = payload;
        },
        setCrossBorderConsentAcceptedLocally(
            state,
            { payload }: PayloadAction<boolean>
        ) {
            state.crossBorderConsentAcceptedLocally = payload;
        },
        setAgentPromptHeight(state, { payload }: PayloadAction<number | null>) {
            state.agentPromptHeight = payload;
        },
        setSkipClearHistoryConfirm(state, { payload }: PayloadAction<boolean>) {
            state.skipClearHistoryConfirm = payload;
        },
        setAgentCheckpointMode(
            state,
            { payload }: PayloadAction<AgentCheckpointMode>
        ) {
            state.agentCheckpointMode = payload;
        },
        setSkipCheckpointRevertConfirm(
            state,
            { payload }: PayloadAction<boolean>
        ) {
            state.skipCheckpointRevertConfirm = payload;
        },
    },
});
export const {
    setLanguage,
    setInstructionExpanded,
    clearLastProgram,
    setLastProgram,
    setLastOpenedProjectUuid,
    setAgentMaxTokens,
    setAgentIterations,
    setAgentCompilationAllowed,
    setAgentRunMode,
    setCrossBorderConsentAcceptedLocally,
    setAgentPromptHeight,
    setSkipClearHistoryConfirm,
    setAgentCheckpointMode,
    setSkipCheckpointRevertConfirm,
} = persistenceSlice.actions;
