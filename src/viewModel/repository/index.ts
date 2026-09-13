import { AgentStopReason } from '../../model/rpi/agentSocket.ts';
import {
    AGENT_ITERATION_OPTIONS,
    AGENT_TOKEN_OPTIONS,
} from '../../model/rpi/agentSocket.ts';

export type MobileView = 'files' | 'editor' | 'pdf' | 'chat';
export type ViewerTab = 'pdf' | 'chat';
import {
    AgentHistoryEntry,
    CompileErrorResultList,
    CompileSuccessResult,
    Hunk,
    LabkeeperFile,
    OutputSegment,
    Program,
    Project,
    ProjectType,
    ProjectShort,
    UserInfo,
} from '../../model/domain.ts';
import { BillingPricingResponse } from '../../model/rpi';

import { Language, Translations } from '../dictionaries';

import { TypeOptions } from 'react-toastify';
import { en } from '../dictionaries/en.ts';

export type AuthView =
    'login' | 'email' | 'code' | 'password' | 'success' | 'closed';
export type EmailRequestState =
    | 'unknown'
    | 'loading'
    | 'ok'
    | 'userNotFound'
    | 'userExists'
    | 'validationError'
    | 'unknownError';
export type CodeRequestState =
    'unknown' | 'loading' | 'ok' | 'invalid' | 'unknownError';
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
    'unknown' | 'ok' | 'error' | 'loading' | 'forbidden' | 'not_found';

export type GetFilesRequestState =
    'unknown' | 'ok' | 'error' | 'loading' | 'forbidden';

export type GetProjectsRequestState =
    'unknown' | 'ok' | 'error' | 'loading' | 'unauth';

export type SaveProjectRequestState = 'unknown' | 'ok' | 'error' | 'loading';

export type BillingPricingRequestState = 'unknown' | 'loading' | 'ok' | 'error';

/** Стадия прогона агента. Блокировка правок и спиннер в ленте — производные от неё */
export type AgentRequestState =
    'idle' | 'connecting' | 'running' | 'ok' | 'error';

export type HistoryRequestState = 'unknown' | 'loading' | 'ok' | 'error';

/**
 * Элемент ленты чата. Спиннер тут не хранится: он рисуется на последнем элементе,
 * пока requestState это connecting или running. Иначе на каждое событие пришлось бы
 * переписывать предыдущий элемент, а при обрыве спиннер остался бы навсегда.
 */
export type ChatMessage =
    | { kind: 'request'; id: number; text: string; createdAt: string }
    | { kind: 'response'; id: number; text: string }
    | { kind: 'error'; id: number; reason: AgentErrorReason }
    /** Прогон дошёл до конца, но с оговоркой: изменения применены, а не отменены */
    | { kind: 'notice'; id: number; reason: AgentErrorReason }
    | {
          kind: 'event';
          id: number;
          /** Ключ строки в словаре, например event.add_segment */
          labelKey: string;
          file?: string;
          segmentId?: number;
          lines?: string;
          /** Куда прокрутить редактор по клику */
          target?: EditorNavigationTarget;
      };

/** Omit по объединению должен раздаваться по вариантам, иначе union схлопнется */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
    ? Omit<T, K>
    : never;

export type ChatMessageDraft = DistributiveOmit<ChatMessage, 'id'>;

/** Причина, по которой в ленте показана ошибка */
export type AgentErrorReason =
    | AgentStopReason
    | 'timeout'
    | 'disconnected'
    | 'connect_failed'
    /** Проект не удалось сохранить перед запуском, агент работал бы со старой версией */
    | 'save_failed';
export type BillingPurchaseRequestState = 'idle' | 'loading' | 'ok' | 'error';

export type PendingSegmentEditorCursor = {
    segmentIndex: number;
    offset: number;
};

export type EditorNavigationTarget = {
    /** Индекс сегмента; -1 если цель — текстовый файл (`file`). */
    segmentIndex: number;
    line: number;
    /** Путь к открытому/открываемому текстовому файлу проекта. */
    file?: string;
    /** false: только прокрутить, без курсора и фокуса. По умолчанию true */
    focus?: boolean;
};

/** Совпадение, к которому перешли. Смещения 0-based в тексте сегмента */
export type SearchCurrentMatch = {
    segmentIndex: number;
    from: number;
    to: number;
};

/** Верх видимой области списка сегментов */
export type SegmentsViewportAnchor = {
    segmentIndex: number;
    /** 1-based */
    line: number;
};

