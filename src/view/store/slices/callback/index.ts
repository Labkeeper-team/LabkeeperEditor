import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { callbackInitialState } from '../index.ts';

export const callbackSlice = createSlice({
    name: 'callbackSlice',
    initialState: callbackInitialState,
    reducers: {
        setScrollEditorToBottom: (
            state,
            { payload }: PayloadAction<boolean>
        ) => {
            state.scrollEditorToBottom = payload;
        },
    },
});
export const { setScrollEditorToBottom } = callbackSlice.actions;
