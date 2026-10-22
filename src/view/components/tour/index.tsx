import { useDispatch, useSelector } from 'react-redux';
import { createPortal } from 'react-dom';
import './style.scss';
import { Hint } from './hint';
import { useCallback, useMemo, type MouseEvent } from 'react';
import { getPosition, InterfaceTourAnchorClassnames } from './helpers';
import { setTourVisibility } from '../../store/slices/settings';
import { useShowTour } from '../../store/selectors/program';
import { useDictionary } from '../../store/selectors/translations';

export const InterfaceTour = () => {
    const dispatch = useDispatch();
    const showTour = useSelector(useShowTour);
    const dictionary = useSelector(useDictionary);

    const onClick = useCallback(
        (event: MouseEvent<HTMLDivElement>) => {
            if ((event.target as HTMLElement).closest('.hint-container')) {
                return;
            }
            dispatch(setTourVisibility(false));
        },
        [dispatch]
    );

    const runButtonPosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.Run);
    }, [showTour]);

    const addCodeButtonPosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.AddCode);
    }, [showTour]);

    const savePdfButtonPosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.SavePdf);
    }, [showTour]);

    const resultContainerPosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.ResultContainer);
    }, [showTour]);

    const historyPosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.HistoryCodeIde);
    }, [showTour]);

    const settingsPosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.CodeSettings);
    }, [showTour]);

    const problemsPosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.Problems);
    }, [showTour]);

    const idePosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.Ide);
    }, [showTour]);

    const mobileNavigationPosition = useMemo(() => {
        if (!showTour) {
            return {};
        }
        return getPosition(InterfaceTourAnchorClassnames.MobileNavigation);
    }, [showTour]);

    if (!showTour) {
        return;
    }

    return createPortal(
        <div onClick={onClick} className="interface-tour-container">
            <Hint
                text={dictionary.interface_tour.info_mobile_navigation}
                anchor="mobile-navigation-anchor"
                hintPosition="bottom"
                position={mobileNavigationPosition}
            />
            <Hint
                text={dictionary.interface_tour.info_history_button}
                anchor="history-anchor"
                hintPosition="bottom-end"
                position={historyPosition}
            />
            <Hint
                text={dictionary.interface_tour.info_computed_segment}
                anchor="add-anchor"
                hintPosition="bottom"
                position={addCodeButtonPosition}
            />
            <Hint
                text={dictionary.interface_tour.info_project_settings}
                anchor="settings-anchor"
                hintPosition="bottom"
                position={settingsPosition}
            />
            <Hint
                text={dictionary.interface_tour.info_run}
                anchor="run-anchor"
                hintPosition="top"
                position={runButtonPosition}
            />
            <Hint
                text={dictionary.interface_tour.info_result}
                anchor="result-anchor"
                hintPosition="top"
                position={resultContainerPosition}
            />
            <Hint
                text={dictionary.interface_tour.info_pdf}
                anchor="save-pdf-anchor"
                hintPosition="top"
                position={savePdfButtonPosition}
            />

            {/*new*/}
            <Hint
                text={dictionary.interface_tour.info_error}
                anchor="problesms-anchor"
                hintPosition="top"
                position={problemsPosition}
            />
            <Hint
                text={dictionary.interface_tour.info_canvas}
                anchor="ide-anchor"
                hintPosition="top"
                position={idePosition}
            />
            <Hint
                text={dictionary.interface_tour.info_agent_prompt}
                anchor="agent-prompt-anchor"
                hintPosition="top"
                position={getPosition(
                    InterfaceTourAnchorClassnames.AgentPrompt
                )}
            />
            <Hint
                text={dictionary.interface_tour.info_agent_files}
                anchor="agent-files-anchor"
                hintPosition="top"
                position={getPosition(InterfaceTourAnchorClassnames.AgentFiles)}
            />
            <Hint
                text={dictionary.interface_tour.info_agent_settings}
                anchor="agent-settings-anchor"
                hintPosition="top"
                position={getPosition(
                    InterfaceTourAnchorClassnames.AgentSettings
                )}
            />
            <Hint
                text={dictionary.interface_tour.info_enter_agent_mode}
                anchor="enter-agent-mode-anchor"
                hintPosition="bottom"
                position={getPosition(
                    InterfaceTourAnchorClassnames.EnterAgentMode
                )}
            />
            <Hint
                text={dictionary.interface_tour.info_leave_agent_mode}
                anchor="leave-agent-mode-anchor"
                hintPosition="bottom"
                position={getPosition(
                    InterfaceTourAnchorClassnames.LeaveAgentMode
                )}
            />
        </div>,
        document.body
    );
};