class MockViewModelRepositoryState {
    location = '/';

    activeSegmentIndex = -1;
    search: string | undefined = undefined;
    searchInput = '';
    searchNoMatch = false;
    searchCurrentMatch: SearchCurrentMatch | null = null;
    previousActiveSegmentIndex = -1;
    pendingSegmentEditorCursor: PendingSegmentEditorCursor | null = null;
    activeEditorLine: number | null = null;
    synctexEditorPosition: EditorNavigationTarget | null = null;
    pdfClickPosition: import('../../model/rpi').PdfPosition | null = null;
    pdfNavigationTarget: import('../../model/rpi').PdfPosition | null = null;
    editorNavigationTarget: EditorNavigationTarget | null = null;
    redoEnabled: boolean = false;
    undoEnabled: boolean = false;
    cloneRequestState: CloneRequestState = 'unknown';
    getProjectRequestState: GetProjectRequestState = 'unknown';
    getFilesRequestState: GetFilesRequestState = 'unknown';
    getProjectsRequestState: GetProjectsRequestState = 'unknown';
    saveProjectRequestState: SaveProjectRequestState = 'unknown';
    saveTextFileRequestState: SaveProjectRequestState = 'unknown';
    loadTextFileRequestState: SaveProjectRequestState = 'unknown';
    activeTextFile: string | null = null;
    activeImageFile: string | null = null;
    textFileContent = '';

    pdfUri: string | undefined;
    mode: ProjectType = 'latex';
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
    billingPricing: BillingPricingResponse | undefined = undefined;
    billingPricingRequestState: BillingPricingRequestState = 'unknown';
    billingPurchaseRequestState: BillingPurchaseRequestState = 'idle';
    billingPaymentWidgetToken: string | undefined = undefined;

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
    captchaBypassToken: string | undefined = undefined;
    showPrivacyPolicyAcceptanceModal = false;
    showCrossBorderConsentModal = false;
    currentFolderPath = '';
    ephemeralFolders: string[] = [];

    email: string = '';
    id: number = -1;
    isAuthenticated: boolean = false;
    tokenBalance: number = 0;
    crossBorderDataTransferPolicyAccepted: boolean = false;

    loginRequest: LoginRequestState = 'unknown';
    codeCheckRequest: CodeRequestState = 'unknown';
    currentEmail: string | null = null;
    currentView: AuthView = 'closed';
    emailRequest: EmailRequestState = 'unknown';
    lastVerifiedCode: string | null = null;
    passwordSetRequest: PasswordRequestState = 'unknown';
    isRegistration: boolean = false;
    hunks: Hunk[] = [];
    pendingHunkIds: string[] = [];
    agentMaxTokens: number = AGENT_TOKEN_OPTIONS[0];
    agentIterations: number = AGENT_ITERATION_OPTIONS[0];
    crossBorderConsentAcceptedLocally: boolean = false;
    chatMessages: ChatMessage[] = [];
    chatNextMessageId: number = 1;
    chatRequestState: AgentRequestState = 'idle';
    chatInput: string = '';
    chatHistoryRequestState: HistoryRequestState = 'unknown';
    chatHistory: AgentHistoryEntry[] = [];

    toasts: { message: string; type: TypeOptions }[] = [];
}

export interface MockViewModelRepository extends ViewModelRepository {
    mockState: () => MockViewModelRepositoryState;
}

