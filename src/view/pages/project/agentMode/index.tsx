import { useSelector } from 'react-redux';
import { useDictionary } from '../../../store/selectors/translations';
import { useAgentModeNavigation } from '../../../hooks/useAgentMode';
import { AgentChat } from '../viewer/chat';
import { ProblemViewer } from '../editor/problemViewer';

import './style.scss';

/**
 * Левая колонка агентского режима: сверху выход в обычный режим, под ним чат
 * агента, внизу панель ошибок сборки. Правую колонку занимает PDF, её рисует
 * обычный Viewer
 */
export const AgentModePane = () => {
    const dictionary = useSelector(useDictionary);
    const { leaveAgentMode } = useAgentModeNavigation();

    return (
        <div className="agent-mode-pane">
            <div className="agent-mode-pane__header">
                <button
                    type="button"
                    className="agent-mode-pane__leave"
                    onClick={leaveAgentMode}
                >
                    {dictionary.agent_mode.leave}
                </button>
            </div>
            <div className="agent-mode-pane__chat">
                <AgentChat />
            </div>
            <ProblemViewer />
        </div>
    );
};
