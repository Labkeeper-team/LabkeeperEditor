import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { Language } from '../../shared/dictionaries';

export interface PersistenceState {
    language: Language;
}

const initialState: PersistenceState = {
    language: 'ru',
};

export const persistenceSlice = createSlice({
    name: 'persistenceSlice',
    initialState,
    reducers: {
        setLanguage: (state, { payload }: PayloadAction<Language>) => {
            state.language = payload;
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
export const { setLanguage } = persistenceSlice.actions;
