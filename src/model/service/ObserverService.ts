export const Events = {
    EVENT_CREATE_MD_SEGMENT: 'create_md',
    EVENT_CREATE_COMP_SEGMENT: 'create_comp',
    EVENT_CREATE_LATEX_SEGMENT: 'create_latex',
    EVENT_CREATE_ASCIIMATH_SEGMENT: 'create_ascii',
    EVENT_RUN: 'start_run',
    EVENT_ERROR: 'run_error',
    EVENT_MOVE_SEGMENT: 'segment_move',
    EVENT_INSERT_SEGMENT_BETWEEN: 'segment_insert_between',
    EVENT_PRINT: 'print_doc',
    EVENT_QR_V1: 'qr_v1',
    EVENT_PAYMENT_REQUIRED: 'payment_required',
    EVENT_PAYMENT_STARTED: 'payment_started',
    EVENT_PAYMENT_SUCCESS: 'payment_success',
    EVENT_CREATE_PROJECT: 'create_project',
    EVENT_AGENT_STARTED: 'agent_started',
    EVENT_AGENT_FINISHED: 'agent_finished',
    EVENT_AGENT_TIMEOUT: 'agent_timeout',
    FRONTEND_ERROR: 'frontend_error',
    EVENT_RPI_UNKNOWN: 'rpi_unknown',

    EVENT_PAGE_VIEWED: 'page_viewed',

    EVENT_AUTH_MODAL_OPENED: 'auth_modal_opened',
    EVENT_AUTH_MODAL_CLOSED: 'auth_modal_closed',
    EVENT_LOGIN_SUBMITTED: 'login_submitted',
    EVENT_LOGIN_SUCCEEDED: 'login_succeeded',
    EVENT_LOGIN_FAILED: 'login_failed',
    EVENT_OAUTH_STARTED: 'oauth_started',
    EVENT_REGISTRATION_STARTED: 'registration_started',
    EVENT_FORGOT_PASSWORD_STARTED: 'forgot_password_started',
    EVENT_AUTH_EMAIL_SENT: 'auth_email_sent',
    EVENT_AUTH_CODE_SUBMITTED: 'auth_code_submitted',
    EVENT_AUTH_PASSWORD_SET: 'auth_password_set',
    EVENT_LOGOUT_CONFIRMED: 'logout_confirmed',
    EVENT_PRIVACY_POLICY_ACCEPTED: 'privacy_policy_accepted',

    EVENT_CREATE_PROJECT_CLICKED: 'create_project_clicked',
    EVENT_PROJECT_CREATE_FAILED: 'project_create_failed',
    EVENT_PROJECT_OPENED: 'project_opened',
    EVENT_PROJECT_DELETED: 'project_deleted',
    EVENT_PROJECT_DELETE_CANCELLED: 'project_delete_cancelled',
    EVENT_PROJECT_TITLE_CHANGED: 'project_title_changed',
    EVENT_BACK_TO_PROJECTS: 'back_to_projects',

    EVENT_COMPILE_SUCCEEDED: 'compile_succeeded',
    EVENT_COMPILE_FAILED: 'compile_failed',
    EVENT_SYNC_TO_PDF: 'sync_to_pdf',
    EVENT_SYNC_TO_EDITOR: 'sync_to_editor',
    EVENT_COMPILE_ERROR_CLICKED: 'compile_error_clicked',
    EVENT_SEND_ERRORS_TO_AGENT: 'send_errors_to_agent',
    EVENT_EDIT_BLOCKED: 'edit_blocked',

    EVENT_SEGMENT_DELETED: 'segment_deleted',
    EVENT_SEGMENT_VISIBILITY_CHANGED: 'segment_visibility_changed',
    EVENT_PROJECT_MODE_CHANGED: 'project_mode_changed',
    EVENT_ROUND_STRATEGY_CHANGED: 'round_strategy_changed',
    EVENT_FILES_DROPPED_INTO_SEGMENT: 'files_dropped_into_segment',

    EVENT_FILE_MANAGER_OPENED: 'file_manager_opened',
    EVENT_FILE_MANAGER_CLOSED: 'file_manager_closed',
    EVENT_FILE_UPLOADED: 'file_uploaded',
    EVENT_FILE_CREATED: 'file_created',
    EVENT_FOLDER_CREATED: 'folder_created',
    EVENT_FILE_OPENED: 'file_opened',
    EVENT_FILE_RENAMED: 'file_renamed',
    EVENT_FOLDER_RENAMED: 'folder_renamed',
    EVENT_FILE_DELETED: 'file_deleted',
    EVENT_FOLDER_DELETED: 'folder_deleted',
    EVENT_FILES_MOVED: 'files_moved',

    EVENT_AGENT_PROMPT_SUBMITTED: 'agent_prompt_submitted',
    EVENT_AGENT_FAILED: 'agent_failed',
    EVENT_AGENT_SETTINGS_CHANGED: 'agent_settings_changed',
    EVENT_CHAT_HISTORY_CLEARED: 'chat_history_cleared',
    EVENT_AGENT_CHANGE_CLICKED: 'agent_change_clicked',
    EVENT_CROSS_BORDER_CONSENT_SHOWN: 'cross_border_consent_shown',
    EVENT_CROSS_BORDER_CONSENT_ACCEPTED: 'cross_border_consent_accepted',
    EVENT_CROSS_BORDER_CONSENT_DISMISSED: 'cross_border_consent_dismissed',
    EVENT_BUY_TOKENS_FROM_CHAT: 'buy_tokens_from_chat',
    EVENT_VIEWER_TAB_CHANGED: 'viewer_tab_changed',
    EVENT_MOBILE_VIEW_CHANGED: 'mobile_view_changed',

    EVENT_HUNK_ACCEPTED: 'hunk_accepted',
    EVENT_HUNK_REVERTED: 'hunk_reverted',
    EVENT_HUNKS_ACCEPTED_ALL: 'hunks_accepted_all',
    EVENT_HUNKS_REVERTED_ALL: 'hunks_reverted_all',

    EVENT_SHARE_MODAL_OPENED: 'share_modal_opened',
    EVENT_PROJECT_VISIBILITY_CHANGED: 'project_visibility_changed',
    EVENT_SHARE_LINK_COPIED: 'share_link_copied',
    EVENT_PROJECT_CLONED: 'project_cloned',

    EVENT_TOKEN_PACKAGE_SELECTED: 'token_package_selected',
    EVENT_PAYMENT_WIDGET_FAILED: 'payment_widget_failed',
    EVENT_TOKENS_TOPUP_CLICKED: 'tokens_topup_clicked',

    EVENT_LANGUAGE_CHANGED: 'language_changed',
    EVENT_MENU_ITEM_CLICKED: 'menu_item_clicked',
    EVENT_TOUR_STARTED: 'tour_started',
    EVENT_CONTACT_MODAL_OPENED: 'contact_modal_opened',
    EVENT_CONTACT_FORM_SUBMITTED: 'contact_form_submitted',
    EVENT_EDITOR_OPENED_FROM_MARKETING: 'editor_opened_from_marketing',
} as const;

