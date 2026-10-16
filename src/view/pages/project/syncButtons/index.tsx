import classNames from 'classnames';

import { RightArrowIcon } from '../../../icons';
import { useIsMobile } from '../../../hooks/useMobile';
import { useSynctexNavigation } from './useSynctexNavigation.ts';

import './style.scss';

type SynctexButtonProps = {
    direction: 'toPdf' | 'toEditor';
    className?: string;
};

export const SynctexButton = ({ direction, className }: SynctexButtonProps) => {
    const { visible, canNavigate, title, isToPdf, onActivate } =
        useSynctexNavigation(direction);
    const isMobile = useIsMobile();

    if (!visible) {
        return null;
    }

    return (
        <button
            type="button"
            className={classNames(
                'synctex-button',
                {
                    'synctex-button--reverse': !isToPdf,
                    'synctex-button--disabled': !canNavigate,
                    'synctex-button--header': isMobile,
                },
                className
            )}
            title={title}
            aria-label={title}
            disabled={!canNavigate}
            onMouseDown={
                isToPdf
                    ? (event) => {
                          // mousedown: успеть до blur сегмента (active → -1)
                          event.preventDefault();
                          onActivate();
                      }
                    : undefined
            }
            onClick={isToPdf ? undefined : onActivate}
        >
            <RightArrowIcon />
        </button>
    );
};

export const SyncButtons = () => {
    const isMobile = useIsMobile();

    if (isMobile) {
        return null;
    }

    return (
        <div className="project-sync-bar" aria-label="SyncTeX navigation">
            <div className="synctex-buttons">
                <SynctexButton direction="toPdf" />
                <SynctexButton direction="toEditor" />
            </div>
        </div>
    );
};
