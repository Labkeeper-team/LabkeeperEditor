import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { Button } from '../../../../components/button';
import { RightArrowIcon } from '../../../../icons';
import { AppDispatch, StorageState } from '../../../../store';
import { useCurrentProgram } from '../../../../store/selectors/program';
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
    const program = useSelector(useCurrentProgram);
    const dictionary = useSelector(useDictionary);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );

    const disabled = useMemo(
        () =>
            !program.segments.length ||
            isAutocompleteLoading ||
            (!program.segments.find(
                (s) => s.type === 'computational' || s.type === 'latex'
            ) &&
                !isLatexMode) ||
            flag,
        [isLatexMode, flag, isAutocompleteLoading, program.segments]
    );

    const title = useMemo(() => {
        if (isAutocompleteLoading || flag) {
            return `${dictionary.loading}...`;
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
    ]);

    const run = useCallback(() => {
        if (disabled) {
            return;
        }
        setFlag(true);
        setTimeout(() => {
            setFlag(false);
        }, 1000);
        dispatch(controller.onRunButtonPressedRequest());
    }, [dispatch, disabled]);

    useEffect(() => {
        if (!enableHotkey) {
            return;
        }

        const onKeyDown = (event: KeyboardEvent) => {
            const isModifierPressed = event.ctrlKey || event.metaKey;
            const isS = event.code === 'KeyS';
            if (!isModifierPressed || !isS) return;

            event.preventDefault();
            run();
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [enableHotkey, run]);

    return (
        <Button
            classname="run-button"
            title={title}
            onPress={run}
            disabled={disabled}
            titleIcon={() => (disabled ? undefined : <RightArrowIcon />)}
            color="green"
            minimize={false}
        />
    );
};
