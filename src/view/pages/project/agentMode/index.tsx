import { useSelector } from 'react-redux';
import { useDictionary } from '../../../store/selectors/translations';
import { useAgentModeNavigation } from '../../../hooks/useAgentMode';
import { AgentChat } from '../viewer/chat';
import { ClearHistoryButton } from '../viewer/chat/ClearHistoryButton.tsx';

import './style.scss';

/**
 * Левая колонка агентского режима: одна карточка, сверху выход в обычный
 * режим и очистка истории, под ними чат агента. Панели ошибок сборки здесь
 * нет, её оставили редактору, а файлы добавляют прямо из чата. Правую
 * колонку занимает итоговый документ, её рисует обычный Viewer
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
                    onClick={() => leaveAgentMode('button')}
                >
                    {dictionary.agent_mode.leave}
                </button>
                {/* вкладок здесь нет, поэтому очистка истории переехала в шапку */}
                <ClearHistoryButton className="agent-mode-pane__clear" />
            </div>
            <div className="agent-mode-pane__chat">
                <AgentChat withFiles />
            </div>
        </div>
    );
};
