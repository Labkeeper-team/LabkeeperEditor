import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    OutputSegment,
    Program,
    Project,
    ProjectShort,
    UserInfo,
} from '../../model/domain.ts';

import { Language, Translations } from '../dictionaries';

import { TypeOptions } from 'react-toastify';
import { en } from '../dictionaries/en.ts';

export type AuthView =
    | 'login'
    | 'email'
    | 'code'
    | 'password'
    | 'success'
    | 'closed';
export type EmailRequestState =
    | 'unknown'
    | 'loading'
    | 'ok'
    | 'userNotFound'
    | 'userExists'
    | 'validationError'
    | 'unknownError';
export type CodeRequestState =
    | 'unknown'
    | 'loading'
    | 'ok'
    | 'invalid'
    | 'unknownError';
export type PasswordRequestState =
    | 'unknown'
    | 'loading'
    | 'ok'
    | 'userNotFound'
    | 'userExists'
    | 'validationError'
    | 'unknownError';
export type LoginRequestState =
    | 'unknown'
    | 'loading'
    | 'ok'
    | 'bad_credentials'
    | 'oauth_error'
    | 'unknownError';

export type CloneRequestState = 'unknown' | 'ok' | 'error' | 'loading';
export type GetProjectRequestState =
    | 'unknown'
    | 'ok'
    | 'error'
    | 'loading'
    | 'forbidden'
    | 'not_found';

export type GetFilesRequestState =
    | 'unknown'
    | 'ok'
    | 'error'
    | 'loading'
    | 'forbidden';

export type GetProjectsRequestState =
    | 'unknown'
    | 'ok'
    | 'error'
    | 'loading'
    | 'unauth';

export const mockViewModelState = (): ViewModelRepository => {
    let location = '/';

    let activeSegmentIndex = -1;
    let search: string | undefined = undefined;
    let previousActiveSegmentIndex = -1;
    let redoEnabled: boolean = false;
    let undoEnabled: boolean = false;
    let cloneRequestState: CloneRequestState = 'unknown';
    let getProjectRequestState: GetProjectRequestState = 'unknown';
    let getFilesRequestState: GetFilesRequestState = 'unknown';
    let getProjectsRequestState: GetProjectsRequestState = 'unknown';

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
        authViewModelRepository: {
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
        ideViewModelRepository: {
            activeSegmentIndex: () => activeSegmentIndex,
            search: () => search,
            previousActiveSegmentIndex: () => previousActiveSegmentIndex,
            redoEnabled: () => redoEnabled,
            undoEnabled: () => undoEnabled,
            cloneRequestState: () => cloneRequestState,
            getProjectRequestState: () => getProjectRequestState,
            getFilesRequestState: () => getFilesRequestState,
            getProjectsRequestState: () => getProjectsRequestState,

            setGetProjectsRequestState: (v: GetProjectsRequestState) =>
                (getProjectsRequestState = v),
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
        persistenceViewModelRepository: {
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
        projectViewModelRepository: {
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
        projectsViewModelRepository: {
            projects: () => projects,

            setProjects: (v: ProjectShort[]) => (projects = v),
        },
        settingsViewModelRepository: {
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
        userViewModelRepository: {
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
        dictionary: en,
        toast: (message: string, type: TypeOptions) =>
            console.log('Show toast:', message, type),
        resetToInitialState: () => console.log('resetToInitialState'),
    };
};

export interface ProjectViewModelRepository {
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

export interface IdeViewModelRepository {
    search: () => string | undefined;
    activeSegmentIndex: () => number;
    previousActiveSegmentIndex: () => number;
    redoEnabled: () => boolean;
    undoEnabled: () => boolean;
    cloneRequestState: () => CloneRequestState;
    getProjectRequestState: () => GetProjectRequestState;
    getFilesRequestState: () => GetFilesRequestState;
    getProjectsRequestState: () => GetProjectsRequestState;

    setRedoEnabled: (v: boolean) => void;
    setUndoEnabled: (v: boolean) => void;
    setSearch: (search: string) => void;
    setActiveSegmentIndex: (index: number) => void;
    setPreviousActiveSegmentIndex: (index: number) => void;
    setCloneRequestState: (state: CloneRequestState) => void;
    setGetProjectRequestState: (state: GetProjectRequestState) => void;
    setGetFilesRequestState: (state: GetFilesRequestState) => void;
    setGetProjectsRequestState: (state: GetProjectsRequestState) => void;
}

export interface SettingsViewModelRepository {
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

export interface ProjectsViewModelRepository {
    projects: () => ProjectShort[];

    setProjects: (projects: ProjectShort[]) => void;
}

export interface AuthViewModelRepository {
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

export interface UserViewModelRepository {
    email: () => string;
    id: () => number;
    isAuthenticated: () => boolean;

    setUserInfo: (userInfo: UserInfo) => void;
}

export interface PersistenceViewModelRepository {
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

export interface ViewModelRepository {
    projectViewModelRepository: ProjectViewModelRepository;
    ideViewModelRepository: IdeViewModelRepository;
    persistenceViewModelRepository: PersistenceViewModelRepository;
    userViewModelRepository: UserViewModelRepository;
    authViewModelRepository: AuthViewModelRepository;
    projectsViewModelRepository: ProjectsViewModelRepository;
    settingsViewModelRepository: SettingsViewModelRepository;
    navigate: (url: string) => void;
    toast: (message: string, type: TypeOptions) => void;
    dictionary: Translations;
    resetToInitialState: () => void;
    location: () => string;
    scrollEditorToBottom: () => void;
}
