import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { selectGroupedHunkCount } from '../../../../store/selectors/hunks.ts';
import { setSkipCheckpointRevertConfirm } from '../../../../store/slices/persistence';
import { controller } from '../../../../../main.tsx';
import { Modal } from '../../../../components/modal';
import { Typography } from '../../../../components/typography';
import { Button } from '../../../../components/button';
import { colors } from '../../../../styles/colors';
import { AgentCheckpointView } from '../../../../../viewModel/utils/agentCheckpoint.ts';

const pluralRules: Record<string, Intl.PluralRules> = {};

const pluralLabel = (
    forms: Record<'one' | 'few' | 'many' | 'other', string>,
    language: string,
    count: number
): string => {
    pluralRules[language] ??= new Intl.PluralRules(language);
    const form = pluralRules[language].select(count) as keyof typeof forms;
    return (forms[form] ?? forms.other).replace('{n}', String(count));
};

/**
 * Кнопки под подсвеченным куском ленты. «Откатить» показывает, сколько
 * запросов уйдёт из истории. У гостя отката нет, как и у общих кнопок
 * редактора: его правки откатываются только отменой
 */
export const CheckpointBar = ({ view }: { view: AgentCheckpointView }) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const language = useSelector(
        (state: StorageState) => state.persistence.language
    );
    const authenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const isRunning = useSelector((state: StorageState) => {
        const s = state.chat.requestState;
        return s === 'running' || s === 'connecting';
    });
    const pending = useSelector(
        (state: StorageState) => state.ide.pendingHunkIds.length > 0
    );
    // пока история перечитывается, число записей на кнопке ещё не окончательное
    const syncing = useSelector(
        (state: StorageState) => state.chat.historySyncing
    );
    const changeCount = useSelector(selectGroupedHunkCount);
    const skipConfirm = useSelector(
        (state: StorageState) => state.persistence.skipCheckpointRevertConfirm
    );
    const [confirming, setConfirming] = useState(false);
    const [dontAskAgain, setDontAskAgain] = useState(false);

    const texts = dictionary.agent_chat.checkpoint;
    const entryCount = view.entryIds.length;
    const revertText =
        entryCount > 0
            ? pluralLabel(texts.revert_count, language, entryCount)
            : texts.revert_plain;
    const busy = isRunning || pending || syncing;

    const revert = () => dispatch(controller.onAgentCheckpointRevertRequest());
    const closeConfirm = () => {
        setConfirming(false);
        setDontAskAgain(false);
    };

    return (
        <div className="agent-checkpoint__bar">
            <div className="agent-checkpoint__actions">
                {authenticated && (
                    <button
                        type="button"
                        className="agent-checkpoint__button agent-checkpoint__button--revert"
                        disabled={busy}
                        onClick={() =>
                            skipConfirm ? revert() : setConfirming(true)
                        }
                    >
                        {revertText}
                    </button>
                )}
                <button
                    type="button"
                    className="agent-checkpoint__button agent-checkpoint__button--accept"
                    disabled={busy}
                    onClick={() =>
                        dispatch(controller.onAgentCheckpointAcceptRequest())
                    }
                >
                    {texts.accept}
                </button>
            </div>
            <span className="agent-checkpoint__count">
                {pluralLabel(texts.changes_count, language, changeCount)}
            </span>
            {/* окно уводим из ленты: у чата container-type, и fixed внутри него считался бы от колонки, а не от окна */}
            {createPortal(
                <Modal showModal={confirming} onClose={closeConfirm}>
                    <div
                        className="chat-clear-history-confirm agent-checkpoint__confirm"
                        role="dialog"
                        aria-label={texts.confirm_title}
                    >
                        <Typography
                            text={texts.confirm_title}
                            type="h2"
                            color={colors.gray10}
                        />
                        <p className="agent-checkpoint__confirm-text">
                            {entryCount > 0
                                ? texts.confirm_text
                                : texts.confirm_text_plain}
                        </p>
                        {/* нативная галка внутри label: роль, фокус и клик по подписи даёт браузер */}
                        <label className="chat-clear-history-confirm__dont-ask">
                            <input
                                type="checkbox"
                                checked={dontAskAgain}
                                onChange={(event) =>
                                    setDontAskAgain(event.target.checked)
                                }
                            />
                            <span>{texts.confirm_dont_ask}</span>
                        </label>
                        <Button
                            classname="chat-clear-history-confirm__button"
                            onPress={() => {
                                if (dontAskAgain) {
                                    dispatch(
                                        setSkipCheckpointRevertConfirm(true)
                                    );
                                }
                                closeConfirm();
                                revert();
                            }}
                            title={revertText}
                            color="blue"
                            rounded
                            minimize={false}
                        />
                        <Button
                            classname="chat-clear-history-confirm__button"
                            onPress={closeConfirm}
                            title={texts.cancel}
                            color="gray"
                            rounded
                            minimize={false}
                        />
                    </div>
                </Modal>,
                document.body
            )}
        </div>
    );
};
