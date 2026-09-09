import { KeyboardEvent, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../store';
import { useIsAgentRunning } from '../store/selectors/program';
import { controller } from '../../main.tsx';

/** Клавиши, которые ничего не меняют: на них мини-сообщение не показываем */
const NON_EDITING_KEYS = new Set([
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
    'Escape',
    'Tab',
    'Shift',
    'Control',
    'Alt',
    'Meta',
    'CapsLock',
]);

/**
 * Пока агент работает, редакторы стоят в readOnly и правка просто не проходит.
 * Пользователю нужно объяснить почему, поэтому на попытку ввода отвечаем
 * мини-сообщением. ТЗ: «При попытке ввода нужно писать мини-сообщение об этом».
 */
export const useBlockedEditNotice = (): ((
    event: KeyboardEvent<HTMLElement>
) => void) => {
    const dispatch = useDispatch<AppDispatch>();
    const isAgentRunning = useSelector(useIsAgentRunning);

    return useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            if (!isAgentRunning) {
                return;
            }
            // сочетания вроде копирования проекту не вредят
            if (event.ctrlKey || event.metaKey || event.altKey) {
                return;
            }
            if (NON_EDITING_KEYS.has(event.key)) {
                return;
            }
            dispatch(controller.onBlockedEditAttemptRequest());
        },
        [dispatch, isAgentRunning]
    );
};
