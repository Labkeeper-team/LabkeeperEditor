import classNames from 'classnames';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';

/**
 * Очистка истории чата: стоит рядом с вкладками в обычном режиме и в шапке
 * агентского режима. Есть только у авторизованного и только когда есть что
 * чистить, а пока агент работает, кнопка выключена
 */
export const ClearHistoryButton = ({ className }: { className?: string }) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const hasHistory = useSelector(
        (state: StorageState) =>
            state.chat.history.length > 0 || state.chat.messages.length > 0
    );
    const isRunning = useSelector((state: StorageState) => {
        const s = state.chat.requestState;
        return s === 'running' || s === 'connecting';
    });

    if (!isAuthenticated || !hasHistory) {
        return null;
    }

    return (
        <button
            type="button"
            disabled={isRunning}
            className={classNames('chat-clear-history', className)}
            title={dictionary.agent_chat.clear_history}
            aria-label={dictionary.agent_chat.clear_history}
            onClick={() => dispatch(controller.onClearChatHistoryRequest())}
        >
            <TrashIcon />
        </button>
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
