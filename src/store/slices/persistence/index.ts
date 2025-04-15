import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { Language } from '../../shared/dictionaries';
import { Program } from '../../../shared/models/project.ts';

export interface PersistenceState {
    language: Language;
    lastProgram: Program;
}

const initialProgram: Program = {
    segments: [],
    parameters: {
        roundStrategy: 'firstMeaningDigit',
    },
};

const initialState: PersistenceState = {
    language: 'ru',
    lastProgram: initialProgram,
};

export const persistenceSlice = createSlice({
    name: 'persistenceSlice',
    initialState,
    reducers: {
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
            const newLogoutState = { ...initialState };
            newLogoutState.language = state.language;
            state = newLogoutState;
            return state;
        });
    },
});
export const { setLanguage, clearLastProgram, setLastProgram } =
    persistenceSlice.actions;
