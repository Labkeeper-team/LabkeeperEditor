import './style.scss';
import classNames from 'classnames';
import { useEffect, useRef } from 'react';
import { Editor } from './editor';
import { Viewer } from './viewer';
import { useDispatch, useSelector } from 'react-redux';
import { FileManager } from './fileManager';
import { AppDispatch, StorageState } from '../../store';
import { useHotkeys } from 'react-hotkeys-hook';
import { controller } from '../../../main.tsx';
import { DeleteFilesModal } from './modals/delete-files';
import { useLeavePageConfirmation } from '../../hooks/useLeavePageConfirmation';
import {
    useCurrentProject,
    useHasUnsavedChanges,
    useMobileView,
} from '../../store/selectors/program';
import { useIsMobile } from '../../hooks/useMobile';
import { setMobileView } from '../../store/slices/settings';
import { refreshCodeMirrorLayout } from '../../utils/refreshCodeMirrorLayout';

export const ProjectPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const isMobile = useIsMobile();
    const mobileView = useSelector(useMobileView);
    const activeTextFile = useSelector(
        (state: StorageState) => state.ide.activeTextFile
    );
    const hasUnsavedChanges = useSelector(useHasUnsavedChanges);
    const pdfUpdated = useSelector(
        (state: StorageState) => state.ide.pdfUpdated
    );
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);
    const project = useSelector(useCurrentProject);
    const getProjectRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectRequestState
    );
    const projectPromptRequestState = useSelector(
        (state: StorageState) => state.ide.projectPromptRequestState
    );
    const showProjectPromptModal = useSelector(
        (state: StorageState) => state.settings.showProjectPromptModal
    );
    const prevPdfUpdatedRef = useRef(pdfUpdated);
    const prevPromptStateRef = useRef(projectPromptRequestState);
    const initialViewProjectIdRef = useRef<string | null>(null);
    const initialPdfViewAppliedRef = useRef(false);

    useLeavePageConfirmation(hasUnsavedChanges);

    useEffect(() => {
        if (!isMobile || mobileView !== 'editor') {
            return;
        }

        refreshCodeMirrorLayout();
    }, [isMobile, mobileView]);

    // GPT-модалка находится во вкладке PDF — на мобильных сначала показать её.
    useEffect(() => {
        if (isMobile && showProjectPromptModal) {
            dispatch(setMobileView('pdf'));
        }
    }, [dispatch, isMobile, showProjectPromptModal]);

    // После компиляции (PDF или MD) — показать результат
    useEffect(() => {
        if (!isMobile) {
            return;
        }

        if (pdfUpdated > prevPdfUpdatedRef.current) {
            dispatch(setMobileView('pdf'));
        }

        prevPdfUpdatedRef.current = pdfUpdated;
    }, [dispatch, isMobile, pdfUpdated]);

    // После успешного запроса к ИИ — показать сегменты (редактор).
    // Дублирует switchToMobileEditorView в сервисе на случай гонки с pdfUpdated.
    useEffect(() => {
        if (!isMobile) {
            prevPromptStateRef.current = projectPromptRequestState;
            return;
        }

        if (
            prevPromptStateRef.current !== 'ok' &&
            projectPromptRequestState === 'ok'
        ) {
            dispatch(setMobileView('editor'));
        }

        prevPromptStateRef.current = projectPromptRequestState;
    }, [dispatch, isMobile, projectPromptRequestState]);

    // При открытии проекта с уже существующим PDF — сразу показать PDF
    useEffect(() => {
        if (!isMobile || getProjectRequestState !== 'ok') {
            return;
        }

        const projectId = project?.projectId;
        if (!projectId) {
            return;
        }

        if (initialViewProjectIdRef.current !== projectId) {
            initialViewProjectIdRef.current = projectId;
            initialPdfViewAppliedRef.current = false;
        }

        if (initialPdfViewAppliedRef.current) {
            return;
        }

        // Ждём появления pdfUri (lastPdf / файл из filemanager), затем один раз выбираем вкладку
        if (!pdfUri) {
            return;
        }

        initialPdfViewAppliedRef.current = true;
        dispatch(setMobileView('pdf'));
    }, [
        dispatch,
        getProjectRequestState,
        isMobile,
        pdfUri,
        project?.projectId,
    ]);

    /*
     * ACTIONS
     */

    // WHEN ESC CLICKED
    useHotkeys(
        'esc',
        () => dispatch(controller.onProjectPageEscButtonClickedRequest()),
        {
            enableOnFormTags: true,
            enabled: true,
            enableOnContentEditable: true,
        }
    );

    useHotkeys(
        'mod+s',
        (e) => {
            e?.preventDefault();
            e?.stopPropagation();
            dispatch(controller.onTextFileSaveTimeoutRequest());
        },
        {
            enableOnFormTags: true,
            enabled: Boolean(activeTextFile),
            enableOnContentEditable: true,
            preventDefault: true,
        }
    );

    return (
        <div
            className={classNames('project-container', {
                'project-container--mobile': isMobile,
            })}
        >
            <div
                className={classNames('project-pane', 'project-pane--files', {
                    'project-pane--active': !isMobile || mobileView === 'files',
                })}
            >
                <FileManager />
            </div>
            <div
                className={classNames('project-pane', 'project-pane--editor', {
                    'project-pane--active':
                        !isMobile || mobileView === 'editor',
                })}
            >
                <Editor />
            </div>
            <div
                className={classNames('project-pane', 'project-pane--pdf', {
                    'project-pane--active': !isMobile || mobileView === 'pdf',
                })}
            >
                <Viewer />
            </div>
            <DeleteFilesModal />
        </div>
    );
};

export default ProjectPage;
