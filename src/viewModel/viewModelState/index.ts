import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    OutputSegment,
    Program,
    Project,
    ProjectShort,
} from '../../model/domain.ts';
import {
    AuthView,
    CodeRequestState,
    EmailRequestState,
    LoginRequestState,
    PasswordRequestState,
    setCodeCheckRequest,
    setCurrentEmail,
    setCurrentView,
    setEmailRequest,
    setLastVerifiedCode,
    setLoginRequest,
    setPasswordRequest,
    setRegistration,
} from '../store/slices/auth';
import {
    dictionary,
    Language,
    Translations,
} from '../store/shared/dictionaries';
import { setUser, UserInfo } from '../store/slices/user';
import { EnhancedStore } from '@reduxjs/toolkit';
import {
    clearLastProgram,
    setInstructionExpanded,
    setLanguage,
    setLastOpenedProjectUuid,
    setLastProgram,
} from '../store/slices/persistence';
import {
    setNavigateTo,
    setScrollEditorToBottom,
    setShowToast,
} from '../store/slices/callback';
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
} from '../store/slices/project';
import { TypeOptions } from 'react-toastify';
import { logoutAction } from '../store/actions';
import {
    setIsCompiling,
    setEditModeForFilename,
    setEditModeForProjectTitle,
    setExpandProblemViewer,
    setIsFileDraggedToFileManager,
    setShoFileManager,
    setShowSearch,
    setTourVisibility,
} from '../store/slices/settings';
import {
    CloneRequestState,
    GetFilesRequestState,
    GetProjectRequestState,
    setActiveSegmentIndex,
    setCloneRequestState,
    setGetFilesRequestState,
    setGetProjectRequestState,
    setPreviousActiveSegmentIndex,
    setRedoEnabled,
    setSearch,
    setUndoEnabled,
} from '../store/slices/ide';
import { setProjects } from '../store/slices/projects';
import { appRouter } from '../../view/routing';
import { store } from '../store';

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

            setCloneRequestState: (v: CloneRequestState) =>
                store.dispatch(setCloneRequestState(v)),
            setGetProjectRequestState: (v: GetProjectRequestState) =>
                store.dispatch(setGetProjectRequestState(v)),
            setGetFilesRequestState: (v: GetFilesRequestState) =>
                store.dispatch(setGetFilesRequestState(v)),
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

