import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { callbackInitialState } from '../index.ts';
import { TypeOptions } from 'react-toastify';

export interface CallbackState {
    navigateTo?: string;
    showToastMessage?: string;
    toastType?: TypeOptions;
}

export const callbackSlice = createSlice({
    name: 'callbackSlice',
    initialState: callbackInitialState,
    reducers: {
        setNavigateTo: (state, { payload }: PayloadAction<string>) => {
            state.navigateTo = payload;
        },
        navigateSuccess: (state) => {
            state.navigateTo = undefined;
        },
        setShowToast: (
            state,
            { payload }: PayloadAction<{ message: string; type: TypeOptions }>
        ) => {
            console.log('setShowToast', payload.message, payload.type);
            state.showToastMessage = payload.message;
            state.toastType = payload.type;
        },
        toastSuccess: (state) => {
            state.showToastMessage = undefined;
            state.toastType = undefined;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            // TODO think about it
            //state = callbackInitialState;
            return state;
        });
    },
});
export const { setNavigateTo, navigateSuccess, setShowToast, toastSuccess } =
    callbackSlice.actions;
