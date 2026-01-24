import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Language } from '../../../../viewModel/dictionaries';
import { Program } from '../../../../model/domain.ts';
import { persistenceInitialState } from '../index.ts';
import { createEmptyProgram } from '../../../../model/repository/ProgramRepository.ts';

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
        setModeToProject(state, {payload}: PayloadAction<{id: string, mode: 'latex'| 'markdown'}>) {
            state.projectCompileModes[payload.id] = payload.mode;
        },
        setLastOpenedProjectUuid(
            state,
            { payload }: PayloadAction<string | undefined>
        ) {
            state.lastOpenedProjectUuid = payload;
        },
    },
});
export const {
    setLanguage,
    setInstructionExpanded,
    clearLastProgram,
    setLastProgram,
    setLastOpenedProjectUuid,
    setModeToProject,
} = persistenceSlice.actions;
