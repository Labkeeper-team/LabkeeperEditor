import './style.scss';
import classNames from 'classnames';
import { useCallback, useEffect, useRef } from 'react';
import { Editor } from './editor';
import { Viewer } from './viewer';
import { useDispatch, useSelector, useStore } from 'react-redux';
import { FileManager } from './fileManager';
import { AppDispatch, StorageState } from '../../store';
import { useHotkeys } from 'react-hotkeys-hook';
import { controller } from '../../../main.tsx';
import { DeleteFilesModal } from './modals/delete-files';
import { useLeavePageConfirmation } from '../../hooks/useLeavePageConfirmation';
import { useLeaveRouteConfirmation } from '../../hooks/useLeaveRouteConfirmation';
import {
    readIsAgentRunning,
    useCurrentProject,
    useHasUnsavedChanges,
    useIsAgentRunning,
    useMobileView,
} from '../../store/selectors/program';
import { useDictionary } from '../../store/selectors/translations';
import { useIsMobile } from '../../hooks/useMobile';
import { setMobileView, setViewerTab } from '../../store/slices/settings';
import { refreshCodeMirrorLayout } from '../../utils/refreshCodeMirrorLayout';
import { useHunkActionHandler } from '../../hooks/useHunkEditorSync';

export const ProjectPage = () => {
    useHunkActionHandler();
    const dispatch = useDispatch<AppDispatch>();
    const isMobile = useIsMobile();
    const mobileView = useSelector(useMobileView);
    const activeTextFile = useSelector(
        (state: StorageState) => state.ide.activeTextFile
    );
    const hasUnsavedChanges = useSelector(useHasUnsavedChanges);
    const isAgentRunning = useSelector(useIsAgentRunning);
    const dictionary = useSelector(useDictionary);
    const pdfUpdated = useSelector(
        (state: StorageState) => state.ide.pdfUpdated
    );
    const pdfUri = useSelector((state: StorageState) => state.project.pdfUri);
    const project = useSelector(useCurrentProject);
    const getProjectRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectRequestState
    );
    const prevPdfUpdatedRef = useRef(pdfUpdated);
    const initialViewProjectIdRef = useRef<string | null>(null);
    const initialPdfViewAppliedRef = useRef(false);
    const store = useStore<StorageState>();
    const isAgentRunningNow = useCallback(
        () => readIsAgentRunning(store.getState()),
        [store]
    );

    // прогон агента идёт и без авторизации, поэтому условия складываются
    useLeavePageConfirmation(hasUnsavedChanges || isAgentRunning);
    // несохранённые изменения сюда не берём: автосохранение висит секунду,
    // и вопрос на каждый переход был бы издевательством
    useLeaveRouteConfirmation(
        isAgentRunningNow,
        dictionary.agent_chat.leave_confirm
    );

    // уход со страницы проекта гасит сокет агента: слушать чужую ленту незачем
    useEffect(
        () => () => {
            dispatch(controller.onProjectPageLeftRequest());
        },
        [dispatch]
    );

    useEffect(() => {
        if (!isMobile || mobileView !== 'editor') {
            return;
        }

        refreshCodeMirrorLayout();
    }, [isMobile, mobileView]);

    // После компиляции (PDF или MD) — показать результат
    useEffect(() => {
        if (pdfUpdated > prevPdfUpdatedRef.current) {
            dispatch(setViewerTab('pdf'));
            if (isMobile) {
                dispatch(setMobileView('pdf'));
            }
        }

        prevPdfUpdatedRef.current = pdfUpdated;
    }, [dispatch, isMobile, pdfUpdated]);

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
        dispatch(setViewerTab('pdf'));
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
                    // чат живёт в той же колонке, что и результат компиляции
                    'project-pane--active':
                        !isMobile ||
                        mobileView === 'pdf' ||
                        mobileView === 'chat',
                })}
            >
                <Viewer />
            </div>
            <DeleteFilesModal />
        </div>
    );
};

export default ProjectPage;
