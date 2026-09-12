import {
    AgentHistoryEntry,
    CompileErrorResultList,
    CompileSuccessResult,
    Hunk,
    LabkeeperFile,
    Program,
    Project,
    ProjectShort,
    ProjectType,
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
    PendingSegmentEditorCursor,
    SaveProjectRequestState,
} from '../../../viewModel/repository';
import { createEmptyProgram } from '../../../model/repository/ProgramRepository.ts';
import {
    AGENT_ITERATION_OPTIONS,
    AGENT_TOKEN_OPTIONS,
} from '../../../model/rpi/agentSocket.ts';
import { PdfPosition } from '../../../model/rpi';
import { BillingPricingResponse } from '../../../model/rpi';
import {
    AgentRequestState,
    ChatMessage,
    EditorNavigationTarget,
    HistoryRequestState,
    MobileView,
    SearchCurrentMatch,
    ViewerTab,
} from '../../../viewModel/repository';

export type { MobileView, ViewerTab };

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
    showPrivacyPolicyAcceptanceModal: boolean;
    showCrossBorderConsentModal: boolean;
    filesToDelete: LabkeeperFile[];
    captchaBypassToken: string | undefined;
    currentFolderPath: string;
    ephemeralFolders: string[];
    mobileView: MobileView;
    viewerTab: ViewerTab;
}

interface ProjectsState {
    projects: ProjectShort[];
}

interface BillingState {
    pricing?: BillingPricingResponse;
    pricingRequestState: BillingPricingRequestState;
    purchaseRequestState: BillingPurchaseRequestState;
    paymentWidgetToken?: string;
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
    saveTextFileRequestState: SaveProjectRequestState;
    programChangeRevision: number;
    savedProgramRevision: number;
    textFileChangeRevision: number;
    savedTextFileRevision: number;
    loadTextFileRequestState: SaveProjectRequestState;
    activeTextFile: string | null;
    activeImageFile: string | null;
    textFileContent: string;
    pdfUpdated: number;
    activeEditorLine: number | null;
    /** Последняя позиция курсора для SyncTeX (сохраняется при blur). */
    synctexEditorPosition: EditorNavigationTarget | null;
    pdfClickPosition: PdfPosition | null;
    pdfNavigationTarget: PdfPosition | null;
    editorNavigationTarget: EditorNavigationTarget | null;
    /** Текст в поле. Подсветка идёт от search */
    searchInput: string;
    /** Последний Enter ничего не нашёл */
    searchNoMatch: boolean;
    /** Совпадение, к которому перешли последним Enter */
    searchCurrentMatch: SearchCurrentMatch | null;
    hunks: Hunk[];
    pendingHunkIds: string[];
}

interface PersistenceState {
    language: Language;
    lastProgram: Program;
    instructionExpanded: boolean;
    lastOpenedProjectUuid?: string;
    /** Настройки агента переживают перезагрузку, история чата — нет */
    agentMaxTokens: number;
    agentIterations: number;
    /**
     * Согласие на трансграничную передачу, данное до входа в аккаунт.
     * После входа уезжает на сервер, чтобы не спрашивать второй раз
     */
    crossBorderConsentAcceptedLocally: boolean;
}

export interface ChatState {
    messages: ChatMessage[];
    nextMessageId: number;
    requestState: AgentRequestState;
    input: string;
    historyRequestState: HistoryRequestState;
    history: AgentHistoryEntry[];
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
    saveTextFileRequestState: 'unknown',
    programChangeRevision: 0,
    savedProgramRevision: 0,
    textFileChangeRevision: 0,
    savedTextFileRevision: 0,
    loadTextFileRequestState: 'unknown',
    activeTextFile: null,
    activeImageFile: null,
    textFileContent: '',
    pdfUpdated: 0,
    activeEditorLine: null,
    synctexEditorPosition: null,
    pdfClickPosition: null,
    pdfNavigationTarget: null,
    editorNavigationTarget: null,
    searchInput: '',
    searchNoMatch: false,
    searchCurrentMatch: null,
    hunks: [],
    pendingHunkIds: [],
};

export const persistenceInitialState: PersistenceState = {
    language: navigator.language.includes('ru') ? 'ru' : 'en',
    lastProgram: createEmptyProgram(),
    instructionExpanded: true,
    lastOpenedProjectUuid: undefined,
    agentMaxTokens: AGENT_TOKEN_OPTIONS[0],
    agentIterations: AGENT_ITERATION_OPTIONS[0],
    crossBorderConsentAcceptedLocally: false,
};

export const chatInitialState: ChatState = {
    messages: [],
    nextMessageId: 1,
    requestState: 'idle',
    input: '',
    historyRequestState: 'unknown',
    history: [],
};

export const projectInitialState: ProjectState = {
    compileErrorResult: { errors: [] },
    projectIsReadonly: true,
    compileSuccessResult: { segments: [] },
    files: [],
    currentProgram: createEmptyProgram(),
    mode: 'latex',
    pdfUri: undefined,
};

export const projectsInitialState: ProjectsState = {
    projects: [],
};

export type BillingPricingRequestState = 'unknown' | 'loading' | 'ok' | 'error';
export type BillingPurchaseRequestState = 'idle' | 'loading' | 'ok' | 'error';

export const billingInitialState: BillingState = {
    pricing: undefined,
    pricingRequestState: 'unknown',
    purchaseRequestState: 'idle',
    paymentWidgetToken: undefined,
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
    showPrivacyPolicyAcceptanceModal: false,
    showCrossBorderConsentModal: false,
    filesToDelete: [],
    captchaBypassToken: undefined,
    currentFolderPath: '',
    ephemeralFolders: [],
    mobileView: 'editor',
    viewerTab: 'pdf',
};

export const userInitialState: UserInfo = {
    isAuthenticated: false,
    email: '',
    id: 0,
    privacyPolicyAccepted: false,
    crossBorderDataTransferPolicyAccepted: false,
    tokenBalance: 0,
};

export const callbackInitialState: CallbackState = {
    scrollEditorToBottom: false,
};
