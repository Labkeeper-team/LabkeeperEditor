import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

import { RightArrowIcon } from '../../../icons';
import { AppDispatch, StorageState } from '../../../store';
import { useDictionary } from '../../../store/selectors/translations';
import {
    useCurrentProject,
    useIsProjectReadonly,
} from '../../../store/selectors/program';
import { controller } from '../../../../main.tsx';
import { setMobileView } from '../../../store/slices/settings';
import { useIsMobile } from '../../../hooks/useMobile';

import './style.scss';

type SynctexButtonProps = {
    direction: 'toPdf' | 'toEditor';
    className?: string;
};

export const SynctexButton = ({ direction, className }: SynctexButtonProps) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const project = useSelector(useCurrentProject);
    const isReadonly = useSelector(useIsProjectReadonly);
    const isLatexMode = useSelector(
        (state: StorageState) => state.project.mode === 'latex'
    );
    const isAuth = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);
    const isMobile = useIsMobile();

    const visible =
        isAuth && isLatexMode && !isReadonly && Boolean(project?.projectId);

    if (!visible) {
        return null;
    }

    const isToPdf = direction === 'toPdf';
    const title = isToPdf
        ? dictionary.synctex.to_pdf
        : dictionary.synctex.to_editor;

    const onActivate = () => {
        if (!pdfUri) {
            return;
        }

        if (isToPdf) {
            dispatch(controller.onSyncEditorToPdfRequest());
            if (isMobile) {
                dispatch(setMobileView('pdf'));
            }
            return;
        }

        dispatch(controller.onSyncPdfToEditorRequest());
        if (isMobile) {
            dispatch(setMobileView('editor'));
        }
    };

    return (
        <button
            type="button"
            className={classNames(
                'synctex-button',
                {
                    'synctex-button--reverse': !isToPdf,
                    'synctex-button--disabled': !pdfUri,
                    'synctex-button--header': isMobile,
                },
                className
            )}
            title={title}
            aria-label={title}
            disabled={!pdfUri}
            onMouseDown={
                isToPdf
                    ? (event) => {
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
