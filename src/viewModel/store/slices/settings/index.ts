import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { settingsInitialState } from '../index.ts';

export interface SettingsState {
    showTour: boolean;
    showFileManager: boolean;
    expandProblemViewer: boolean;
    showSearch: boolean;
    editModeForProjectTitle: boolean;
    editModeForFilename: boolean;
    isFileDraggedToManager: boolean;
    isCompiling: boolean;
    showShareModal: boolean;
}

export const settingsSlice = createSlice({
    name: 'settingsSlice',
    initialState: settingsInitialState,
    reducers: {
        setIsCompiling: (state, { payload }: PayloadAction<boolean>) => {
            state.isCompiling = payload;
        },
        setEditModeForProjectTitle: (
            state,
            { payload }: PayloadAction<boolean>
        ) => {
            state.editModeForProjectTitle = payload;
        },
        setEditModeForFilename: (
            state,
            { payload }: PayloadAction<boolean>
        ) => {
            state.editModeForFilename = payload;
        },
        setTourVisibility: (state, { payload }: PayloadAction<boolean>) => {
            state.showTour = payload;
        },
        setExpandProblemViewer: (
            state,
            { payload }: PayloadAction<boolean>
        ) => {
            state.expandProblemViewer = payload;
        },
        setShowSearch: (state, { payload }: PayloadAction<boolean>) => {
            state.showSearch = payload;
        },
        setShoFileManager: (state, { payload }: PayloadAction<boolean>) => {
            state.showFileManager = payload;
        },
        setIsFileDraggedToFileManager: (
            state,
            { payload }: PayloadAction<boolean>
        ) => {
            state.isFileDraggedToManager = payload;
        },
        setShowShareModal: (state, { payload }: PayloadAction<boolean>) => {
            state.showShareModal = payload;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = settingsInitialState;
            return state;
        });
    },
});
export const {
    setEditModeForProjectTitle,
    setIsCompiling,
    setEditModeForFilename,
    setShowSearch,
    setExpandProblemViewer,
    setTourVisibility,
    setShoFileManager,
    setIsFileDraggedToFileManager,
    setShowShareModal,
} = settingsSlice.actions;
