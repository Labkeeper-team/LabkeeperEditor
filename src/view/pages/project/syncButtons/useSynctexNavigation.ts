import { useDispatch, useSelector } from 'react-redux';

import { AppDispatch, StorageState } from '../../../store';
import { useDictionary } from '../../../store/selectors/translations';
import {
    useCurrentProgram,
    useCurrentProject,
    useIsProjectReadonly,
} from '../../../store/selectors/program';
import { controller } from '../../../../main.tsx';
import { setMobileView, setViewerTab } from '../../../store/slices/settings';
import { useIsMobile } from '../../../hooks/useMobile';
import { resetLockedViewportScrollAfterFocus } from '../../../utils/resetLockedViewportScroll';

/** Переход SyncTeX: им пользуются и кнопки «К PDF» и «К коду», и Ctrl+Alt+J / Ctrl+Alt+K (GH-172), поэтому условия и шаги одни */
export const useSynctexNavigation = (direction: 'toPdf' | 'toEditor') => {
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
    // в markdown переход по сегментам есть только на телефоне, на десктопе только SyncTeX в latex
    const visible =
        isAuth &&
        !isReadonly &&
        Boolean(project?.projectId) &&
        (isLatexMode || (isMobile && mode === 'markdown'));

    const canNavigate = isLatexMode
        ? Boolean(pdfUri)
        : isMobile && segmentCount > 0;

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

        if (isToPdf) {
            dispatch(setViewerTab('pdf'));
        }
        dispatch(setMobileView(isToPdf ? 'pdf' : 'editor'));
        // Ждём показа панели (display:none → flex), затем скролл к сегменту
        window.setTimeout(() => focusMarkdownSegment(index), 50);
        if (!isToPdf) {
            resetLockedViewportScrollAfterFocus();
        }
    };

    const onActivateLatex = () => {
        if (!pdfUri) {
            return;
        }

        if (isToPdf) {
            dispatch(setViewerTab('pdf'));
            dispatch(controller.onSyncEditorToPdfRequest());
            if (isMobile) {
                dispatch(setMobileView('pdf'));
            }
            return;
        }

        dispatch(controller.onSyncPdfToEditorRequest());
        if (isMobile) {
            dispatch(setMobileView('editor'));
            resetLockedViewportScrollAfterFocus();
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

    return { visible, canNavigate, title, isToPdf, onActivate };
};