export const mockViewModelState = (): MockViewModelRepository => {
    const mockViewModelState = new MockViewModelRepositoryState();
    let programChangeRevision = 0;
    let savedProgramRevision = 0;
    let textFileChangeRevision = 0;
    let savedTextFileRevision = 0;
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
            searchInput: () => mockViewModelState.searchInput,
            searchNoMatch: () => mockViewModelState.searchNoMatch,
            searchCurrentMatch: () => mockViewModelState.searchCurrentMatch,
            /** В jsdom списка сегментов нет, считаем что видно начало документа */
            segmentsViewportAnchor: () => ({ segmentIndex: 0, line: 1 }),
            previousActiveSegmentIndex: () =>
                mockViewModelState.previousActiveSegmentIndex,
            pendingSegmentEditorCursor: () =>
                mockViewModelState.pendingSegmentEditorCursor,
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
            saveTextFileRequestState: () =>
                mockViewModelState.saveTextFileRequestState,
            programChangeRevision: () => programChangeRevision,
            savedProgramRevision: () => savedProgramRevision,
            textFileChangeRevision: () => textFileChangeRevision,
            savedTextFileRevision: () => savedTextFileRevision,
            loadTextFileRequestState: () =>
                mockViewModelState.loadTextFileRequestState,
            activeTextFile: () => mockViewModelState.activeTextFile,
            activeImageFile: () => mockViewModelState.activeImageFile,
            textFileContent: () => mockViewModelState.textFileContent,
            pdfUpdated: () => mockViewModelState.pdfUpdated,
            activeEditorLine: () => mockViewModelState.activeEditorLine,
            synctexEditorPosition: () =>
                mockViewModelState.synctexEditorPosition,
            pdfClickPosition: () => mockViewModelState.pdfClickPosition,
            pdfNavigationTarget: () => mockViewModelState.pdfNavigationTarget,
            editorNavigationTarget: () =>
                mockViewModelState.editorNavigationTarget,
            hunks: () => mockViewModelState.hunks,
            pendingHunkIds: () => mockViewModelState.pendingHunkIds,

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
            setSaveTextFileRequestState: (v: SaveProjectRequestState) =>
                (mockViewModelState.saveTextFileRequestState = v),
            markProgramChanged: () => (programChangeRevision += 1),
            markProgramRevisionSaved: (revision: number) =>
                revision <= programChangeRevision
                    ? (savedProgramRevision = Math.max(
                          savedProgramRevision,
                          revision
                      ))
                    : undefined,
            resetProgramRevisions: () => {
                savedProgramRevision = programChangeRevision;
            },
            markTextFileChanged: () => (textFileChangeRevision += 1),
            markTextFileRevisionSaved: (revision: number) =>
                revision <= textFileChangeRevision
                    ? (savedTextFileRevision = Math.max(
                          savedTextFileRevision,
                          revision
                      ))
                    : undefined,
            resetTextFileRevisions: () => {
                savedTextFileRevision = textFileChangeRevision;
            },
            setLoadTextFileRequestState: (v: SaveProjectRequestState) =>
                (mockViewModelState.loadTextFileRequestState = v),
            setActiveTextFile: (fileName: string | null) =>
                (mockViewModelState.activeTextFile = fileName),
            setActiveImageFile: (fileName: string | null) =>
                (mockViewModelState.activeImageFile = fileName),
            setTextFileContent: (content: string) =>
                (mockViewModelState.textFileContent = content),
            setUndoEnabled: (v: boolean) =>
                (mockViewModelState.undoEnabled = v),
            setRedoEnabled: (v: boolean) =>
                (mockViewModelState.redoEnabled = v),
            setSearch: (v: string | undefined) =>
                (mockViewModelState.search = v),
            setSearchInput: (v: string) => (mockViewModelState.searchInput = v),
            setSearchNoMatch: (v: boolean) =>
                (mockViewModelState.searchNoMatch = v),
            setSearchCurrentMatch: (v: SearchCurrentMatch | null) =>
                (mockViewModelState.searchCurrentMatch = v),
            setActiveSegmentIndex: (index: number) =>
                (mockViewModelState.activeSegmentIndex = index),
            setPreviousActiveSegmentIndex: (index: number) =>
                (mockViewModelState.previousActiveSegmentIndex = index),
            setPendingSegmentEditorCursor: (value) =>
                (mockViewModelState.pendingSegmentEditorCursor = value),
            setActiveEditorLine: (line) =>
                (mockViewModelState.activeEditorLine = line),
            setSynctexEditorPosition: (position) =>
                (mockViewModelState.synctexEditorPosition = position),
            setPdfClickPosition: (position) =>
                (mockViewModelState.pdfClickPosition = position),
            setPdfNavigationTarget: (target) =>
                (mockViewModelState.pdfNavigationTarget = target),
            setEditorNavigationTarget: (target) =>
                (mockViewModelState.editorNavigationTarget = target),
            setHunks: (hunks) => (mockViewModelState.hunks = hunks),
            setPendingHunkIds: (ids) =>
                (mockViewModelState.pendingHunkIds = ids),
        },
        chatViewModelRepository: {
            messages: () => mockViewModelState.chatMessages,
            requestState: () => mockViewModelState.chatRequestState,
            input: () => mockViewModelState.chatInput,
            historyRequestState: () =>
                mockViewModelState.chatHistoryRequestState,
            history: () => mockViewModelState.chatHistory,
            appendMessage: (message) => {
                mockViewModelState.chatMessages = [
                    ...mockViewModelState.chatMessages,
                    {
                        ...message,
                        id: mockViewModelState.chatNextMessageId,
                    } as ChatMessage,
                ];
                mockViewModelState.chatNextMessageId += 1;
            },
            setMessages: (messages) =>
                (mockViewModelState.chatMessages = messages),
            setRequestState: (state) =>
                (mockViewModelState.chatRequestState = state),
            setInput: (input) => (mockViewModelState.chatInput = input),
            setHistoryRequestState: (state) =>
                (mockViewModelState.chatHistoryRequestState = state),
            setHistory: (history) => (mockViewModelState.chatHistory = history),
            reset: () => {
                mockViewModelState.chatMessages = [];
                mockViewModelState.chatNextMessageId = 1;
                mockViewModelState.chatRequestState = 'idle';
                mockViewModelState.chatInput = '';
                mockViewModelState.chatHistoryRequestState = 'unknown';
                mockViewModelState.chatHistory = [];
            },
        },
        persistenceViewModelRepository: {
            instructionExpanded: () => mockViewModelState.instructionExpanded,
            language: () => mockViewModelState.language,
            lastProgram: () => mockViewModelState.lastProgram,
            lastOpenedProjectUuid: () =>
                mockViewModelState.lastOpenedProjectUuid,
            agentMaxTokens: () => mockViewModelState.agentMaxTokens,
            agentIterations: () => mockViewModelState.agentIterations,
            crossBorderConsentAcceptedLocally: () =>
                mockViewModelState.crossBorderConsentAcceptedLocally,
            setAgentMaxTokens: (v) => (mockViewModelState.agentMaxTokens = v),
            setAgentIterations: (v) => (mockViewModelState.agentIterations = v),
            setCrossBorderConsentAcceptedLocally: (v) =>
                (mockViewModelState.crossBorderConsentAcceptedLocally = v),
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
            setProjectType: (mode) => (mockViewModelState.mode = mode),
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
        billingViewModelRepository: {
            paymentWidgetToken: () =>
                mockViewModelState.billingPaymentWidgetToken,
            purchaseRequestState: () =>
                mockViewModelState.billingPurchaseRequestState,
            pricing: () => mockViewModelState.billingPricing,
            pricingRequestState: () =>
                mockViewModelState.billingPricingRequestState,

            setPaymentWidgetToken: (token) =>
                (mockViewModelState.billingPaymentWidgetToken = token),
            setPurchaseRequestState: (state) =>
                (mockViewModelState.billingPurchaseRequestState = state),
            setPricing: (v) =>
                (mockViewModelState.billingPricing = structuredClone(v)),
            setPricingRequestState: (v) =>
                (mockViewModelState.billingPricingRequestState = v),
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
            captchaBypassToken: () => mockViewModelState.captchaBypassToken,
            currentFolderPath: () => mockViewModelState.currentFolderPath,
            ephemeralFolders: () => mockViewModelState.ephemeralFolders,

            setShowPrivacyPolicyAcceptanceModal: (v) =>
                (mockViewModelState.showPrivacyPolicyAcceptanceModal = v),
            setShowCrossBorderConsentModal: (v) =>
                (mockViewModelState.showCrossBorderConsentModal = v),
            setCaptchaBypassToken: (token) =>
                (mockViewModelState.captchaBypassToken = token),
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
            setCurrentFolderPath: (path: string) =>
                (mockViewModelState.currentFolderPath = path),
            setEphemeralFolders: (folders: string[]) =>
                (mockViewModelState.ephemeralFolders = [...folders]),
            addEphemeralFolder: (folder: string) => {
                if (!mockViewModelState.ephemeralFolders.includes(folder)) {
                    mockViewModelState.ephemeralFolders.push(folder);
                }
            },
            setMobileView: () => undefined,
            viewerTab: () => 'pdf',
            setViewerTab: () => undefined,
        },
        userViewModelRepository: {
            email: () => mockViewModelState.email,
            id: () => mockViewModelState.id,
            isAuthenticated: () => mockViewModelState.isAuthenticated,
            tokenBalance: () => mockViewModelState.tokenBalance,
            crossBorderDataTransferPolicyAccepted: () =>
                mockViewModelState.crossBorderDataTransferPolicyAccepted,

            setUserInfo: (userInfo) => {
                mockViewModelState.email = userInfo.email;
                mockViewModelState.isAuthenticated = userInfo.isAuthenticated;
                mockViewModelState.id = userInfo.id;
                mockViewModelState.tokenBalance = userInfo.tokenBalance ?? 0;
                mockViewModelState.crossBorderDataTransferPolicyAccepted =
                    userInfo.crossBorderDataTransferPolicyAccepted;
            },
        },

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        setLocation: (url: string, _options?: SetLocationOptions) =>
            (mockViewModelState.location = url),
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
    mode: () => ProjectType;
    pdfUri: () => string | undefined;

    setPdfUri: (uri: string | undefined) => void;
    setProjectType: (mode: ProjectType) => void;
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
    /** Запрос, зафиксированный по Enter. По нему идёт подсветка */
    search: () => string | undefined;
    /** Текст в поле. Меняется на каждый символ, подсветку не трогает */
    searchInput: () => string;
    searchNoMatch: () => boolean;
    searchCurrentMatch: () => SearchCurrentMatch | null;
    /** Считается по DOM во view-слое */
    segmentsViewportAnchor: () => SegmentsViewportAnchor | null;
    activeSegmentIndex: () => number;
    previousActiveSegmentIndex: () => number;
    pendingSegmentEditorCursor: () => PendingSegmentEditorCursor | null;
    redoEnabled: () => boolean;
    undoEnabled: () => boolean;
    cloneRequestState: () => CloneRequestState;
    getProjectRequestState: () => GetProjectRequestState;
    getFilesRequestState: () => GetFilesRequestState;
    getProjectsRequestState: () => GetProjectsRequestState;
    saveProjectRequestState: () => SaveProjectRequestState;
    saveTextFileRequestState: () => SaveProjectRequestState;
    programChangeRevision: () => number;
    savedProgramRevision: () => number;
    textFileChangeRevision: () => number;
    savedTextFileRevision: () => number;
    loadTextFileRequestState: () => SaveProjectRequestState;
    activeTextFile: () => string | null;
    activeImageFile: () => string | null;
    textFileContent: () => string;
    pdfUpdated: () => number;
    activeEditorLine: () => number | null;
    synctexEditorPosition: () => EditorNavigationTarget | null;
    pdfClickPosition: () => import('../../model/rpi').PdfPosition | null;
    pdfNavigationTarget: () => import('../../model/rpi').PdfPosition | null;
    editorNavigationTarget: () => EditorNavigationTarget | null;
    hunks: () => Hunk[];
    pendingHunkIds: () => string[];

    setPdfUpdated: (v: number) => void;
    setRedoEnabled: (v: boolean) => void;
    setUndoEnabled: (v: boolean) => void;
    setSearch: (search: string | undefined) => void;
    setSearchInput: (text: string) => void;
    setSearchNoMatch: (noMatch: boolean) => void;
    setSearchCurrentMatch: (match: SearchCurrentMatch | null) => void;
    setActiveSegmentIndex: (index: number) => void;
    setPreviousActiveSegmentIndex: (index: number) => void;
    setPendingSegmentEditorCursor: (
        value: PendingSegmentEditorCursor | null
    ) => void;
    setActiveEditorLine: (line: number | null) => void;
    setSynctexEditorPosition: (position: EditorNavigationTarget | null) => void;
    setPdfClickPosition: (
        position: import('../../model/rpi').PdfPosition | null
    ) => void;
    setPdfNavigationTarget: (
        target: import('../../model/rpi').PdfPosition | null
    ) => void;
    setEditorNavigationTarget: (target: EditorNavigationTarget | null) => void;
    setHunks: (hunks: Hunk[]) => void;
    setPendingHunkIds: (ids: string[]) => void;
    setCloneRequestState: (state: CloneRequestState) => void;
    setGetProjectRequestState: (state: GetProjectRequestState) => void;
    setGetFilesRequestState: (state: GetFilesRequestState) => void;
    setGetProjectsRequestState: (state: GetProjectsRequestState) => void;
    setSaveProjectRequestState: (state: SaveProjectRequestState) => void;
    setSaveTextFileRequestState: (state: SaveProjectRequestState) => void;
    markProgramChanged: () => void;
    markProgramRevisionSaved: (revision: number) => void;
    resetProgramRevisions: () => void;
    markTextFileChanged: () => void;
    markTextFileRevisionSaved: (revision: number) => void;
    resetTextFileRevisions: () => void;
    setLoadTextFileRequestState: (state: SaveProjectRequestState) => void;
    setActiveTextFile: (fileName: string | null) => void;
    setActiveImageFile: (fileName: string | null) => void;
    setTextFileContent: (content: string) => void;
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
    captchaBypassToken: () => string | undefined;
    filesToDelete: () => LabkeeperFile[];
    currentFolderPath: () => string;
    ephemeralFolders: () => string[];

    setShowPrivacyPolicyAcceptanceModal: (v: boolean) => void;
    setShowCrossBorderConsentModal: (v: boolean) => void;
    setCaptchaBypassToken: (token?: string) => void;
    setTourVisibility: (visible: boolean) => void;
    setEditModeForFilename: (edit: boolean) => void;
    setEditModeForProjectTitle: (edit: boolean) => void;
    setShowSearch: (show: boolean) => void;
    setExpandProblemViewer: (expandProblemViewer: boolean) => void;
    setShowFileManager: (showFileManager: boolean) => void;
    setIsCompiling: (value: boolean) => void;
    setIsFileDraggedToFileManager: (value: boolean) => void;
    setFilesToDelete: (files: LabkeeperFile[]) => void;
    setCurrentFolderPath: (path: string) => void;
    setEphemeralFolders: (folders: string[]) => void;
    addEphemeralFolder: (folder: string) => void;
    setMobileView: (view: MobileView) => void;
    viewerTab: () => ViewerTab;
    setViewerTab: (tab: ViewerTab) => void;
}