export type EventValues = (typeof Events)[keyof typeof Events];

export const METRIKA_EVENTS: ReadonlySet<string> = new Set([
    Events.EVENT_CREATE_MD_SEGMENT,
    Events.EVENT_CREATE_COMP_SEGMENT,
    Events.EVENT_CREATE_LATEX_SEGMENT,
    Events.EVENT_CREATE_ASCIIMATH_SEGMENT,
    Events.EVENT_RUN,
    Events.EVENT_ERROR,
    Events.EVENT_MOVE_SEGMENT,
    Events.EVENT_INSERT_SEGMENT_BETWEEN,
    Events.EVENT_PRINT,
    Events.EVENT_QR_V1,
    Events.EVENT_PAYMENT_REQUIRED,
    Events.EVENT_PAYMENT_STARTED,
    Events.EVENT_PAYMENT_SUCCESS,
    Events.EVENT_CREATE_PROJECT,
    Events.EVENT_AGENT_STARTED,
    Events.EVENT_AGENT_FINISHED,
    Events.EVENT_AGENT_TIMEOUT,
    Events.FRONTEND_ERROR,
    Events.EVENT_RPI_UNKNOWN,
]);

export const OPENPANEL_EVENT_NAMES: Record<string, string> = {
    [Events.EVENT_CREATE_MD_SEGMENT]: 'Segment added',
    [Events.EVENT_CREATE_COMP_SEGMENT]: 'Segment added',
    [Events.EVENT_CREATE_LATEX_SEGMENT]: 'Segment added',
    [Events.EVENT_CREATE_ASCIIMATH_SEGMENT]: 'Segment added',
    [Events.EVENT_INSERT_SEGMENT_BETWEEN]: 'Segment added',
    [Events.EVENT_RUN]: 'Run clicked',
    [Events.EVENT_ERROR]: 'Run error',
    [Events.EVENT_MOVE_SEGMENT]: 'Segment moved',
    [Events.EVENT_PRINT]: 'Save PDF clicked',
    [Events.EVENT_QR_V1]: 'QR v1',
    [Events.EVENT_PAYMENT_REQUIRED]: 'Payment required',
    [Events.EVENT_PAYMENT_STARTED]: 'Payment started',
    [Events.EVENT_PAYMENT_SUCCESS]: 'Payment succeeded',
    [Events.EVENT_CREATE_PROJECT]: 'Project created',
    [Events.EVENT_AGENT_STARTED]: 'Agent started',
    [Events.EVENT_AGENT_FINISHED]: 'Agent finished',
    [Events.EVENT_AGENT_TIMEOUT]: 'Agent timeout',
    [Events.FRONTEND_ERROR]: 'Frontend error',
    [Events.EVENT_RPI_UNKNOWN]: 'RPI unknown',
    [Events.EVENT_PAGE_VIEWED]: 'Page viewed',
    [Events.EVENT_AUTH_MODAL_OPENED]: 'Auth modal opened',
    [Events.EVENT_AUTH_MODAL_CLOSED]: 'Auth modal closed',
    [Events.EVENT_LOGIN_SUBMITTED]: 'Login submitted',
    [Events.EVENT_LOGIN_SUCCEEDED]: 'Login succeeded',
    [Events.EVENT_LOGIN_FAILED]: 'Login failed',
    [Events.EVENT_OAUTH_STARTED]: 'OAuth started',
    [Events.EVENT_REGISTRATION_STARTED]: 'Registration started',
    [Events.EVENT_FORGOT_PASSWORD_STARTED]: 'Forgot password started',
    [Events.EVENT_AUTH_EMAIL_SENT]: 'Auth email sent',
    [Events.EVENT_AUTH_CODE_SUBMITTED]: 'Auth code submitted',
    [Events.EVENT_AUTH_PASSWORD_SET]: 'Auth password set',
    [Events.EVENT_LOGOUT_CONFIRMED]: 'Logout confirmed',
    [Events.EVENT_PRIVACY_POLICY_ACCEPTED]: 'Privacy policy accepted',
    [Events.EVENT_CREATE_PROJECT_CLICKED]: 'Create project clicked',
    [Events.EVENT_PROJECT_CREATE_FAILED]: 'Project create failed',
    [Events.EVENT_PROJECT_OPENED]: 'Project opened',
    [Events.EVENT_PROJECT_DELETED]: 'Project deleted',
    [Events.EVENT_PROJECT_DELETE_CANCELLED]: 'Project delete cancelled',
    [Events.EVENT_PROJECT_TITLE_CHANGED]: 'Project title changed',
    [Events.EVENT_BACK_TO_PROJECTS]: 'Back to projects',
    [Events.EVENT_COMPILE_SUCCEEDED]: 'Compile succeeded',
    [Events.EVENT_COMPILE_FAILED]: 'Compile failed',
    [Events.EVENT_SYNC_TO_PDF]: 'Sync to PDF',
    [Events.EVENT_SYNC_TO_EDITOR]: 'Sync to editor',
    [Events.EVENT_COMPILE_ERROR_CLICKED]: 'Compile error clicked',
    [Events.EVENT_SEND_ERRORS_TO_AGENT]: 'Send errors to agent',
    [Events.EVENT_EDIT_BLOCKED]: 'Edit blocked',
    [Events.EVENT_SEGMENT_DELETED]: 'Segment deleted',
    [Events.EVENT_SEGMENT_VISIBILITY_CHANGED]: 'Segment visibility changed',
    [Events.EVENT_PROJECT_MODE_CHANGED]: 'Project mode changed',
    [Events.EVENT_ROUND_STRATEGY_CHANGED]: 'Round strategy changed',
    [Events.EVENT_FILES_DROPPED_INTO_SEGMENT]: 'Files dropped into segment',
    [Events.EVENT_FILE_MANAGER_OPENED]: 'File manager opened',
    [Events.EVENT_FILE_MANAGER_CLOSED]: 'File manager closed',
    [Events.EVENT_FILE_UPLOADED]: 'File uploaded',
    [Events.EVENT_FILE_CREATED]: 'File created',
    [Events.EVENT_FOLDER_CREATED]: 'Folder created',
    [Events.EVENT_FILE_OPENED]: 'File opened',
    [Events.EVENT_FILE_RENAMED]: 'File renamed',
    [Events.EVENT_FOLDER_RENAMED]: 'Folder renamed',
    [Events.EVENT_FILE_DELETED]: 'File deleted',
    [Events.EVENT_FOLDER_DELETED]: 'Folder deleted',
    [Events.EVENT_FILES_MOVED]: 'Files moved',
    [Events.EVENT_AGENT_PROMPT_SUBMITTED]: 'Agent prompt submitted',
    [Events.EVENT_AGENT_FAILED]: 'Agent failed',
    [Events.EVENT_AGENT_SETTINGS_CHANGED]: 'Agent settings changed',
    [Events.EVENT_CHAT_HISTORY_CLEARED]: 'Chat history cleared',
    [Events.EVENT_AGENT_CHANGE_CLICKED]: 'Agent change clicked',
    [Events.EVENT_CROSS_BORDER_CONSENT_SHOWN]: 'Cross-border consent shown',
    [Events.EVENT_CROSS_BORDER_CONSENT_ACCEPTED]:
        'Cross-border consent accepted',
    [Events.EVENT_CROSS_BORDER_CONSENT_DISMISSED]:
        'Cross-border consent dismissed',
    [Events.EVENT_BUY_TOKENS_FROM_CHAT]: 'Buy tokens from chat',
    [Events.EVENT_VIEWER_TAB_CHANGED]: 'Viewer tab changed',
    [Events.EVENT_MOBILE_VIEW_CHANGED]: 'Mobile view changed',
    [Events.EVENT_HUNK_ACCEPTED]: 'Hunk accepted',
    [Events.EVENT_HUNK_REVERTED]: 'Hunk reverted',
    [Events.EVENT_HUNKS_ACCEPTED_ALL]: 'Hunks accepted all',
    [Events.EVENT_HUNKS_REVERTED_ALL]: 'Hunks reverted all',
    [Events.EVENT_SHARE_MODAL_OPENED]: 'Share modal opened',
    [Events.EVENT_PROJECT_VISIBILITY_CHANGED]: 'Project visibility changed',
    [Events.EVENT_SHARE_LINK_COPIED]: 'Share link copied',
    [Events.EVENT_PROJECT_CLONED]: 'Project cloned',
    [Events.EVENT_TOKEN_PACKAGE_SELECTED]: 'Token package selected',
    [Events.EVENT_PAYMENT_WIDGET_FAILED]: 'Payment widget failed',
    [Events.EVENT_TOKENS_TOPUP_CLICKED]: 'Tokens top-up clicked',
    [Events.EVENT_LANGUAGE_CHANGED]: 'Language changed',
    [Events.EVENT_MENU_ITEM_CLICKED]: 'Menu item clicked',
    [Events.EVENT_TOUR_STARTED]: 'Tour started',
    [Events.EVENT_CONTACT_MODAL_OPENED]: 'Contact modal opened',
    [Events.EVENT_CONTACT_FORM_SUBMITTED]: 'Contact form submitted',
    [Events.EVENT_EDITOR_OPENED_FROM_MARKETING]: 'Editor opened from marketing',
};

