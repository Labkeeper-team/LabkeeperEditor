export const EVENT_CREATE_MD_SEGMENT = 'create_md';
export const EVENT_CREATE_COMP_SEGMENT = 'create_comp';
export const EVENT_CREATE_LATEX_SEGMENT = 'create_latex';
export const EVENT_CREATE_ASCIIMATH_SEGMENT = 'create_ascii';
export const EVENT_RUN = 'start_run';
export const EVENT_ERROR = 'run_error';
export const EVENT_MOVE_SEGMENT = 'segment_move';
export const EVENT_INSERT_SEGMENT_BETWEEN = 'segment_insert_between';
export const EVENT_PRINT = 'print_doc';

export const STATE_ONLINE = 'is_logged';

/*
События, которые отправляются в яндекс метрику.
Важно, что ключ счетчика нужно менять не только тут,
но и в index.html.

Правильная передача ключа счетчика на фронтенд вынесена в отдельную задачу.
https://github.com/Labkeeper-team/TypeThree/issues/199
 */

function metrika(first: string, second: string) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error
    window.ym(101239047, first, second);
}

export function onEvent(name: string) {
    metrika('reachGoal', name);
}

export function setUserState(name, value) {
    const map = {};
    map[name] = value;
    metrika('params', JSON.stringify(map));
}
