import classNames from 'classnames';
import { useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { RightArrowIcon } from '../../../icons';
import { controller } from '../../../../main.tsx';
import {
    useActiveMobilePanel,
    useCurrentProject,
    useShowFileManager,
} from '../../../store/selectors/program.ts';
import {
    useCurrentLanguage,
    useDictionary,
} from '../../../store/selectors/translations';
import { AppDispatch, StorageState } from '../../../store';
import { setActiveMobilePanel } from '../../../store/slices/settings';
import { MobileProjectPanel } from '../../../store/slices/index.ts';
import { useIsMobile } from '../../../hooks/useMobile';
import { getAvailableMobilePanels, MOBILE_BREAKPOINT } from './constants';
import './style.scss';

type ProjectPanelSwitcherProps = {
    className?: string;
};

export const ProjectPanelSwitcher = ({
    className,
}: ProjectPanelSwitcherProps) => {
    const dispatch = useDispatch<AppDispatch>();
    const isMobileViewport = useIsMobile(MOBILE_BREAKPOINT);
    const showFileManager = useSelector(useShowFileManager);
    const activeMobilePanel = useSelector(useActiveMobilePanel);
    const project = useSelector(useCurrentProject);
    const dictionary = useSelector(useDictionary);
    const language = useSelector(useCurrentLanguage);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );

    const availableMobilePanels = useMemo(
        () => getAvailableMobilePanels(isAuthenticated),
        [isAuthenticated]
    );

    const activePanelIndex = useMemo(() => {
        const index = availableMobilePanels.indexOf(activeMobilePanel);
        return index >= 0 ? index : 0;
    }, [activeMobilePanel, availableMobilePanels]);

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

    const onMobilePrevPanelClicked = useCallback(() => {
        const prevPanel = availableMobilePanels.at(
            (activePanelIndex - 1 + availableMobilePanels.length) %
                availableMobilePanels.length
        );
        if (!prevPanel) {
            return;
        }
        activateMobilePanel(prevPanel);
    }, [activateMobilePanel, activePanelIndex, availableMobilePanels]);

    const onMobileNextPanelClicked = useCallback(() => {
        const nextPanel = availableMobilePanels.at(
            (activePanelIndex + 1) % availableMobilePanels.length
        );
        if (!nextPanel) {
            return;
        }
        activateMobilePanel(nextPanel);
    }, [activateMobilePanel, activePanelIndex, availableMobilePanels]);

    const prevPanel = availableMobilePanels.at(
        (activePanelIndex - 1 + availableMobilePanels.length) %
            availableMobilePanels.length
    );
    const nextPanel = availableMobilePanels.at(
        (activePanelIndex + 1) % availableMobilePanels.length
    );

    const getPanelLabel = useCallback(
        (panel: MobileProjectPanel | undefined) => {
            if (panel === 'files') {
                return dictionary.filemanager.title;
            }
            if (panel === 'viewer') {
                return 'PDF';
            }
            return language === 'ru' ? 'Код' : 'Editor';
        },
        [dictionary, language]
    );

    if (!isMobileViewport) {
        return null;
    }

    return (
        <div
            className={classNames('project-header-switcher', className)}
            aria-label="Project panel navigation"
        >
            <button
                type="button"
                className="project-header-switcher-button"
                onClick={onMobilePrevPanelClicked}
                aria-label={`Show ${getPanelLabel(prevPanel)}`}
            >
                <span className="project-header-switcher-icon project-header-switcher-icon--reverse">
                    <RightArrowIcon />
                </span>
                <span className="project-header-switcher-label">
                    {getPanelLabel(prevPanel)}
                </span>
            </button>
            <span className="project-header-switcher-indicator">
                {activePanelIndex + 1}/{availableMobilePanels.length}
            </span>
            <button
                type="button"
                className="project-header-switcher-button"
                onClick={onMobileNextPanelClicked}
                aria-label={`Show ${getPanelLabel(nextPanel)}`}
            >
                <span className="project-header-switcher-label">
                    {getPanelLabel(nextPanel)}
                </span>
                <span className="project-header-switcher-icon">
                    <RightArrowIcon />
                </span>
            </button>
        </div>
    );
};
