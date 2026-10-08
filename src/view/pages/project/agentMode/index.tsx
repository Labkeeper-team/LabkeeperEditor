import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch } from '../../../store';
import { useDictionary } from '../../../store/selectors/translations';
import { useAgentModeNavigation } from '../../../hooks/useAgentMode';
import { useIsMobile } from '../../../hooks/useMobile';
import { setMobileView } from '../../../store/slices/settings';
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
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isMobile = useIsMobile();
    const { leaveAgentMode } = useAgentModeNavigation();

    const openEditor = () => {
        leaveAgentMode('button');
        // на телефоне экран один: без этого после выхода остался бы тот же чат,
        // и кнопка «открыть редактор кода» ничего бы не меняла
        if (isMobile) {
            dispatch(setMobileView('editor'));
        }
    };

    return (
        <div className="agent-mode-pane">
            <div className="agent-mode-pane__header">
                <button
                    type="button"
                    className="agent-mode-pane__leave"
                    onClick={openEditor}
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
