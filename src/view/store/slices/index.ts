import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    Program,
    Project,
    ProjectShort,
    UserInfo,
} from '../../../model/domain.ts';

import { Language } from '../../../viewModel/dictionaries';
import {
    AuthView,
    CloneRequestState,
    CodeRequestState,
    EmailRequestState,
    GetFilesRequestState,
    GetProjectRequestState,
    GetProjectsRequestState,
    LoginRequestState,
    PasswordRequestState,
    SaveProjectRequestState,
} from '../../../viewModel/repository';
import { createEmptyProgram } from '../../../model/repository/ProgramRepository.ts';

interface CallbackState {
    scrollEditorToBottom: boolean;
}

interface SettingsState {
    showTour: boolean;
    showFileManager: boolean;
    expandProblemViewer: boolean;
    showSearch: boolean;
    editModeForProjectTitle: boolean;
    editModeForFilename: boolean;
    isFileDraggedToManager: boolean;
    isCompiling: boolean;
    showShareModal: boolean;
    showContactModal: boolean;
    filesToDelete: LabkeeperFile[];
}

interface ProjectsState {
    projects: ProjectShort[];
}

interface ProjectState {
    project?: Project;
    compileSuccessResult: CompileSuccessResult;
    compileErrorResult?: CompileErrorResultList;
    currentProgram: Program;
    projectIsReadonly: boolean;
    files: LabkeeperFile[];
}

interface AuthState {
    currentView: AuthView;
    currentEmail: string | null;
    lastVerifiedCode: string | null;
    emailRequest: EmailRequestState;
    codeCheckRequest: CodeRequestState;
    passwordSetRequest: PasswordRequestState;
    loginRequest: LoginRequestState;
    isRegistration: boolean;
}

interface IdeState {
    search?: string;
    activeSegmentIndex: number;
    previousActiveSegmentIndex: number;
    undoEnabled: boolean;
    redoEnabled: boolean;
    cloneRequestState: CloneRequestState;
    getProjectRequestState: GetProjectRequestState;
    getFilesRequestState: GetFilesRequestState;
    getProjectsRequestState: GetProjectsRequestState;
    saveProjectRequestState: SaveProjectRequestState;
}

interface PersistenceState {
    language: Language;
    lastProgram: Program;
    instructionExpanded: boolean;
    lastOpenedProjectUuid?: string;
}

export const authInitialState: AuthState = {
    currentView: 'closed',
    currentEmail: null,
    lastVerifiedCode: null,
    emailRequest: 'unknown',
    codeCheckRequest: 'unknown',
    passwordSetRequest: 'unknown',
    loginRequest: 'unknown',
    isRegistration: false,
};

export const ideInitialState: IdeState = {
    search: undefined,
    activeSegmentIndex: -1,
    previousActiveSegmentIndex: -1,
    undoEnabled: false,
    redoEnabled: false,
    cloneRequestState: 'unknown',
    getProjectRequestState: 'unknown',
    getFilesRequestState: 'unknown',
    getProjectsRequestState: 'unknown',
    saveProjectRequestState: 'unknown',
};

export const persistenceInitialState: PersistenceState = {
    language: navigator.language.includes('ru') ? 'ru' : 'en',
    lastProgram: createEmptyProgram(),
    instructionExpanded: true,
    lastOpenedProjectUuid: undefined,
};

export const projectInitialState: ProjectState = {
    compileErrorResult: { errors: [] },
    projectIsReadonly: true,
    compileSuccessResult: { segments: [] },
    files: [],
    currentProgram: createEmptyProgram(),
};

export const projectsInitialState: ProjectsState = {
    projects: [],
};

export const settingsInitialState: SettingsState = {
    showTour: false,
    showFileManager: false,
    showSearch: false,
    editModeForProjectTitle: false,
    editModeForFilename: false,
    expandProblemViewer: false,
    isFileDraggedToManager: false,
    isCompiling: false,
    showShareModal: false,
    showContactModal: false,
    filesToDelete: [],
};

export const userInitialState: UserInfo = {
    isAuthenticated: false,
    email: '',
    id: 0,
};

export const callbackInitialState: CallbackState = {
    scrollEditorToBottom: false,
};
