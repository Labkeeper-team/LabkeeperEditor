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
};

export type EventValues = (typeof Events)[keyof typeof Events];

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

export interface ObserverService {
    onEvent: (event: string) => void;
    setUserState: (name: string, value: string) => void;
}

export const mockObserver = (): ObserverService => ({
    onEvent: () => {},
    setUserState: () => {},
});
