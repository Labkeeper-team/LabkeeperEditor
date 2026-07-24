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
    FRONTEND_ERROR: 'frontend_error',
    EVENT_RPI_UNKNOWN_AUTH_LOGIN: 'rpi_unknown_auth_login',
    EVENT_RPI_UNKNOWN_AUTH_SEND_EMAIL_WITH_CODE:
        'rpi_unknown_auth_send_email_with_code',
    EVENT_RPI_UNKNOWN_AUTH_SET_PASSWORD: 'rpi_unknown_auth_set_password',
    EVENT_RPI_UNKNOWN_AUTH_CHECK_CODE: 'rpi_unknown_auth_check_code',
    EVENT_RPI_UNKNOWN_LOADER_LIST_FILES: 'rpi_unknown_loader_list_files',
    EVENT_RPI_UNKNOWN_LOADER_SAVE_PROGRAM: 'rpi_unknown_loader_save_program',
    EVENT_RPI_UNKNOWN_LOADER_GET_ALL_PROJECTS:
        'rpi_unknown_loader_get_all_projects',
    EVENT_RPI_UNKNOWN_FILE_MANAGER_UPLOAD: 'rpi_unknown_file_manager_upload',
    EVENT_RPI_UNKNOWN_FILE_MANAGER_DELETE: 'rpi_unknown_file_manager_delete',
    EVENT_RPI_UNKNOWN_FILE_MANAGER_RENAME: 'rpi_unknown_file_manager_rename',
    EVENT_RPI_UNKNOWN_PROJECTS_DELETE_PROJECT:
        'rpi_unknown_projects_delete_project',
    EVENT_RPI_UNKNOWN_PROJECTS_GET_ALL_PROJECTS:
        'rpi_unknown_projects_get_all_projects',
    EVENT_RPI_UNKNOWN_PROJECTS_CREATE_PROJECT:
        'rpi_unknown_projects_create_project',
    EVENT_RPI_UNKNOWN_PROJECTS_SET_PROJECT_TYPE:
        'rpi_unknown_projects_set_project_type',
    EVENT_RPI_UNKNOWN_PROJECTS_UPDATE_TAGS: 'rpi_unknown_projects_update_tags',
    EVENT_RPI_UNKNOWN_STARTUP_OAUTH_CODE: 'rpi_unknown_startup_oauth_code',
    EVENT_RPI_UNKNOWN_STARTUP_GET_USER_INFO:
        'rpi_unknown_startup_get_user_info',
    EVENT_RPI_UNKNOWN_STARTUP_GET_BILLING_PRICING:
        'rpi_unknown_startup_get_billing_pricing',
    EVENT_RPI_UNKNOWN_REFRESH_USER_INFO: 'rpi_unknown_refresh_user_info',
    EVENT_RPI_UNKNOWN_STARTUP_GET_PROJECT: 'rpi_unknown_startup_get_project',
    EVENT_RPI_UNKNOWN_STARTUP_GET_DEFAULT_PROJECT:
        'rpi_unknown_startup_get_default_project',
    EVENT_RPI_UNKNOWN_PROGRAM_EDITOR_UPLOAD:
        'rpi_unknown_program_editor_upload',
    EVENT_RPI_UNKNOWN_PROJECT_PAGE_CONTACT_FORM:
        'rpi_unknown_project_page_contact_form',
    EVENT_RPI_UNKNOWN_PROJECT_PAGE_SET_TITLE:
        'rpi_unknown_project_page_set_title',
    EVENT_RPI_UNKNOWN_PROJECT_PAGE_SET_VISIBILITY:
        'rpi_unknown_project_page_set_visibility',
    EVENT_RPI_UNKNOWN_PROJECT_PAGE_CLONE: 'rpi_unknown_project_page_clone',
    EVENT_RPI_UNKNOWN_PROJECT_PAGE_SET_TYPE:
        'rpi_unknown_project_page_set_type',
    EVENT_RPI_UNKNOWN_PROJECT_PAGE_UNAUTHORIZED_PROMPT:
        'rpi_unknown_project_page_unauthorized_prompt',
    EVENT_RPI_UNKNOWN_PROJECT_PAGE_PROMPT: 'rpi_unknown_project_page_prompt',
    EVENT_RPI_UNKNOWN_COMPILATION: 'rpi_unknown_compilation',
    EVENT_RPI_UNKNOWN_PROGRAM_EDITOR_SYNC_EDITOR_TO_PDF:
        'rpi_unknown_program_editor_sync_editor_to_pdf',
    EVENT_RPI_UNKNOWN_PROGRAM_EDITOR_SYNC_PDF_TO_EDITOR:
        'rpi_unknown_program_editor_sync_pdf_to_editor',
};

export type EventValues = (typeof Events)[keyof typeof Events];

export const States = {
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

export interface ObserverService {
    onEvent: (event: string) => void;
    setUserState: (name: string, value: string) => void;
}

export const mockObserver = (): ObserverService => ({
    onEvent: () => {},
    setUserState: () => {},
});
