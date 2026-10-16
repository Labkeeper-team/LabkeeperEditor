import { useEffect } from 'react';

import { Button } from '../../../../components/button';
import { RightArrowIcon } from '../../../../icons';
import { useRunAction } from './useRunAction.ts';

interface RunButtonProps {
    enableHotkey?: boolean;
}

export const RunButton = ({ enableHotkey = false }: RunButtonProps) => {
    const { run, disabled, title } = useRunAction();

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
                onPress={() => run()}
                disabled={disabled}
                titleIcon={() => (disabled ? undefined : <RightArrowIcon />)}
                color="green"
                minimize={false}
            />
        </div>
    );
};
