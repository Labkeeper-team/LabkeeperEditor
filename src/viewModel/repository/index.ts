import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    OutputSegment,
    Program,
    Project,
    ProjectMode,
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

export type SaveProjectRequestState = 'unknown' | 'ok' | 'error' | 'loading';

class MockViewModelRepositoryState {
    location = '/';

    activeSegmentIndex = -1;
    search: string | undefined = undefined;
    previousActiveSegmentIndex = -1;
    redoEnabled: boolean = false;
    undoEnabled: boolean = false;
    cloneRequestState: CloneRequestState = 'unknown';
    getProjectRequestState: GetProjectRequestState = 'unknown';
    getFilesRequestState: GetFilesRequestState = 'unknown';
    getProjectsRequestState: GetProjectsRequestState = 'unknown';
    saveProjectRequestState: SaveProjectRequestState = 'unknown';

    pdfUri: string | undefined;
    mode: ProjectMode = 'markdown';
    instructionExpanded = false;
    language: 'ru' | 'en' = 'ru';
    lastProgram: Program = {
        segments: [],
        parameters: {
            roundStrategy: 'firstMeaningDigit',
        },
    };
    lastOpenedProjectUuid: string | undefined = undefined;

    compileErrorResult: CompileErrorResultList | undefined = undefined;
    compileSuccessResult: CompileSuccessResult = { segments: [] };
    project: Project | undefined = undefined;
    projectIsReadonly = false;
    currentProgram: Program = {
        segments: [],
        parameters: { roundStrategy: 'firstMeaningDigit' },
    };
    files: LabkeeperFile[] = [];

    projects: ProjectShort[] = [];

    pdfUpdated: number = 0;
    isAutocompleteLoading = false;
    editModeForFilename = false;
    editModeForProjectTitle = false;
    expandProblemViewer = false;
    isFileDraggedToManager = false;
    showFileManager = false;
    showSearch = false;
    showShareModal = false;
    showTour = false;
    filesToDelete: LabkeeperFile[] = [];

    email: string = '';
    id: number = -1;
    isAuthenticated: boolean = false;

    loginRequest: LoginRequestState = 'unknown';
    codeCheckRequest: CodeRequestState = 'unknown';
    currentEmail: string | null = null;
    currentView: AuthView = 'closed';
    emailRequest: EmailRequestState = 'unknown';
    lastVerifiedCode: string | null = null;
    passwordSetRequest: PasswordRequestState = 'unknown';
    isRegistration: boolean = false;

    toasts: { message: string; type: TypeOptions }[] = [];
}

export interface MockViewModelRepository extends ViewModelRepository {
    mockState: () => MockViewModelRepositoryState;
}