export interface ProjectsViewModelRepository {
    projects: () => ProjectShort[];

    setProjects: (projects: ProjectShort[]) => void;
}

export interface BillingViewModelRepository {
    paymentWidgetToken: () => string | undefined;
    purchaseRequestState: () => BillingPurchaseRequestState;
    pricing: () => BillingPricingResponse | undefined;
    pricingRequestState: () => BillingPricingRequestState;

    setPaymentWidgetToken: (token: string | undefined) => void;
    setPurchaseRequestState: (state: BillingPurchaseRequestState) => void;
    setPricing: (pricing: BillingPricingResponse | undefined) => void;
    setPricingRequestState: (state: BillingPricingRequestState) => void;
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
    tokenBalance: () => number;
    crossBorderDataTransferPolicyAccepted: () => boolean;

    setUserInfo: (userInfo: UserInfo) => void;
}

export interface ChatViewModelRepository {
    messages: () => ChatMessage[];
    requestState: () => AgentRequestState;
    input: () => string;
    historyRequestState: () => HistoryRequestState;
    history: () => AgentHistoryEntry[];

    appendMessage: (message: ChatMessageDraft) => void;
    setMessages: (messages: ChatMessage[]) => void;
    setRequestState: (state: AgentRequestState) => void;
    setInput: (input: string) => void;
    setHistoryRequestState: (state: HistoryRequestState) => void;
    setHistory: (history: AgentHistoryEntry[]) => void;
    reset: () => void;
}

