import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';

export interface IdeState {
    search?: string;
    isAutocompilation: boolean;
    isHighlighntingCode: boolean;
    activeSegmentIndex: number;
    previousActiveSegmentIndex: number;
    showHIntAboutVariables: boolean;
    updateFiles: boolean;
}

const initialState: IdeState = {
    search: undefined,
    isAutocompilation: false,
    isHighlighntingCode: true,
    showHIntAboutVariables: true,
    activeSegmentIndex: -1,
    previousActiveSegmentIndex: -1,
    updateFiles: false,
};

export const ideSlice = createSlice({
    name: 'ideSlice',
    initialState,
    reducers: {
        setSearch: (state, { payload }: PayloadAction<string>) => {
            state.search = payload;
        },
        setUpdateFiles: (state, { payload }: PayloadAction<boolean>) => {
            state.updateFiles = payload;
        },
        setActiveSegmentIndex: (state, { payload }: PayloadAction<number>) => {
            state.previousActiveSegmentIndex = state.activeSegmentIndex;
            state.activeSegmentIndex = payload;
        },
        setAutocompilation: (state, { payload }: PayloadAction<boolean>) => {
            state.isAutocompilation = payload;
        },
        setHighlight: (state, { payload }: PayloadAction<boolean>) => {
            state.isHighlighntingCode = payload;
        },
        setShowHintAboutVariables: (
            state,
            { payload }: PayloadAction<boolean>
        ) => {
            state.showHIntAboutVariables = payload;
        },
        clear: (state) => {
            state = initialState;
            return state;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = initialState;
            return state;
        });
    },
});
export const {
    setSearch,
    setHighlight,
    setShowHintAboutVariables,
    setActiveSegmentIndex,
    clear,
    setAutocompilation,
    setUpdateFiles,
} = ideSlice.actions;