export const mockViewModelState = (): ViewModelState => {
    let location = '/';

    let activeSegmentIndex = -1;
    let search: string | undefined = undefined;
    let previousActiveSegmentIndex = -1;
    let redoEnabled: boolean = false;
    let undoEnabled: boolean = false;
    let cloneRequestState: CloneRequestState = 'unknown';
    let getProjectRequestState: GetProjectRequestState = 'unknown';
    let getFilesRequestState: GetFilesRequestState = 'unknown';

    let instructionExpanded = false;
    let language: 'ru' | 'en' = 'ru';
    let lastProgram: Program = {
        segments: [],
        parameters: {
            roundStrategy: 'firstMeaningDigit',
        },
    };
    let lastOpenedProjectUuid: string | undefined = undefined;

    let compileErrorResult: CompileErrorResultList | undefined = undefined;
    let compileSuccessResult: CompileSuccessResult = { segments: [] };
    let project: Project | undefined = undefined;
    let projectIsReadonly = false;
    let currentProgram: Program = {
        segments: [],
        parameters: { roundStrategy: 'firstMeaningDigit' },
    };
    let files: LabkeeperFile[] = [];

    let projects: ProjectShort[] = [];

    let isAutocompleteLoading = false;
    let editModeForFilename = false;
    let editModeForProjectTitle = false;
    let expandProblemViewer = false;
    let isFileDraggedToManager = false;
    let showFileManager = false;
    let showSearch = false;
    const showShareModal = false;
    let showTour = false;

    let email: string = '';
    let id: number = -1;
    let isAuthenticated: boolean = false;

    let loginRequest: LoginRequestState = 'unknown';
    let codeCheckRequest: CodeRequestState = 'unknown';
    let currentEmail: string | null = null;
    let currentView: AuthView = 'closed';
    let emailRequest: EmailRequestState = 'unknown';
    let lastVerifiedCode: string | null = null;
    let passwordSetRequest: PasswordRequestState = 'unknown';
    let isRegistration: boolean = false;
    return {
        scrollEditorToBottom: () => ({}),
        location: () => location,
        authViewModelState: {
            codeCheckRequest: () => codeCheckRequest,
            currentEmail: () => currentEmail,
            currentView: () => currentView,
            emailRequest: () => emailRequest,
            lastVerifiedCode: () => lastVerifiedCode,
            passwordSetRequest: () => passwordSetRequest,
            loginRequest: () => loginRequest,
            isRegistration: () => isRegistration,

            setCurrentEmail: (email) => (currentEmail = email),
            setEmailRequest: (request) => (emailRequest = request),
            setCurrentView: (view) => (currentView = view),
            setCodeCheckRequest: (request) => (codeCheckRequest = request),
            setLastVerifiedCode: (code) => (lastVerifiedCode = code),
            setLoginRequest: (request) => (loginRequest = request),
            setPasswordRequest: (request) => (passwordSetRequest = request),
            setIsRegistration: (v) => (isRegistration = v),
        },
        ideViewModelState: {
            activeSegmentIndex: () => activeSegmentIndex,
            search: () => search,
            previousActiveSegmentIndex: () => previousActiveSegmentIndex,
            redoEnabled: () => redoEnabled,
            undoEnabled: () => undoEnabled,
            cloneRequestState: () => cloneRequestState,
            getProjectRequestState: () => getProjectRequestState,
            getFilesRequestState: () => getFilesRequestState,

            setGetFilesRequestState: (v: GetFilesRequestState) =>
                (getFilesRequestState = v),
            setCloneRequestState: (v: CloneRequestState) =>
                (cloneRequestState = v),
            setGetProjectRequestState: (v: GetProjectRequestState) =>
                (getProjectRequestState = v),
            setUndoEnabled: (v: boolean) => (undoEnabled = v),
            setRedoEnabled: (v: boolean) => (redoEnabled = v),
            setSearch: (v: string) => (search = v),
            setActiveSegmentIndex: (index: number) =>
                (activeSegmentIndex = index),
            setPreviousActiveSegmentIndex: (index: number) =>
                (previousActiveSegmentIndex = index),
        },
        persistenceViewModelState: {
            instructionExpanded: () => instructionExpanded,
            language: () => language,
            lastProgram: () => lastProgram,
            lastOpenedProjectUuid: () => lastOpenedProjectUuid,

            setLastOpenedProjectUuid: (uuid) => (lastOpenedProjectUuid = uuid),
            setInstructionExpanded: (v) => (instructionExpanded = v),
            setLanguage: (v) => (language = v),
            setLastProgram: (v) => (lastProgram = v),
            clearLastProgram: () =>
                (lastProgram = {
                    segments: [],
                    parameters: { roundStrategy: 'firstMeaningDigit' },
                }),
        },
        projectViewModelState: {
            compileErrorResult: () => compileErrorResult,
            compileSuccessResult: () => compileSuccessResult,
            project: () => project,
            projectIsReadonly: () => projectIsReadonly,
            currentProgram: () => currentProgram,
            files: () => files,

            setCompileResultSegmentsSize: (size: number) => {
                compileSuccessResult.segments.length = size;
            },
            setCompileResultForSegment: (
                index: number,
                segment: OutputSegment
            ) => {
                if (compileSuccessResult.segments.length > index) {
                    compileSuccessResult.segments[index] = segment;
                }
            },
            setReadOnly: (v: boolean) => (projectIsReadonly = v),
            setProject: (v: Project) => (project = v),
            setCompileResult: (v: CompileSuccessResult) =>
                (compileSuccessResult = v),
            setCompileErrorResult: (v: CompileErrorResultList) =>
                (compileErrorResult = v),
            setFiles: (v: LabkeeperFile[]) => (files = v),
            resetToInitialState: () => {
                compileErrorResult = undefined;
                compileSuccessResult = { segments: [] };
                project = undefined;
                projectIsReadonly = false;
                currentProgram = {
                    segments: [],
                    parameters: { roundStrategy: 'firstMeaningDigit' },
                };
                files = [];
            },
            setCurrentProgram: (v) => (currentProgram = v),
        },
        projectsViewModelState: {
            projects: () => projects,

            setProjects: (v: ProjectShort[]) => (projects = v),
        },
        settingsViewModelState: {
            isAutocompleteLoading: () => isAutocompleteLoading,
            editModeForFilename: () => editModeForFilename,
            editModeForProjectTitle: () => editModeForProjectTitle,
            expandProblemViewer: () => expandProblemViewer,
            isFileDraggedToManager: () => isFileDraggedToManager,
            showFileManager: () => showFileManager,
            showSearch: () => showSearch,
            showShareModal: () => showShareModal,
            showTour: () => showTour,

            setShowSearch: (v: boolean) => (showSearch = v),
            setShowFileManager: (v: boolean) => (showFileManager = v),
            setExpandProblemViewer: (v: boolean) => (expandProblemViewer = v),
            setTourVisibility: (v: boolean) => (showTour = v),
            setEditModeForFilename: (v: boolean) => (editModeForFilename = v),
            setEditModeForProjectTitle: (v: boolean) =>
                (editModeForProjectTitle = v),
            setIsCompiling: (v: boolean) => (isAutocompleteLoading = v),
            setIsFileDraggedToFileManager: (v: boolean) =>
                (isFileDraggedToManager = v),
        },
        userViewModelState: {
            email: () => email,
            id: () => id,
            isAuthenticated: () => isAuthenticated,

            setUserInfo: (userInfo) => {
                email = userInfo.email;
                isAuthenticated = userInfo.isAuthenticated;
                id = userInfo.id;
            },
        },

        navigate: (url: string) => (location = url),
        dictionary: dictionary[store.getState().persistence.language],
        toast: (message: string, type: TypeOptions) =>
            console.log('Show toast:', message, type),
        resetToInitialState: () => console.log('resetToInitialState'),
    };
};

