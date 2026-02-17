import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ideInitialState } from '../index.ts';
import {
    CloneRequestState,
    GetFilesRequestState,
    GetProjectRequestState,
    GetProjectsRequestState,
    ProjectPromptRequestState,
    SaveProjectRequestState,
} from '../../../../viewModel/repository';

export const ideSlice = createSlice({
    name: 'ideSlice',
    initialState: ideInitialState,
    reducers: {
        setSearch: (state, { payload }: PayloadAction<string | undefined>) => {
            state.search = payload;
        },
        setActiveSegmentIndex: (state, { payload }: PayloadAction<number>) => {
            state.activeSegmentIndex = payload;
        },
        setUndoEnabled: (state, { payload }: PayloadAction<boolean>) => {
            state.undoEnabled = payload;
        },
        setRedoEnabled: (state, { payload }: PayloadAction<boolean>) => {
            state.redoEnabled = payload;
        },
        setPreviousActiveSegmentIndex: (
            state,
            { payload }: PayloadAction<number>
        ) => {
            state.previousActiveSegmentIndex = payload;
        },
        setCloneRequestState: (
            state,
            { payload }: PayloadAction<CloneRequestState>
        ) => {
            state.cloneRequestState = payload;
        },
        setGetProjectRequestState: (
            state,
            { payload }: PayloadAction<GetProjectRequestState>
        ) => {
            state.getProjectRequestState = payload;
        },
        setGetFilesRequestState: (
            state,
            { payload }: PayloadAction<GetFilesRequestState>
        ) => {
            state.getFilesRequestState = payload;
        },
        setGetProjectsRequestState: (
            state,
            { payload }: PayloadAction<GetProjectsRequestState>
        ) => {
            state.getProjectsRequestState = payload;
        },
        setSaveProjectRequestState: (
            state,
            { payload }: PayloadAction<SaveProjectRequestState>
        ) => {
            state.saveProjectRequestState = payload;
        },
        setPdfUpdated: (state, { payload }: PayloadAction<number>) => {
            state.pdfUpdated = payload;
        },
        setProjectPromptRequestState: (
            state,
            { payload }: PayloadAction<ProjectPromptRequestState>
        ) => {
            state.projectPromptRequestState = payload;
        },
    },
});
export const {
    setSearch,
    setActiveSegmentIndex,
    setPreviousActiveSegmentIndex,
    setUndoEnabled,
    setRedoEnabled,
    setCloneRequestState,
    setGetProjectRequestState,
    setGetFilesRequestState,
    setGetProjectsRequestState,
    setSaveProjectRequestState,
    setPdfUpdated,
    setProjectPromptRequestState,
} = ideSlice.actions;
