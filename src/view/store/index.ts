import {
    AnyAction,
    configureStore,
    EnhancedStore,
    ThunkAction,
} from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import {
    persistStore,
    PERSIST,
    FLUSH,
    REHYDRATE,
    PAUSE,
    PURGE,
    REGISTER,
} from 'redux-persist';
import { createRootReducer } from './reducers';
import { appRouter } from '../routing';
import {
    setCodeCheckRequest,
    setCurrentEmail,
    setCurrentView,
    setEmailRequest,
    setLastVerifiedCode,
    setLoginRequest,
    setPasswordRequest,
    setRegistration,
} from './slices/auth';
import {
    setActiveSegmentIndex,
    setCloneRequestState,
    setGetFilesRequestState,
    setGetProjectRequestState,
    setGetProjectsRequestState,
    setSaveProjectRequestState,
    setPendingSegmentEditorCursor,
    setPreviousActiveSegmentIndex,
    setRedoEnabled,
    setSearch,
    setUndoEnabled,
    setPdfUpdated,
    setProjectPromptRequestState,
} from './slices/ide';
import {
    clearLastProgram,
    setInstructionExpanded,
    setLanguage,
    setLastOpenedProjectUuid,
    setLastProgram,
    setModeToProject,
} from './slices/persistence';
import {
    setCompileError,
    setCompileResult,
    setCompileResultForSegment,
    setCompileResultSegmentsSize,
    setCurrentProgram,
    setFiles,
    setInputSegmentText,
    setProject,
    setReadOnly,
    setProjectMode,
    setPdfUri,
} from './slices/project';
import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    OutputSegment,
    Project,
    ProjectMode,
    ProjectShort,
} from '../../model/domain.ts';
import { setProjects } from './slices/projects';
import {
    setCaptchaBypassToken,
    setEditModeForFilename,
    setEditModeForProjectTitle,
    setExpandProblemViewer,
    setFilesToDelete,
    setIsCompiling,
    setIsFileDraggedToFileManager,
    setShoFileManager,
    setShowProjectPromptModal,
    setShowSearch,
    setTourVisibility,
} from './slices/settings';
import { setUser } from './slices/user';
import { setScrollEditorToBottom } from './slices/callback';
import { dictionary } from '../../viewModel/dictionaries';
import { toast, TypeOptions } from 'react-toastify';
import {
    CloneRequestState,
    GetFilesRequestState,
    GetProjectRequestState,
    GetProjectsRequestState,
    SaveProjectRequestState,
    ViewModelRepository,
} from '../../viewModel/repository';

export const store = configureStore({
    reducer: createRootReducer(),
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [
                    FLUSH,
                    REHYDRATE,
                    PAUSE,
                    PERSIST,
                    PURGE,
                    REGISTER,
                ],
            },
        }),
    // devTools: process.env.NODE_ENV !== 'production',
});

setupListeners(store.dispatch);

export const persist = persistStore(store);

export type StorageState = ReturnType<ReturnType<typeof createRootReducer>>;

export type AppDispatch = typeof store.dispatch;

export type AppThunk<R = void> = ThunkAction<
    R | Promise<R>,
    StorageState,
    unknown,
    AnyAction
>;

