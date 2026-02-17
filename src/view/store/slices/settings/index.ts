import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { settingsInitialState } from '../index.ts';
import { LabkeeperFile } from '../../../../model/domain.ts';

export const settingsSlice = createSlice({
    name: 'settingsSlice',
    initialState: settingsInitialState,
    reducers: {
        setFilesToDelete: (
            state,
            { payload }: PayloadAction<LabkeeperFile[]>
        ) => {
            state.filesToDelete = payload;
        },
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
        setShowContactModal: (state, { payload }: PayloadAction<boolean>) => {
            state.showContactModal = payload;
        },
        setCaptchaBypassToken: (
            state,
            { payload }: PayloadAction<string | undefined>
        ) => {
            state.captchaBypassToken = payload;
        },
        setShowProjectPromptModal: (
            state,
            { payload }: PayloadAction<boolean>
        ) => {
            state.showProjectPromptModal = payload;
        },
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
    setShowContactModal,
    setFilesToDelete,
    setCaptchaBypassToken,
    setShowProjectPromptModal,
} = settingsSlice.actions;