export const mockViewModelState = (): MockViewModelRepository => {
    const mockViewModelState = new MockViewModelRepositoryState();
    return {
        mockState: () => mockViewModelState,
        scrollEditorToBottom: () => ({}),
        location: () => mockViewModelState.location,
        authViewModelRepository: {
            codeCheckRequest: () => mockViewModelState.codeCheckRequest,
            currentEmail: () => mockViewModelState.currentEmail,
            currentView: () => mockViewModelState.currentView,
            emailRequest: () => mockViewModelState.emailRequest,
            lastVerifiedCode: () => mockViewModelState.lastVerifiedCode,
            passwordSetRequest: () => mockViewModelState.passwordSetRequest,
            loginRequest: () => mockViewModelState.loginRequest,
            isRegistration: () => mockViewModelState.isRegistration,

            setCurrentEmail: (email) =>
                (mockViewModelState.currentEmail = email),
            setEmailRequest: (request) =>
                (mockViewModelState.emailRequest = request),
            setCurrentView: (view) => (mockViewModelState.currentView = view),
            setCodeCheckRequest: (request) =>
                (mockViewModelState.codeCheckRequest = request),
            setLastVerifiedCode: (code) =>
                (mockViewModelState.lastVerifiedCode = code),
            setLoginRequest: (request) =>
                (mockViewModelState.loginRequest = request),
            setPasswordRequest: (request) =>
                (mockViewModelState.passwordSetRequest = request),
            setIsRegistration: (v) => (mockViewModelState.isRegistration = v),
        },
        ideViewModelRepository: {
            activeSegmentIndex: () => mockViewModelState.activeSegmentIndex,
            search: () => mockViewModelState.search,
            previousActiveSegmentIndex: () =>
                mockViewModelState.previousActiveSegmentIndex,
            redoEnabled: () => mockViewModelState.redoEnabled,
            undoEnabled: () => mockViewModelState.undoEnabled,
            cloneRequestState: () => mockViewModelState.cloneRequestState,
            getProjectRequestState: () =>
                mockViewModelState.getProjectRequestState,
            getFilesRequestState: () => mockViewModelState.getFilesRequestState,
            getProjectsRequestState: () =>
                mockViewModelState.getProjectsRequestState,
            saveProjectRequestState: () =>
                mockViewModelState.saveProjectRequestState,
            pdfUpdated: () => mockViewModelState.pdfUpdated,

            setPdfUpdated: (v) => (mockViewModelState.pdfUpdated = v),
            setGetProjectsRequestState: (v: GetProjectsRequestState) =>
                (mockViewModelState.getProjectsRequestState = v),
            setGetFilesRequestState: (v: GetFilesRequestState) =>
                (mockViewModelState.getFilesRequestState = v),
            setCloneRequestState: (v: CloneRequestState) =>
                (mockViewModelState.cloneRequestState = v),
            setGetProjectRequestState: (v: GetProjectRequestState) =>
                (mockViewModelState.getProjectRequestState = v),
            setSaveProjectRequestState: (v: SaveProjectRequestState) =>
                (mockViewModelState.saveProjectRequestState = v),
            setUndoEnabled: (v: boolean) =>
                (mockViewModelState.undoEnabled = v),
            setRedoEnabled: (v: boolean) =>
                (mockViewModelState.redoEnabled = v),
            setSearch: (v: string | undefined) =>
                (mockViewModelState.search = v),
            setActiveSegmentIndex: (index: number) =>
                (mockViewModelState.activeSegmentIndex = index),
            setPreviousActiveSegmentIndex: (index: number) =>
                (mockViewModelState.previousActiveSegmentIndex = index),
        },
        persistenceViewModelRepository: {
            instructionExpanded: () => mockViewModelState.instructionExpanded,
            language: () => mockViewModelState.language,
            lastProgram: () => mockViewModelState.lastProgram,
            lastOpenedProjectUuid: () =>
                mockViewModelState.lastOpenedProjectUuid,

            setLastOpenedProjectUuid: (uuid) =>
                (mockViewModelState.lastOpenedProjectUuid = uuid),
            setInstructionExpanded: (v) =>
                (mockViewModelState.instructionExpanded = v),
            setLanguage: (v) =>
                (mockViewModelState.language = structuredClone(v)),
            setLastProgram: (v) =>
                (mockViewModelState.lastProgram = structuredClone(v)),
            clearLastProgram: () =>
                (mockViewModelState.lastProgram = {
                    segments: [],
                    parameters: { roundStrategy: 'firstMeaningDigit' },
                }),
        },
        projectViewModelRepository: {
            mode: () => mockViewModelState.mode,
            compileErrorResult: () => mockViewModelState.compileErrorResult,
            compileSuccessResult: () => mockViewModelState.compileSuccessResult,
            project: () => mockViewModelState.project,
            projectIsReadonly: () => mockViewModelState.projectIsReadonly,
            currentProgram: () => mockViewModelState.currentProgram,
            files: () => mockViewModelState.files,
            pdfUri: () => mockViewModelState.pdfUri,

            setPdfUri: (uri) => (mockViewModelState.pdfUri = uri),
            setProjectMode: (mode) => (mockViewModelState.mode = mode),
            setInputSegmentText: (index, text) => {
                mockViewModelState.currentProgram.segments[index].text = text;
            },
            setCompileResultSegmentsSize: (size: number) => {
                mockViewModelState.compileSuccessResult.segments.length = size;
            },
            setCompileResultForSegment: (
                index: number,
                segment: OutputSegment
            ) => {
                if (
                    mockViewModelState.compileSuccessResult.segments.length >
                    index
                ) {
                    mockViewModelState.compileSuccessResult.segments[index] =
                        segment;
                }
            },
            setReadOnly: (v: boolean) =>
                (mockViewModelState.projectIsReadonly = v),
            setProject: (v?: Project) =>
                (mockViewModelState.project = structuredClone(v)),
            setCompileResult: (v: CompileSuccessResult) =>
                (mockViewModelState.compileSuccessResult = structuredClone(v)),
            setCompileErrorResult: (v: CompileErrorResultList) =>
                (mockViewModelState.compileErrorResult = structuredClone(v)),
            setFiles: (v: LabkeeperFile[]) =>
                (mockViewModelState.files = structuredClone(v)),
            setCurrentProgram: (v) =>
                (mockViewModelState.currentProgram = structuredClone(v)),
        },
        projectsViewModelRepository: {
            projects: () => mockViewModelState.projects,

            setProjects: (v: ProjectShort[]) =>
                (mockViewModelState.projects = structuredClone(v)),
        },
        settingsViewModelRepository: {
            isAutocompleteLoading: () =>
                mockViewModelState.isAutocompleteLoading,
            editModeForFilename: () => mockViewModelState.editModeForFilename,
            editModeForProjectTitle: () =>
                mockViewModelState.editModeForProjectTitle,
            expandProblemViewer: () => mockViewModelState.expandProblemViewer,
            isFileDraggedToManager: () =>
                mockViewModelState.isFileDraggedToManager,
            showFileManager: () => mockViewModelState.showFileManager,
            showSearch: () => mockViewModelState.showSearch,
            showShareModal: () => mockViewModelState.showShareModal,
            showTour: () => mockViewModelState.showTour,
            filesToDelete: () => mockViewModelState.filesToDelete,

            setShowSearch: (v: boolean) => (mockViewModelState.showSearch = v),
            setShowFileManager: (v: boolean) =>
                (mockViewModelState.showFileManager = v),
            setExpandProblemViewer: (v: boolean) =>
                (mockViewModelState.expandProblemViewer = v),
            setTourVisibility: (v: boolean) =>
                (mockViewModelState.showTour = v),
            setEditModeForFilename: (v: boolean) =>
                (mockViewModelState.editModeForFilename = v),
            setEditModeForProjectTitle: (v: boolean) =>
                (mockViewModelState.editModeForProjectTitle = v),
            setIsCompiling: (v: boolean) =>
                (mockViewModelState.isAutocompleteLoading = v),
            setIsFileDraggedToFileManager: (v: boolean) =>
                (mockViewModelState.isFileDraggedToManager = v),
            setFilesToDelete: (v: LabkeeperFile[]) =>
                (mockViewModelState.filesToDelete = structuredClone(v)),
        },
        userViewModelRepository: {
            email: () => mockViewModelState.email,
            id: () => mockViewModelState.id,
            isAuthenticated: () => mockViewModelState.isAuthenticated,

            setUserInfo: (userInfo) => {
                mockViewModelState.email = userInfo.email;
                mockViewModelState.isAuthenticated = userInfo.isAuthenticated;
                mockViewModelState.id = userInfo.id;
            },
        },

        setLocation: (url: string) => (mockViewModelState.location = url),
        dictionary: en,
        toast: (message: string, type: TypeOptions) =>
            mockViewModelState.toasts.push({ message, type }),
    };
};

