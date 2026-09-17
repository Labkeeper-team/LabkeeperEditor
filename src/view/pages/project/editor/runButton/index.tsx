import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { Button } from '../../../../components/button';
import { RightArrowIcon } from '../../../../icons';
import { AppDispatch, StorageState } from '../../../../store';
import {
    useCurrentProgram,
    useIsAgentRunning,
} from '../../../../store/selectors/program';
import { useDictionary } from '../../../../store/selectors/translations.ts';
import { controller } from '../../../../../main.tsx';

interface RunButtonProps {
    enableHotkey?: boolean;
}

export const RunButton = ({ enableHotkey = false }: RunButtonProps) => {
    const dispatch = useDispatch<AppDispatch>();
    const [flag, setFlag] = useState(false);
    const isAutocompleteLoading = useSelector(
        (state: StorageState) => state.settings.isCompiling
    );
    const isPdfRendering = useSelector(
        (state: StorageState) => state.settings.isPdfRendering
    );
    const program = useSelector(useCurrentProgram);
    const dictionary = useSelector(useDictionary);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const isAgentRunning = useSelector(useIsAgentRunning);

    const waitingForPdf = isLatexMode && isPdfRendering;

    const disabled = useMemo(
        () =>
            !program.segments.length ||
            isAutocompleteLoading ||
            waitingForPdf ||
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
            waitingForPdf,
            program.segments,
            isAgentRunning,
        ]
    );

    const title = useMemo(() => {
        if (isAutocompleteLoading || waitingForPdf || flag) {
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
        waitingForPdf,
        flag,
        program.segments.length,
        disabled,
        dictionary,
        isAgentRunning,
    ]);

    const run = useCallback(
        (trigger: 'button' | 'hotkey' = 'button') => {
            // сюда приходит и горячая клавиша, поэтому объясняем, почему ничего не произошло
            if (isAgentRunning) {
                dispatch(controller.onBlockedEditAttemptRequest());
                return;
            }
            if (disabled) {
                return;
            }
            setFlag(true);
            setTimeout(() => {
                setFlag(false);
            }, 1000);
            dispatch(controller.onRunButtonPressedRequest(trigger));
        },
        [dispatch, disabled, isAgentRunning]
    );

    useEffect(() => {
        if (!enableHotkey) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            const isModifierPressed = event.ctrlKey || event.metaKey;
            const isS = event.code === 'KeyS';
            if (!isModifierPressed || !isS) return;

            event.preventDefault();
            run('hotkey');
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enableHotkey, run]);

    return (
        <div className="run-button-bar">
            <Button
                classname="run-button"
                title={title}
                onPress={run}
                disabled={disabled}
                titleIcon={() => (disabled ? undefined : <RightArrowIcon />)}
                color="green"
                minimize={false}
            />
        </div>
    );
};
