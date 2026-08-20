import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal } from '../../../../components/modal';
import { Input } from '../../../../components/input';
import { Button } from '../../../../components/button';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import { colors } from '../../../../styles/colors.ts';
import { Typography } from '../../../../components/typography';
import './style.scss';

export const PromptModal = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const showModal = useSelector(
        (state: StorageState) => state.settings.showProjectPromptModal
    );
    const promptRequestState = useSelector(
        (state: StorageState) => state.ide.projectPromptRequestState
    );
    const [prompt, setPrompt] = useState('');

    const errorMessage = useMemo((): string => {
        if (promptRequestState === 'bad_request') {
            return dictionary.prompt_modal.errors.bad_request;
        }
        if (promptRequestState === 'payment_required') {
            return dictionary.prompt_modal.errors.payment_required;
        }
        if (promptRequestState === 'unknownError') {
            return dictionary.prompt_modal.errors.unknownError;
        }
        return '';
    }, [promptRequestState, dictionary]);

    return (
        <Modal
            showModal={showModal}
            onClose={() =>
                dispatch(controller.onPromptModalCrossClickedRequest())
            }
        >
            <div className="prompt-modal">
                <div className="prompt-modal__header">
                    <Typography
                        type="h2"
                        color={colors.gray10}
                        text={dictionary.prompt_modal.title}
                    />
                </div>
                <Typography
                    type="label-small"
                    color={colors.gray20}
                    text={dictionary.prompt_modal.description}
                    className="prompt-modal__description"
                />
                <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={dictionary.prompt_modal.placeholder}
                    disabled={promptRequestState === 'loading'}
                    multiline
                    rows={10}
                />
                {errorMessage && (
                    <Typography
                        type="label-small"
                        color={colors.red10}
                        text={errorMessage}
                    />
                )}
                <div className="prompt-modal__footer">
                    <Button
                        classname="prompt-modal__submit"
                        title={
                            promptRequestState === 'loading'
                                ? dictionary.prompt_modal.sending
                                : dictionary.prompt_modal.submit
                        }
                        onPress={() =>
                            dispatch(
                                controller.onPromptSubmitRequest({
                                    prompt,
                                })
                            )
                        }
                        disabled={
                            promptRequestState === 'loading' ||
                            prompt.length === 0
                        }
                        minimize
                        color="blue"
                        rounded
                        titleIcon={() =>
                            promptRequestState === 'loading' ? (
                                <div className="prompt-modal__spinner-inline" />
                            ) : null
                        }
                    />
                </div>
                {promptRequestState === 'loading' && (
                    <div className="prompt-modal__loading-overlay">
                        <div className="prompt-modal__spinner" />
                    </div>
                )}
            </div>
        </Modal>
    );
};