export interface ProjectViewModelRepository {
    project: () => Project | undefined;
    compileSuccessResult: () => CompileSuccessResult;
    compileErrorResult: () => CompileErrorResultList | undefined;
    projectIsReadonly: () => boolean;
    currentProgram: () => Program;
    files: () => LabkeeperFile[];
    mode: () => ProjectMode;
    pdfUri: () => string | undefined;

    setPdfUri: (uri: string | undefined) => void;
    setProjectMode: (mode: ProjectMode) => void;
    setInputSegmentText: (index: number, text: string) => void;
    setCompileResultSegmentsSize: (size: number) => void;
    setCompileResultForSegment: (index: number, segment: OutputSegment) => void;
    setReadOnly: (value: boolean) => void;
    setProject: (project?: Project) => void;
    setCompileResult: (compileResult: CompileSuccessResult) => void;
    setCompileErrorResult: (
        compileErrorResultList: CompileErrorResultList
    ) => void;
    setFiles: (files: LabkeeperFile[]) => void;
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
    saveProjectRequestState: () => SaveProjectRequestState;
    pdfUpdated: () => number;

    setPdfUpdated: (v: number) => void;
    setRedoEnabled: (v: boolean) => void;
    setUndoEnabled: (v: boolean) => void;
    setSearch: (search: string | undefined) => void;
    setActiveSegmentIndex: (index: number) => void;
    setPreviousActiveSegmentIndex: (index: number) => void;
    setCloneRequestState: (state: CloneRequestState) => void;
    setGetProjectRequestState: (state: GetProjectRequestState) => void;
    setGetFilesRequestState: (state: GetFilesRequestState) => void;
    setGetProjectsRequestState: (state: GetProjectsRequestState) => void;
    setSaveProjectRequestState: (state: SaveProjectRequestState) => void;
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
    filesToDelete: () => LabkeeperFile[];

    setTourVisibility: (visible: boolean) => void;
    setEditModeForFilename: (edit: boolean) => void;
    setEditModeForProjectTitle: (edit: boolean) => void;
    setShowSearch: (show: boolean) => void;
    setExpandProblemViewer: (expandProblemViewer: boolean) => void;
    setShowFileManager: (showFileManager: boolean) => void;
    setIsCompiling: (value: boolean) => void;
    setIsFileDraggedToFileManager: (value: boolean) => void;
    setFilesToDelete: (files: LabkeeperFile[]) => void;
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
    setModeToProject: (id: string, mode: ProjectMode) => void;
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
    setLocation: (url: string) => void;
    toast: (message: string, type: TypeOptions) => void;
    dictionary: Translations;
    location: () => string;
    scrollEditorToBottom: () => void;
}
