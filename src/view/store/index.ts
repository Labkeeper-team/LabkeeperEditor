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
    setPreviousActiveSegmentIndex,
    setRedoEnabled,
    setSearch,
    setUndoEnabled,
} from './slices/ide';
import {
    clearLastProgram,
    setInstructionExpanded,
    setLanguage,
    setLastOpenedProjectUuid,
    setLastProgram,
} from './slices/persistence';
import {
    clearProject,
    setCompileError,
    setCompileResult,
    setCompileResultForSegment,
    setCompileResultSegmentsSize,
    setCurrentProgram,
    setFiles,
    setProject,
    setReadOnly,
} from './slices/project';
import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    OutputSegment,
    Project,
    ProjectShort,
} from '../../model/domain.ts';
import { setProjects } from './slices/projects';
import {
    setEditModeForFilename,
    setEditModeForProjectTitle,
    setExpandProblemViewer,
    setIsCompiling,
    setIsFileDraggedToFileManager,
    setShoFileManager,
    setShowSearch,
    setTourVisibility,
} from './slices/settings';
import { setUser } from './slices/user';
import {
    setNavigateTo,
    setScrollEditorToBottom,
    setShowToast,
} from './slices/callback';
import { dictionary } from '../../viewModel/dictionaries';
import { TypeOptions } from 'react-toastify';
import { logoutAction } from './actions';
import {
    CloneRequestState,
    GetFilesRequestState,
    GetProjectRequestState,
    GetProjectsRequestState,
    ViewModelState,
} from '../../viewModel/viewModelState';

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
): ViewModelState => {
    return {
        location: () => appRouter.state.location.pathname,
        authViewModelState: {
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
        ideViewModelState: {
            activeSegmentIndex: () => store.getState().ide.activeSegmentIndex,
            search: () => store.getState().ide.search,
            previousActiveSegmentIndex: () =>
                store.getState().ide.previousActiveSegmentIndex,
            redoEnabled: () => store.getState().ide.redoEnabled,
            undoEnabled: () => store.getState().ide.undoEnabled,
            cloneRequestState: () => store.getState().ide.cloneRequestState,
            getProjectRequestState: () =>
                store.getState().ide.getProjectRequestState,
            getFilesRequestState: () =>
                store.getState().ide.getFilesRequestState,
            getProjectsRequestState: () =>
                store.getState().ide.getProjectsRequestState,

            setCloneRequestState: (v: CloneRequestState) =>
                store.dispatch(setCloneRequestState(v)),
            setGetProjectRequestState: (v: GetProjectRequestState) =>
                store.dispatch(setGetProjectRequestState(v)),
            setGetFilesRequestState: (v: GetFilesRequestState) =>
                store.dispatch(setGetFilesRequestState(v)),
            setGetProjectsRequestState: (v: GetProjectsRequestState) =>
                store.dispatch(setGetProjectsRequestState(v)),
            setUndoEnabled: (v: boolean) => store.dispatch(setUndoEnabled(v)),
            setRedoEnabled: (v: boolean) => store.dispatch(setRedoEnabled(v)),
            setSearch: (search: string) => store.dispatch(setSearch(search)),
            setActiveSegmentIndex: (index: number) =>
                store.dispatch(setActiveSegmentIndex(index)),
            setPreviousActiveSegmentIndex: (index: number) =>
                store.dispatch(setPreviousActiveSegmentIndex(index)),
        },
        persistenceViewModelState: {
            instructionExpanded: () =>
                store.getState().persistence.instructionExpanded,
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
        },
        projectViewModelState: {
            compileErrorResult: () =>
                store.getState().project.compileErrorResult,
            compileSuccessResult: () =>
                store.getState().project.compileSuccessResult,
            project: () => store.getState().project.project,
            projectIsReadonly: () => store.getState().project.projectIsReadonly,
            currentProgram: () => store.getState().project.currentProgram,
            files: () => store.getState().project.files,

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
            setProject: (project: Project) =>
                store.dispatch(setProject(project)),
            setCompileResult: (compileResult: CompileSuccessResult) =>
                store.dispatch(setCompileResult(compileResult)),
            setCompileErrorResult: (
                compileErrorResultList: CompileErrorResultList
            ) => store.dispatch(setCompileError(compileErrorResultList)),
            setFiles: (files: LabkeeperFile[]) =>
                store.dispatch(setFiles(files)),
            resetToInitialState: () => store.dispatch(clearProject()),
            setCurrentProgram: (program) =>
                store.dispatch(setCurrentProgram(program)),
        },
        projectsViewModelState: {
            projects: () => store.getState().projects.projects,

            setProjects: (projects: ProjectShort[]) =>
                store.dispatch(setProjects(projects)),
        },
        settingsViewModelState: {
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
        },
        userViewModelState: {
            email: () => store.getState().user.email,
            id: () => store.getState().user.id,
            isAuthenticated: () => store.getState().user.isAuthenticated,

            setUserInfo: (userInfo) => store.dispatch(setUser(userInfo)),
        },

        navigate: (url: string) => store.dispatch(setNavigateTo(url)),
        dictionary: dictionary[store.getState().persistence.language],
        toast: (message: string, type: TypeOptions) =>
            store.dispatch(setShowToast({ message, type })),
        scrollEditorToBottom: () =>
            store.dispatch(setScrollEditorToBottom(true)),
        resetToInitialState: () => store.dispatch(logoutAction),
    };
};
