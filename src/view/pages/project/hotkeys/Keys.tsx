import { Fragment } from 'react';
import classNames from 'classnames';

import { hotkeyLabel, isMacPlatform } from './catalog.ts';

import './keys.scss';

/** Сочетания клавишами, как на клавиатуре; варианты одного действия через косую черту */
export const Keys = ({
    hotkeys,
    className,
}: {
    hotkeys: readonly string[];
    className?: string;
}) => {
    const mac = isMacPlatform();
    return (
        <span className={classNames('hotkey-keys', className)}>
            {hotkeys.map((hotkey, index) => (
                <Fragment key={hotkey}>
                    {index > 0 ? (
                        <span className="hotkey-keys__or">/</span>
                    ) : null}
                    <span className="hotkey-keys__combo">
                        {hotkeyLabel(hotkey, mac).map((key) => (
                            <kbd key={key}>{key}</kbd>
                        ))}
                    </span>
                </Fragment>
            ))}
        </span>
    );
};
