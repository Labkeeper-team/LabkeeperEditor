import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { ideInitialState } from '../index.ts';

export interface IdeState {
    search?: string;
    activeSegmentIndex: number;
    previousActiveSegmentIndex: number;
}

export const ideSlice = createSlice({
    name: 'ideSlice',
    initialState: ideInitialState,
    reducers: {
        setSearch: (state, { payload }: PayloadAction<string>) => {
            state.search = payload;
        },
        setActiveSegmentIndex: (state, { payload }: PayloadAction<number>) => {
            state.activeSegmentIndex = payload;
        },
        setPreviousActiveSegmentIndex: (
            state,
            { payload }: PayloadAction<number>
        ) => {
            state.previousActiveSegmentIndex = payload;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = ideInitialState;
            return state;
        });
    },
});
export const {
    setSearch,
    setActiveSegmentIndex,
    setPreviousActiveSegmentIndex,
} = ideSlice.actions;
