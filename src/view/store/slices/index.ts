import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    Program,
    Project,
    ProjectShort,
    UserInfo,
    ProjectType,
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
    PendingSegmentEditorCursor,
    ProjectPromptRequestState,
    SaveProjectRequestState,
} from '../../../viewModel/repository';
import { createEmptyProgram } from '../../../model/repository/ProgramRepository.ts';
import { PdfPosition } from '../../../model/rpi';
import { EditorNavigationTarget } from '../../../viewModel/repository';

interface CallbackState {
    scrollEditorToBottom: boolean;
}

export type MobileProjectPanel = 'editor' | 'viewer' | 'files';

interface SettingsState {
    showTour: boolean;
    showFileManager: boolean;
    activeMobilePanel: MobileProjectPanel;
    expandProblemViewer: boolean;
    showSearch: boolean;
    editModeForProjectTitle: boolean;
    editModeForFilename: boolean;
    isFileDraggedToManager: boolean;
    isCompiling: boolean;
    showShareModal: boolean;
    showContactModal: boolean;
    filesToDelete: LabkeeperFile[];
    captchaBypassToken: string | undefined;
    showProjectPromptModal: boolean;
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
    mode: ProjectType;
    pdfUri?: string;
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
    pendingSegmentEditorCursor: PendingSegmentEditorCursor | null;
    undoEnabled: boolean;
    redoEnabled: boolean;
    cloneRequestState: CloneRequestState;
    getProjectRequestState: GetProjectRequestState;
    getFilesRequestState: GetFilesRequestState;
    getProjectsRequestState: GetProjectsRequestState;
    saveProjectRequestState: SaveProjectRequestState;
    pdfUpdated: number;
    projectPromptRequestState: ProjectPromptRequestState;
    activeEditorLine: number | null;
    /** Последняя позиция курсора для SyncTeX (сохраняется при blur). */
    synctexEditorPosition: EditorNavigationTarget | null;
    pdfClickPosition: PdfPosition | null;
    pdfNavigationTarget: PdfPosition | null;
    editorNavigationTarget: EditorNavigationTarget | null;
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
    pendingSegmentEditorCursor: null,
    undoEnabled: false,
    redoEnabled: false,
    cloneRequestState: 'unknown',
    getProjectRequestState: 'unknown',
    getFilesRequestState: 'unknown',
    getProjectsRequestState: 'unknown',
    saveProjectRequestState: 'unknown',
    pdfUpdated: 0,
    projectPromptRequestState: 'unknown',
    activeEditorLine: null,
    synctexEditorPosition: null,
    pdfClickPosition: null,
    pdfNavigationTarget: null,
    editorNavigationTarget: null,
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
    mode: 'markdown',
    pdfUri: undefined,
};

export const projectsInitialState: ProjectsState = {
    projects: [],
};

export const settingsInitialState: SettingsState = {
    showTour: false,
    showFileManager: false,
    activeMobilePanel: 'editor',
    showSearch: false,
    editModeForProjectTitle: false,
    editModeForFilename: false,
    expandProblemViewer: false,
    isFileDraggedToManager: false,
    isCompiling: false,
    showShareModal: false,
    showContactModal: false,
    filesToDelete: [],
    captchaBypassToken: undefined,
    showProjectPromptModal: false,
};

export const userInitialState: UserInfo = {
    isAuthenticated: false,
    email: '',
    id: 0,
    tokens: 0,
};

export const callbackInitialState: CallbackState = {
    scrollEditorToBottom: false,
};
