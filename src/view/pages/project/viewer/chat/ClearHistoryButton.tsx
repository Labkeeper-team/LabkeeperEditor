import classNames from 'classnames';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { setSkipClearHistoryConfirm } from '../../../../store/slices/persistence';
import { controller } from '../../../../../main.tsx';
import { Modal } from '../../../../components/modal';
import { Typography } from '../../../../components/typography';
import { Button } from '../../../../components/button';
import { colors } from '../../../../styles/colors';

/**
 * Очистка истории чата: стоит на вкладке агента в обычном режиме и в шапке
 * агентского режима. Есть только у авторизованного и только когда есть что
 * чистить, а пока агент работает, кнопка выключена. Историю не вернуть,
 * поэтому сначала спрашиваем, пока человек не отметит «больше не спрашивать»
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
    const skipConfirm = useSelector(
        (state: StorageState) => state.persistence.skipClearHistoryConfirm
    );
    const [confirming, setConfirming] = useState(false);
    const [dontAskAgain, setDontAskAgain] = useState(false);

    if (!isAuthenticated || !hasHistory) {
        return null;
    }

    const clear = () => dispatch(controller.onClearChatHistoryRequest());
    const closeConfirm = () => {
        setConfirming(false);
        setDontAskAgain(false);
    };

    return (
        <>
            <button
                type="button"
                disabled={isRunning}
                className={classNames('chat-clear-history', className)}
                title={dictionary.agent_chat.clear_history}
                aria-label={dictionary.agent_chat.clear_history}
                onClick={() => (skipConfirm ? clear() : setConfirming(true))}
            >
                <TrashIcon />
            </button>
            <Modal showModal={confirming} onClose={closeConfirm}>
                <div
                    className="chat-clear-history-confirm"
                    role="dialog"
                    aria-label={dictionary.agent_chat.clear_history_confirm}
                >
                    <Typography
                        text={dictionary.agent_chat.clear_history_confirm}
                        type="h2"
                        color={colors.gray10}
                    />
                    {/* нативная галка внутри label: роль, фокус и клик по подписи даёт браузер */}
                    <label className="chat-clear-history-confirm__dont-ask">
                        <input
                            type="checkbox"
                            checked={dontAskAgain}
                            onChange={(event) =>
                                setDontAskAgain(event.target.checked)
                            }
                        />
                        <span>
                            {dictionary.agent_chat.clear_history_dont_ask}
                        </span>
                    </label>
                    <Button
                        classname="chat-clear-history-confirm__button"
                        onPress={() => {
                            if (dontAskAgain) {
                                dispatch(setSkipClearHistoryConfirm(true));
                            }
                            closeConfirm();
                            clear();
                        }}
                        title={dictionary.yes}
                        color="blue"
                        rounded
                        minimize={false}
                    />
                    <Button
                        classname="chat-clear-history-confirm__button"
                        onPress={closeConfirm}
                        title={dictionary.no}
                        color="gray"
                        rounded
                        minimize={false}
                    />
                </div>
            </Modal>
        </>
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
