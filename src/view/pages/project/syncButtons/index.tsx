import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

import { RightArrowIcon } from '../../../icons';
import { AppDispatch, StorageState } from '../../../store';
import { useDictionary } from '../../../store/selectors/translations';
import {
    useCurrentProgram,
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
    const program = useSelector(useCurrentProgram);
    const isReadonly = useSelector(useIsProjectReadonly);
    const mode = useSelector((state: StorageState) => state.project.mode);
    const isLatexMode = mode === 'latex';
    const isAuth = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);
    const activeSegmentIndex = useSelector(
        (state: StorageState) => state.ide.activeSegmentIndex
    );
    const previousActiveSegmentIndex = useSelector(
        (state: StorageState) => state.ide.previousActiveSegmentIndex
    );
    const synctexEditorPosition = useSelector(
        (state: StorageState) => state.ide.synctexEditorPosition
    );
    const isMobile = useIsMobile();

    const segmentCount = program?.segments?.length ?? 0;
    // Markdown-навигация по сегментам — только mobile; на desktop latex SyncTeX как раньше
    const visible =
        isAuth &&
        !isReadonly &&
        Boolean(project?.projectId) &&
        (isLatexMode || (isMobile && mode === 'markdown'));

    const canNavigate = isLatexMode
        ? Boolean(pdfUri)
        : isMobile && segmentCount > 0;

    if (!visible) {
        return null;
    }

    const isToPdf = direction === 'toPdf';
    const title = isToPdf
        ? dictionary.synctex.to_pdf
        : dictionary.synctex.to_editor;

    const resolveMarkdownSegmentIndex = () => {
        if (activeSegmentIndex >= 0) {
            return activeSegmentIndex;
        }
        if (
            synctexEditorPosition &&
            synctexEditorPosition.segmentIndex >= 0 &&
            synctexEditorPosition.segmentIndex < segmentCount
        ) {
            return synctexEditorPosition.segmentIndex;
        }
        if (
            previousActiveSegmentIndex >= 0 &&
            previousActiveSegmentIndex < segmentCount
        ) {
            return previousActiveSegmentIndex;
        }
        return segmentCount > 0 ? 0 : -1;
    };

    /** Сброс → фокус, чтобы useScrollableToActive сработал после смены вкладки. */
    const focusMarkdownSegment = (index: number) => {
        dispatch(controller.onFocusSegmentRequest({ segmentIndex: -1 }));
        window.setTimeout(() => {
            dispatch(controller.onFocusSegmentRequest({ segmentIndex: index }));
        }, 0);
    };

    const onActivateMarkdown = () => {
        if (!isMobile) {
            return;
        }

        const index = resolveMarkdownSegmentIndex();
        if (index < 0) {
            return;
        }

        dispatch(setMobileView(isToPdf ? 'pdf' : 'editor'));
        // Ждём показа панели (display:none → flex), затем скролл к сегменту
        window.setTimeout(() => focusMarkdownSegment(index), 50);
    };

    const onActivateLatex = () => {
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

    const onActivate = () => {
        if (!canNavigate) {
            return;
        }
        if (isLatexMode) {
            onActivateLatex();
            return;
        }
        onActivateMarkdown();
    };

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
