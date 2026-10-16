import { useCallback, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { AppDispatch, StorageState } from '../../../../store';
import {
    useCurrentProgram,
    useIsAgentRunning,
} from '../../../../store/selectors/program';
import { useDictionary } from '../../../../store/selectors/translations.ts';
import { controller } from '../../../../../main.tsx';

/** Сборка зелёной кнопки: ею пользуются и кнопка, и Ctrl+Enter (GH-172), поэтому условия одни */
export const useRunAction = () => {
    const dispatch = useDispatch<AppDispatch>();
    const [flag, setFlag] = useState(false);
    const isAutocompleteLoading = useSelector(
        (state: StorageState) => state.settings.isCompiling
    );
    const program = useSelector(useCurrentProgram);
    const dictionary = useSelector(useDictionary);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const isAgentRunning = useSelector(useIsAgentRunning);

    const disabled = useMemo(
        () =>
            !program.segments.length ||
            isAutocompleteLoading ||
            (!program.segments.find(
                (s) => s.type === 'computational' || s.type === 'latex'
            ) &&
                !isLatexMode) ||
            flag ||
            isAgentRunning,
        [
            isLatexMode,
            flag,
            isAutocompleteLoading,
            program.segments,
            isAgentRunning,
        ]
    );

    const title = useMemo(() => {
        if (isAutocompleteLoading || flag) {
            return `${dictionary.loading}...`;
        }
        if (isAgentRunning) {
            return dictionary.agent_chat.run_blocked;
        }
        if (!program.segments.length) {
            return dictionary.add_segment;
        }
        return !disabled ? dictionary.run : dictionary.no_comp_segment;
    }, [
        isAutocompleteLoading,
        flag,
        program.segments.length,
        disabled,
        dictionary,
        isAgentRunning,
    ]);

    /** true, если сборка ушла */
    const run = useCallback(
        (trigger: 'button' | 'hotkey' = 'button'): boolean => {
            // сюда приходит и горячая клавиша, поэтому объясняем, почему ничего не произошло
            if (isAgentRunning) {
                dispatch(controller.onBlockedEditAttemptRequest());
                return false;
            }
            if (disabled) {
                return false;
            }
            setFlag(true);
            setTimeout(() => {
                setFlag(false);
            }, 1000);
            dispatch(controller.onRunButtonPressedRequest(trigger));
            return true;
        },
        [dispatch, disabled, isAgentRunning]
    );

    return { run, disabled, title };
};