export const States = {
    /** Чем закончился последний прогон агента: без этого в воронке видно только «закончился» */
    STATE_AGENT_STOP_REASON: 'agent_stop_reason',
    STATE_ONLINE: 'is_logged',
    STATE_EMAIL: 'email',
    STATE_PROJECT: 'project',
    USER_ID: 'UserID',
};

/*
События, которые отправляются в яндекс метрику.
Важно, что ключ счетчика нужно менять не только тут,
но и в index.html.

Правильная передача ключа счетчика на фронтенд вынесена в отдельную задачу.
https://github.com/Labkeeper-team/TypeThree/issues/199
 */

export type ObserverEventProperties = Record<string, unknown>;

export interface ObserverService {
    init: (userId?: string, email?: string) => void | Promise<void>;
    onEvent: (event: string, properties?: ObserverEventProperties) => void;
    setUserState: (name: string, value: string) => void;
    // сессию заводит аналитика, значит она же и обязана закрыть её при выходе
    onLogout: () => void;
}

export const mockObserver = (): ObserverService => ({
    init: () => {},
    onEvent: () => {},
    setUserState: () => {},
    onLogout: () => {},
});

export class CompositeObserver implements ObserverService {
    constructor(private readonly observers: ObserverService[]) {}

    async init(userId?: string, email?: string) {
        await Promise.all(
            this.observers.map((observer) => observer.init(userId, email))
        );
    }

    onEvent(event: string, properties?: ObserverEventProperties) {
        this.observers.forEach((observer) =>
            observer.onEvent(event, properties)
        );
    }

    setUserState(name: string, value: string) {
        this.observers.forEach((observer) =>
            observer.setUserState(name, value)
        );
    }

    onLogout() {
        this.observers.forEach((observer) => observer.onLogout());
    }
}
