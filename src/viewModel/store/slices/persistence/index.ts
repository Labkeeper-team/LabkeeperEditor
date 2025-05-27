import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { Language } from '../../shared/dictionaries';
import { Program } from '../../../../model/domain.ts';
import { initialProgram, persistenceInitialState } from '../index.ts';

export interface PersistenceState {
    language: Language;
    lastProgram: Program;
    instructionExpanded: boolean;
}

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
            state.lastProgram = initialProgram;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            const newLogoutState = { ...persistenceInitialState };
            newLogoutState.language = state.language;
            state = newLogoutState;
            return state;
        });
    },
});
export const {
    setLanguage,
    setInstructionExpanded,
    clearLastProgram,
    setLastProgram,
} = persistenceSlice.actions;
