import './style.scss';
import classNames from 'classnames';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
    useCurrentProject,
    useShowFileManager,
} from '../../store/selectors/program.ts';
import { setActiveMobilePanel } from '../../store/slices/settings';
import { MobileProjectPanel } from '../../store/slices/index.ts';
import { RightArrowIcon } from '../../icons';

const MOBILE_BREAKPOINT = 1024;
const AUTHORIZED_MOBILE_PANELS: MobileProjectPanel[] = [
    'files',
    'editor',
    'viewer',
];
const GUEST_MOBILE_PANELS: MobileProjectPanel[] = ['editor', 'viewer'];

export const ProjectPage = () => {
    const dispatch = useDispatch<AppDispatch>();
    const showFileManager = useSelector(useShowFileManager);
    const activeMobilePanel = useSelector(useActiveMobilePanel);
    const project = useSelector(useCurrentProject);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const [isMobileViewport, setIsMobileViewport] = useState(
        window.innerWidth <= MOBILE_BREAKPOINT
    );

    const availableMobilePanels = useMemo(
        () =>
            isAuthenticated ? AUTHORIZED_MOBILE_PANELS : GUEST_MOBILE_PANELS,
        [isAuthenticated]
    );

    const setMobilePanel = useCallback(
        (panel: MobileProjectPanel) => {
            dispatch(setActiveMobilePanel(panel));
        },
        [dispatch]
    );

    const openFilesPanel = useCallback(() => {
        if (!isAuthenticated) {
            dispatch(controller.onFolderButtonClickedRequest());
            return;
        }
        if (!project) {
            return;
        }
        if (!showFileManager) {
            dispatch(controller.onFolderButtonClickedRequest());
            return;
        }
        setMobilePanel('files');
    }, [dispatch, isAuthenticated, project, setMobilePanel, showFileManager]);

    const activateMobilePanel = useCallback(
        (panel: MobileProjectPanel) => {
            if (panel === 'files') {
                openFilesPanel();
                return;
            }
            if (showFileManager) {
                dispatch(controller.onCrossButtonInFileManagerClickedRequest());
            }
            setMobilePanel(panel);
        },
        [dispatch, openFilesPanel, setMobilePanel, showFileManager]
    );

    const activePanelIndex = useMemo(() => {
        const index = availableMobilePanels.indexOf(activeMobilePanel);
        return index >= 0 ? index : 0;
    }, [activeMobilePanel, availableMobilePanels]);

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
        const onResize = () => {
            setIsMobileViewport(window.innerWidth <= MOBILE_BREAKPOINT);
        };
        onResize();
        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, []);

    useEffect(() => {
        if (!isMobileViewport && activeMobilePanel !== 'editor') {
            setMobilePanel('editor');
        }
    }, [activeMobilePanel, isMobileViewport, setMobilePanel]);

    useEffect(() => {
        if (
            isMobileViewport &&
            !availableMobilePanels.includes(activeMobilePanel)
        ) {
            setMobilePanel(availableMobilePanels[0]);
        }
    }, [
        activeMobilePanel,
        availableMobilePanels,
        isMobileViewport,
        setMobilePanel,
    ]);

    useEffect(() => {
        if (!isMobileViewport) {
            return;
        }
        if (showFileManager) {
            setMobilePanel('files');
            return;
        }
        if (activeMobilePanel === 'files') {
            setMobilePanel('editor');
        }
    }, [activeMobilePanel, isMobileViewport, setMobilePanel, showFileManager]);

    const onMobilePrevPanelClicked = useCallback(() => {
        const prevPanel =
            availableMobilePanels[
                (activePanelIndex - 1 + availableMobilePanels.length) %
                    availableMobilePanels.length
            ];
        activateMobilePanel(prevPanel);
    }, [activateMobilePanel, activePanelIndex, availableMobilePanels]);

    const onMobileNextPanelClicked = useCallback(() => {
        const nextPanel =
            availableMobilePanels[
                (activePanelIndex + 1) % availableMobilePanels.length
            ];
        activateMobilePanel(nextPanel);
    }, [activateMobilePanel, activePanelIndex, availableMobilePanels]);

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
            {isMobileViewport ? (
                <div
                    className="project-mobile-switcher"
                    aria-label="Project panel navigation"
                >
                    <button
                        type="button"
                        className="project-mobile-switcher-button project-mobile-switcher-button--reverse"
                        onClick={onMobilePrevPanelClicked}
                        aria-label="Show previous panel"
                    >
                        <RightArrowIcon />
                    </button>
                    <span className="project-mobile-switcher-indicator">
                        {activePanelIndex + 1}/{availableMobilePanels.length}
                    </span>
                    <button
                        type="button"
                        className="project-mobile-switcher-button"
                        onClick={onMobileNextPanelClicked}
                        aria-label="Show next panel"
                    >
                        <RightArrowIcon />
                    </button>
                </div>
            ) : null}
            <DeleteFilesModal />
        </div>
    );
};

export default ProjectPage;
