import './style.scss';
import classNames from 'classnames';
import { useEffect, useMemo } from 'react';
import { Editor } from './editor';
import { Viewer } from './viewer';
import { useDispatch, useSelector } from 'react-redux';
import { FileManager } from './fileManager';
import { AppDispatch, StorageState } from '../../store';
import { useHotkeys } from 'react-hotkeys-hook';
import { controller } from '../../../main.tsx';
import { DeleteFilesModal } from './modals/delete-files';
import {
    useActiveMobilePanel,
    useShowFileManager,
} from '../../store/selectors/program.ts';
import { setActiveMobilePanel } from '../../store/slices/settings';
import { useIsMobile } from '../../hooks/useMobile';
import {
    getAvailableMobilePanels,
    MOBILE_BREAKPOINT,
} from './mobilePanelSwitcher/constants';

export const ProjectPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const showFileManager = useSelector(useShowFileManager);
    const activeMobilePanel = useSelector(useActiveMobilePanel);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const isMobileViewport = useIsMobile(MOBILE_BREAKPOINT);

    const availableMobilePanels = useMemo(
        () => getAvailableMobilePanels(isAuthenticated),
        [isAuthenticated]
    );

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

    useEffect(() => {
        if (!isMobileViewport && activeMobilePanel !== 'editor') {
            dispatch(setActiveMobilePanel('editor'));
        }
    }, [activeMobilePanel, dispatch, isMobileViewport]);

    useEffect(() => {
        if (
            isMobileViewport &&
            !availableMobilePanels.includes(activeMobilePanel)
        ) {
            dispatch(setActiveMobilePanel(availableMobilePanels[0]));
        }
    }, [activeMobilePanel, availableMobilePanels, dispatch, isMobileViewport]);

    useEffect(() => {
        if (!isMobileViewport) {
            return;
        }
        if (showFileManager) {
            dispatch(setActiveMobilePanel('files'));
            return;
        }
        if (activeMobilePanel === 'files') {
            dispatch(setActiveMobilePanel('editor'));
        }
    }, [activeMobilePanel, dispatch, isMobileViewport, showFileManager]);

    const showFilesPanel = !isMobileViewport || activeMobilePanel === 'files';
    const showEditorPanel = !isMobileViewport || activeMobilePanel === 'editor';
    const showViewerPanel = !isMobileViewport || activeMobilePanel === 'viewer';

    return (
        <div
            className={classNames('project-container', {
                'project-container--mobile': isMobileViewport,
            })}
        >
            <div
                className={classNames('project-panel', 'project-panel--files', {
                    'project-panel--visible': showFilesPanel,
                })}
            >
                <FileManager />
            </div>
            <div
                className={classNames(
                    'project-panel',
                    'project-panel--editor',
                    {
                        'project-panel--visible': showEditorPanel,
                    }
                )}
            >
                <Editor />
            </div>
            <div
                className={classNames(
                    'project-panel',
                    'project-panel--viewer',
                    {
                        'project-panel--visible': showViewerPanel,
                    }
                )}
            >
                <Viewer />
            </div>
            <DeleteFilesModal />
        </div>
    );
};

export default ProjectPage;
