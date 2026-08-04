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
    useIsProjectReadonly,
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
    const isReadonly = useSelector(useIsProjectReadonly);
    const project = useSelector(useCurrentProject);
    const getProjectRequestState = useSelector(
        (state: StorageState) => state.ide.getProjectRequestState
    );
    const prevPdfUpdatedRef = useRef(pdfUpdated);
    const publicViewInitializedRef = useRef<string | null>(null);

    useLeavePageConfirmation(hasUnsavedChanges);

    useEffect(() => {
        if (!isMobile || mobileView !== 'editor') {
            return;
        }

        refreshCodeMirrorLayout();
    }, [isMobile, mobileView]);

    useEffect(() => {
        if (!isMobile) {
            return;
        }

        if (pdfUpdated > prevPdfUpdatedRef.current) {
            dispatch(setMobileView('pdf'));
        }

        prevPdfUpdatedRef.current = pdfUpdated;
    }, [dispatch, isMobile, pdfUpdated]);

    useEffect(() => {
        if (!isMobile || getProjectRequestState !== 'ok' || !isReadonly) {
            return;
        }

        const projectId = project?.projectId;
        if (!projectId || publicViewInitializedRef.current === projectId) {
            return;
        }

        publicViewInitializedRef.current = projectId;
        dispatch(setMobileView(pdfUri ? 'pdf' : 'editor'));
    }, [
        dispatch,
        getProjectRequestState,
        isMobile,
        isReadonly,
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