export interface PersistenceViewModelRepository {
    language: () => Language;
    lastProgram: () => Program;
    instructionExpanded: () => boolean;
    lastOpenedProjectUuid: () => string | undefined;
    agentMaxTokens: () => number;
    agentIterations: () => number;
    crossBorderConsentAcceptedLocally: () => boolean;

    setCrossBorderConsentAcceptedLocally: (value: boolean) => void;
    setAgentMaxTokens: (value: number) => void;
    setAgentIterations: (value: number) => void;
    setLastOpenedProjectUuid: (uuid: string | undefined) => void;
    setLanguage: (language: Language) => void;
    setInstructionExpanded: (instructionExpanded: boolean) => void;
    setLastProgram: (lastProgram: Program) => void;
    clearLastProgram: () => void;
}

export type SetLocationOptions = {
    replace?: boolean;
};

export interface ViewModelRepository {
    projectViewModelRepository: ProjectViewModelRepository;
    ideViewModelRepository: IdeViewModelRepository;
    persistenceViewModelRepository: PersistenceViewModelRepository;
    userViewModelRepository: UserViewModelRepository;
    authViewModelRepository: AuthViewModelRepository;
    projectsViewModelRepository: ProjectsViewModelRepository;
    billingViewModelRepository: BillingViewModelRepository;
    settingsViewModelRepository: SettingsViewModelRepository;
    chatViewModelRepository: ChatViewModelRepository;
    setLocation: (url: string, options?: SetLocationOptions) => void;
    toast: (message: string, type: TypeOptions) => void;
    dictionary: Translations;
    location: () => string;
    scrollEditorToBottom: () => void;
}
