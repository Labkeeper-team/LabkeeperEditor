import classNames from 'classnames';
import { useSelector } from 'react-redux';
import { StorageState } from '../../../store';
import { useDictionary } from '../../../store/selectors/translations';
import { ViewerTab } from '../../../store/slices';
import { useIsProjectReadonly } from '../../../store/selectors/program';
import { useAgentModeNavigation } from '../../../hooks/useAgentMode';
import { ClearHistoryButton } from './chat/ClearHistoryButton.tsx';
import { useSelectViewerTab } from './useSelectViewerTab.ts';
import { hotkeyHint } from '../hotkeys/hint.ts';

export const ViewerTabs = () => {
    const dictionary = useSelector(useDictionary);
    const viewerTab = useSelector(
        (state: StorageState) => state.settings.viewerTab
    );
    const selectViewerTab = useSelectViewerTab();
    const isReadonly = useSelector(useIsProjectReadonly);
    const { enterAgentMode } = useAgentModeNavigation();

    // на чужом проекте агента запускать некуда: сервер правок не примет
    if (isReadonly) {
        return null;
    }

    const tabs: { id: ViewerTab; label: string }[] = [
        { id: 'chat', label: dictionary.agent_chat.tab_label },
        { id: 'pdf', label: dictionary.agent_chat.pdf_tab_label },
    ];

    return (
        <div className="viewer-tabs">
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={viewerTab === tab.id}
                    className={classNames('viewer-tabs__tab', {
                        'viewer-tabs__tab--active': viewerTab === tab.id,
                    })}
                    onClick={() => selectViewerTab(tab.id)}
                    {...hotkeyHint(
                        tab.id === 'chat' ? 'viewer_chat' : 'viewer_pdf'
                    )}
                >
                    {tab.label}
                </button>
            ))}
            {/* вход в агентский режим лежит на вкладке агента, у левого края, как в
                макете, и виден при любой открытой вкладке */}
            <button
                type="button"
                className="viewer-tabs__agent-mode"
                {...hotkeyHint('agent_mode', dictionary.agent_mode.enter_hint)}
                aria-label={dictionary.agent_mode.enter}
                onClick={() => enterAgentMode('viewer_tab')}
            >
                <FullScreenIcon />
            </button>
            {/* очистка лежит на самой вкладке агента и в раскладку не входит:
                иначе вкладки меняли бы ширину при переключении */}
            {viewerTab === 'chat' && (
                <ClearHistoryButton className="viewer-tabs__clear" />
            )}
        </div>
    );
};

// Иконка из макета (full-screen, 22 px), контур перенесён без изменений
const FullScreenIcon = () => (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M20.2884 0H13.2V2.2H19.8V8.8H22V1.05059V0H20.2884ZM19.8 19.8H13.2V22H20.2884H22V18.6506V13.2H19.8V19.8ZM2.2 13.2H0V18.6506V22H2.6884H8.8V19.8H2.2V13.2ZM2.2 8.8H0V1.05059V0H2.6884H8.8V2.2H2.2V8.8Z"
            fill="#4469E0"
        />
    </svg>
);
