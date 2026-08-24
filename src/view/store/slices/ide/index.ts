import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { EditorNavigationTarget } from '../../../../viewModel/repository';
import { PdfPosition } from '../../../../model/rpi';
import { ideInitialState } from '../index.ts';
import {
    CloneRequestState,
    GetFilesRequestState,
    GetProjectRequestState,
    GetProjectsRequestState,
    PendingSegmentEditorCursor,
    ProjectPromptRequestState,
    SaveProjectRequestState,
    SearchCurrentMatch,
} from '../../../../viewModel/repository';

export const ideSlice = createSlice({
    name: 'ideSlice',
    initialState: ideInitialState,
    reducers: {
        setSearch: (state, { payload }: PayloadAction<string | undefined>) => {
            state.search = payload;
        },
        setSearchInput: (state, { payload }: PayloadAction<string>) => {
            state.searchInput = payload;
        },
        setSearchNoMatch: (state, { payload }: PayloadAction<boolean>) => {
            state.searchNoMatch = payload;
        },
        setSearchCurrentMatch: (
            state,
            { payload }: PayloadAction<SearchCurrentMatch | null>
        ) => {
            state.searchCurrentMatch = payload;
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
        setPendingSegmentEditorCursor: (
            state,
            { payload }: PayloadAction<PendingSegmentEditorCursor | null>
        ) => {
            state.pendingSegmentEditorCursor = payload;
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
        setSaveTextFileRequestState: (
            state,
            { payload }: PayloadAction<SaveProjectRequestState>
        ) => {
            state.saveTextFileRequestState = payload;
        },
        markProgramChanged: (state) => {
            state.programChangeRevision += 1;
        },
        markProgramRevisionSaved: (
            state,
            { payload }: PayloadAction<number>
        ) => {
            if (payload > state.programChangeRevision) {
                return;
            }
            state.savedProgramRevision = Math.max(
                state.savedProgramRevision,
                payload
            );
        },
        resetProgramRevisions: (state) => {
            state.savedProgramRevision = state.programChangeRevision;
        },
        markTextFileChanged: (state) => {
            state.textFileChangeRevision += 1;
        },
        markTextFileRevisionSaved: (
            state,
            { payload }: PayloadAction<number>
        ) => {
            if (payload > state.textFileChangeRevision) {
                return;
            }
            state.savedTextFileRevision = Math.max(
                state.savedTextFileRevision,
                payload
            );
        },
        resetTextFileRevisions: (state) => {
            state.savedTextFileRevision = state.textFileChangeRevision;
        },
        setLoadTextFileRequestState: (
            state,
            { payload }: PayloadAction<SaveProjectRequestState>
        ) => {
            state.loadTextFileRequestState = payload;
        },
        setActiveTextFile: (
            state,
            { payload }: PayloadAction<string | null>
        ) => {
            state.activeTextFile = payload;
        },
        setActiveImageFile: (
            state,
            { payload }: PayloadAction<string | null>
        ) => {
            state.activeImageFile = payload;
        },
        setTextFileContent: (state, { payload }: PayloadAction<string>) => {
            state.textFileContent = payload;
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
        setActiveEditorLine: (
            state,
            { payload }: PayloadAction<number | null>
        ) => {
            state.activeEditorLine = payload;
        },
        setSynctexEditorPosition: (
            state,
            { payload }: PayloadAction<EditorNavigationTarget | null>
        ) => {
            state.synctexEditorPosition = payload;
        },
        setPdfClickPosition: (
            state,
            { payload }: PayloadAction<PdfPosition | null>
        ) => {
            state.pdfClickPosition = payload;
        },
        setPdfNavigationTarget: (
            state,
            { payload }: PayloadAction<PdfPosition | null>
        ) => {
            state.pdfNavigationTarget = payload;
        },
        setEditorNavigationTarget: (
            state,
            { payload }: PayloadAction<EditorNavigationTarget | null>
        ) => {
            state.editorNavigationTarget = payload;
        },
    },
});
export const {
    setSearch,
    setSearchInput,
    setSearchNoMatch,
    setSearchCurrentMatch,
    setActiveSegmentIndex,
    setPreviousActiveSegmentIndex,
    setPendingSegmentEditorCursor,
    setUndoEnabled,
    setRedoEnabled,
    setCloneRequestState,
    setGetProjectRequestState,
    setGetFilesRequestState,
    setGetProjectsRequestState,
    setSaveProjectRequestState,
    setSaveTextFileRequestState,
    markProgramChanged,
    markProgramRevisionSaved,
    resetProgramRevisions,
    markTextFileChanged,
    markTextFileRevisionSaved,
    resetTextFileRevisions,
    setLoadTextFileRequestState,
    setActiveTextFile,
    setActiveImageFile,
    setTextFileContent,
    setPdfUpdated,
    setProjectPromptRequestState,
    setActiveEditorLine,
    setSynctexEditorPosition,
    setPdfClickPosition,
    setPdfNavigationTarget,
    setEditorNavigationTarget,
} = ideSlice.actions;