export const createViewModelStateFromStore = (
    store: EnhancedStore
): ViewModelRepository => {
    return {
        location: () => appRouter.state.location.pathname,
        authViewModelRepository: {
            codeCheckRequest: () => store.getState().auth.codeCheckRequest,
            currentEmail: () => store.getState().auth.currentEmail,
            currentView: () => store.getState().auth.currentView,
            emailRequest: () => store.getState().auth.emailRequest,
            lastVerifiedCode: () => store.getState().auth.lastVerifiedCode,
            passwordSetRequest: () => store.getState().auth.passwordSetRequest,
            loginRequest: () => store.getState().auth.loginRequest,
            isRegistration: () => store.getState().auth.isRegistration,

            setCurrentEmail: (email) => store.dispatch(setCurrentEmail(email)),
            setPasswordRequest: (password) =>
                store.dispatch(setPasswordRequest(password)),
            setLoginRequest: (request) =>
                store.dispatch(setLoginRequest(request)),
            setEmailRequest: (request) =>
                store.dispatch(setEmailRequest(request)),
            setLastVerifiedCode: (code) =>
                store.dispatch(setLastVerifiedCode(code)),
            setCodeCheckRequest: (request) =>
                store.dispatch(setCodeCheckRequest(request)),
            setCurrentView: (view) => store.dispatch(setCurrentView(view)),
            setIsRegistration: (v) => store.dispatch(setRegistration(v)),
        },
        ideViewModelRepository: {
            activeSegmentIndex: () => store.getState().ide.activeSegmentIndex,
            search: () => store.getState().ide.search,
            previousActiveSegmentIndex: () =>
                store.getState().ide.previousActiveSegmentIndex,
            pendingSegmentEditorCursor: () =>
                store.getState().ide.pendingSegmentEditorCursor,
            redoEnabled: () => store.getState().ide.redoEnabled,
            undoEnabled: () => store.getState().ide.undoEnabled,
            cloneRequestState: () => store.getState().ide.cloneRequestState,
            getProjectRequestState: () =>
                store.getState().ide.getProjectRequestState,
            getFilesRequestState: () =>
                store.getState().ide.getFilesRequestState,
            getProjectsRequestState: () =>
                store.getState().ide.getProjectsRequestState,
            saveProjectRequestState: () =>
                store.getState().ide.saveProjectRequestState,
            pdfUpdated: () => store.getState().ide.pdfUpdated,
            projectPromptRequestState: () =>
                store.getState().ide.projectPromptRequestState(),

            setProjectPromptRequestStatus: (v) =>
                store.dispatch(setProjectPromptRequestState(v)),
            setPdfUpdated: (v) => store.dispatch(setPdfUpdated(v)),
            setCloneRequestState: (v: CloneRequestState) =>
                store.dispatch(setCloneRequestState(v)),
            setGetProjectRequestState: (v: GetProjectRequestState) =>
                store.dispatch(setGetProjectRequestState(v)),
            setGetFilesRequestState: (v: GetFilesRequestState) =>
                store.dispatch(setGetFilesRequestState(v)),
            setGetProjectsRequestState: (v: GetProjectsRequestState) =>
                store.dispatch(setGetProjectsRequestState(v)),
            setSaveProjectRequestState: (v: SaveProjectRequestState) =>
                store.dispatch(setSaveProjectRequestState(v)),
            setUndoEnabled: (v: boolean) => store.dispatch(setUndoEnabled(v)),
            setRedoEnabled: (v: boolean) => store.dispatch(setRedoEnabled(v)),
            setSearch: (search?: string) => store.dispatch(setSearch(search)),
            setActiveSegmentIndex: (index: number) =>
                store.dispatch(setActiveSegmentIndex(index)),
            setPreviousActiveSegmentIndex: (index: number) =>
                store.dispatch(setPreviousActiveSegmentIndex(index)),
            setPendingSegmentEditorCursor: (value) =>
                store.dispatch(setPendingSegmentEditorCursor(value)),
        },
        persistenceViewModelRepository: {
            instructionExpanded: () =>
                store.getState().persistence.instructionExpanded,
            projectCompileModes: () =>
                store.getState().persistence.projectCompileModes,
            language: () => store.getState().persistence.language,
            lastProgram: () => store.getState().persistence.lastProgram,
            lastOpenedProjectUuid: () =>
                store.getState().persistence.lastOpenedProjectUuid,

            setLastOpenedProjectUuid: (uuid) =>
                store.dispatch(setLastOpenedProjectUuid(uuid)),
            setInstructionExpanded: (instructionExpanded) =>
                store.dispatch(setInstructionExpanded(instructionExpanded)),
            setLanguage: (language) => store.dispatch(setLanguage(language)),
            setLastProgram: (lastProgram) =>
                store.dispatch(setLastProgram(lastProgram)),
            clearLastProgram: () => store.dispatch(clearLastProgram()),
            setModeToProject: (id: string, mode: ProjectMode) =>
                store.dispatch(setModeToProject({ id, mode })),
        },
        projectViewModelRepository: {
            compileErrorResult: () =>
                store.getState().project.compileErrorResult,
            compileSuccessResult: () =>
                store.getState().project.compileSuccessResult,
            project: () => store.getState().project.project,
            projectIsReadonly: () => store.getState().project.projectIsReadonly,
            currentProgram: () => store.getState().project.currentProgram,
            files: () => store.getState().project.files,
            mode: () => store.getState().project.mode,
            pdfUri: () => store.getState().project.pdfUri,

            setInputSegmentText: (index, text) =>
                store.dispatch(setInputSegmentText({ index, text })),
            setCompileResultSegmentsSize: (size: number) =>
                store.dispatch(setCompileResultSegmentsSize(size)),
            setCompileResultForSegment: (
                index: number,
                segment: OutputSegment
            ) =>
                store.dispatch(
                    setCompileResultForSegment({
                        segment: segment,
                        index: index,
                    })
                ),
            setReadOnly: (value: boolean) => store.dispatch(setReadOnly(value)),
            setProject: (project?: Project) =>
                store.dispatch(setProject(project)),
            setCompileResult: (compileResult: CompileSuccessResult) =>
                store.dispatch(setCompileResult(compileResult)),
            setCompileErrorResult: (
                compileErrorResultList: CompileErrorResultList
            ) => store.dispatch(setCompileError(compileErrorResultList)),
            setFiles: (files: LabkeeperFile[]) =>
                store.dispatch(setFiles(files)),
            setCurrentProgram: (program) =>
                store.dispatch(setCurrentProgram(program)),
            setProjectMode: (mode: ProjectMode) =>
                store.dispatch(setProjectMode(mode)),
            setPdfUri: (uri?: string) => store.dispatch(setPdfUri(uri)),
        },
        projectsViewModelRepository: {
            projects: () => store.getState().projects.projects,

            setProjects: (projects: ProjectShort[]) =>
                store.dispatch(setProjects(projects)),
        },
        settingsViewModelRepository: {
            isAutocompleteLoading: () => store.getState().settings.isCompiling,
            editModeForFilename: () =>
                store.getState().settings.editModeForFilename,
            editModeForProjectTitle: () =>
                store.getState().settings.editModeForProjectTitle,
            expandProblemViewer: () =>
                store.getState().settings.expandProblemViewer,
            isFileDraggedToManager: () =>
                store.getState().settings.isFileDraggedToManager,
            showFileManager: () => store.getState().settings.showFileManager,
            showSearch: () => store.getState().settings.showSearch,
            showShareModal: () => store.getState().settings.showShareModal,
            showTour: () => store.getState().settings.showTour,
            filesToDelete: () => store.getState().settings.filesToDelete,
            captchaBypassToken: () =>
                store.getState().settings.captchaBypassToken,
            showProjectPromptModal: () =>
                store.getState().settings.showProjectPromptModal,

            setShowProjectPromptModal: (v) =>
                store.dispatch(setShowProjectPromptModal(v)),
            setCaptchaBypassToken: (token) =>
                store.dispatch(setCaptchaBypassToken(token)),
            setShowSearch: (show: boolean) =>
                store.dispatch(setShowSearch(show)),
            setShowFileManager: (show: boolean) =>
                store.dispatch(setShoFileManager(show)),
            setExpandProblemViewer: (expand: boolean) =>
                store.dispatch(setExpandProblemViewer(expand)),
            setTourVisibility: (visible: boolean) =>
                store.dispatch(setTourVisibility(visible)),
            setEditModeForFilename: (edit: boolean) =>
                store.dispatch(setEditModeForFilename(edit)),
            setEditModeForProjectTitle: (edit: boolean) =>
                store.dispatch(setEditModeForProjectTitle(edit)),
            setIsCompiling: (value: boolean) =>
                store.dispatch(setIsCompiling(value)),
            setIsFileDraggedToFileManager: (edit: boolean) =>
                store.dispatch(setIsFileDraggedToFileManager(edit)),
            setFilesToDelete: (files: LabkeeperFile[]) =>
                store.dispatch(setFilesToDelete(files)),
        },
        userViewModelRepository: {
            email: () => store.getState().user.email,
            id: () => store.getState().user.id,
            isAuthenticated: () => store.getState().user.isAuthenticated,

            setUserInfo: (userInfo) => store.dispatch(setUser(userInfo)),
        },

        setLocation: (url: string) => appRouter.navigate(url),
        dictionary: dictionary[store.getState().persistence.language],
        toast: (message: string, type: TypeOptions) => {
            toast(message, { type });
        },
        scrollEditorToBottom: () =>
            store.dispatch(setScrollEditorToBottom(true)),
    };
};
