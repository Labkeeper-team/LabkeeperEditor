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
};

export const States = {
    STATE_ONLINE: 'is_logged',
    STATE_EMAIL: 'email',
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
