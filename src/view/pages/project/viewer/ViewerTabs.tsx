import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../store';
import { useDictionary } from '../../../store/selectors/translations';
import { setViewerTab } from '../../../store/slices/settings';
import { controller } from '../../../../main.tsx';
import { ViewerTab } from '../../../store/slices';
import { useIsProjectReadonly } from '../../../store/selectors/program';

export const ViewerTabs = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const viewerTab = useSelector(
        (state: StorageState) => state.settings.viewerTab
    );
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const isReadonly = useSelector(useIsProjectReadonly);
    const hasHistory = useSelector(
        (state: StorageState) =>
            state.chat.history.length > 0 || state.chat.messages.length > 0
    );
    const isRunning = useSelector((state: StorageState) => {
        const s = state.chat.requestState;
        return s === 'running' || s === 'connecting';
    });

    // на чужом проекте агента запускать некуда: сервер правок не примет
    if (isReadonly) {
        return null;
    }

    const tabs: { id: ViewerTab; label: string }[] = [
        { id: 'chat', label: dictionary.agent_chat.tab_label },
        { id: 'pdf', label: dictionary.agent_chat.pdf_tab_label },
    ];

    // кнопка очистки истории есть только у авторизованного и только когда есть что чистить
    const showClearHistory =
        viewerTab === 'chat' && isAuthenticated && hasHistory;

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
                    onClick={() => dispatch(setViewerTab(tab.id))}
                >
                    {tab.label}
                </button>
            ))}
            {showClearHistory && (
                <button
                    type="button"
                    disabled={isRunning}
                    className="viewer-tabs__clear"
                    title={dictionary.agent_chat.clear_history}
                    aria-label={dictionary.agent_chat.clear_history}
                    onClick={() =>
                        dispatch(controller.onClearChatHistoryRequest())
                    }
                >
                    <TrashIcon />
                </button>
            )}
        </div>
    );
};

const TrashIcon = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
            d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10M9 9v5M11 9v5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);
