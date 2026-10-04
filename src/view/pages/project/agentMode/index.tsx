import { useSelector } from 'react-redux';
import { useDictionary } from '../../../store/selectors/translations';
import { useAgentModeNavigation } from '../../../hooks/useAgentMode';
import { AgentChat } from '../viewer/chat';

import './style.scss';

/**
 * Левая колонка агентского режима: одна карточка, сверху выход в обычный
 * режим, под ним чат агента. Панели ошибок сборки здесь нет, её оставили
 * редактору. Правую колонку занимает PDF, её рисует обычный Viewer
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
        </div>
    );
};