export interface ProjectViewModelState {
    project: () => Project | undefined;
    compileSuccessResult: () => CompileSuccessResult;
    compileErrorResult: () => CompileErrorResultList | undefined;
    projectIsReadonly: () => boolean;
    currentProgram: () => Program;
    files: () => LabkeeperFile[];

    setCompileResultSegmentsSize: (size: number) => void;
    setCompileResultForSegment: (index: number, segment: OutputSegment) => void;
    setReadOnly: (value: boolean) => void;
    setProject: (project: Project) => void;
    setCompileResult: (compileResult: CompileSuccessResult) => void;
    setCompileErrorResult: (
        compileErrorResultList: CompileErrorResultList
    ) => void;
    setFiles: (files: LabkeeperFile[]) => void;
    resetToInitialState: () => void;
    setCurrentProgram: (program: Program) => void;
}

export interface IdeViewModelState {
    search: () => string | undefined;
    activeSegmentIndex: () => number;
    previousActiveSegmentIndex: () => number;
    redoEnabled: () => boolean;
    undoEnabled: () => boolean;
    cloneRequestState: () => CloneRequestState;
    getProjectRequestState: () => GetProjectRequestState;
    getFilesRequestState: () => GetFilesRequestState;

    setRedoEnabled: (v: boolean) => void;
    setUndoEnabled: (v: boolean) => void;
    setSearch: (search: string) => void;
    setActiveSegmentIndex: (index: number) => void;
    setPreviousActiveSegmentIndex: (index: number) => void;
    setCloneRequestState: (state: CloneRequestState) => void;
    setGetProjectRequestState: (state: GetProjectRequestState) => void;
    setGetFilesRequestState: (state: GetFilesRequestState) => void;
}

export interface SettingsViewModelState {
    showTour: () => boolean;
    showFileManager: () => boolean;
    expandProblemViewer: () => boolean;
    showSearch: () => boolean;
    editModeForProjectTitle: () => boolean;
    editModeForFilename: () => boolean;
    isFileDraggedToManager: () => boolean;
    isAutocompleteLoading: () => boolean;
    showShareModal: () => boolean;

    setTourVisibility: (visible: boolean) => void;
    setEditModeForFilename: (edit: boolean) => void;
    setEditModeForProjectTitle: (edit: boolean) => void;
    setShowSearch: (show: boolean) => void;
    setExpandProblemViewer: (expandProblemViewer: boolean) => void;
    setShowFileManager: (showFileManager: boolean) => void;
    setIsCompiling: (value: boolean) => void;
    setIsFileDraggedToFileManager: (value: boolean) => void;
}

export interface ProjectsViewModelState {
    projects: () => ProjectShort[];

    setProjects: (projects: ProjectShort[]) => void;
}

export interface AuthViewModelState {
    currentView: () => AuthView;
    currentEmail: () => string | null;
    lastVerifiedCode: () => string | null;
    emailRequest: () => EmailRequestState;
    codeCheckRequest: () => CodeRequestState;
    passwordSetRequest: () => PasswordRequestState;
    loginRequest: () => LoginRequestState;
    isRegistration: () => boolean;

    setCurrentView: (view: AuthView) => void;
    setCurrentEmail: (email: string | null) => void;
    setLastVerifiedCode: (code: string | null) => void;
    setEmailRequest: (request: EmailRequestState) => void;
    setCodeCheckRequest: (request: CodeRequestState) => void;
    setPasswordRequest: (request: PasswordRequestState) => void;
    setLoginRequest: (request: LoginRequestState) => void;
    setIsRegistration: (v: boolean) => void;
}

export interface UserViewModelState {
    email: () => string;
    id: () => number;
    isAuthenticated: () => boolean;

    setUserInfo: (userInfo: UserInfo) => void;
}

export interface PersistenceViewModelState {
    language: () => Language;
    lastProgram: () => Program;
    instructionExpanded: () => boolean;
    lastOpenedProjectUuid: () => string | undefined;

    setLastOpenedProjectUuid: (uuid: string | undefined) => void;
    setLanguage: (language: Language) => void;
    setInstructionExpanded: (instructionExpanded: boolean) => void;
    setLastProgram: (lastProgram: Program) => void;
    clearLastProgram: () => void;
}

export interface ViewModelState {
    projectViewModelState: ProjectViewModelState;
    ideViewModelState: IdeViewModelState;
    persistenceViewModelState: PersistenceViewModelState;
    userViewModelState: UserViewModelState;
    authViewModelState: AuthViewModelState;
    projectsViewModelState: ProjectsViewModelState;
    settingsViewModelState: SettingsViewModelState;
    navigate: (url: string) => void;
    toast: (message: string, type: TypeOptions) => void;
    dictionary: Translations;
    resetToInitialState: () => void;
    location: () => string;
    scrollEditorToBottom: () => void;
}
