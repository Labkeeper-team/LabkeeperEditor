import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Modal } from '../../../../components/modal';
import { Input } from '../../../../components/input';
import { Button } from '../../../../components/button';
import { Checkbox } from '../../../../components/checkbox';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import { colors } from '../../../../styles/colors.ts';
import { Typography } from '../../../../components/typography';
import { useIsMobile } from '../../../../hooks/useMobile';
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
    const [generateImage, setGenerateImage] = useState(false);
    const isMobile = useIsMobile();

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
                <div className="prompt-modal__title">
                    <Typography
                        type="h2"
                        color={colors.gray10}
                        text={dictionary.prompt_modal.title}
                    />
                </div>
                {!generateImage && (
                    <Typography
                        type="label-small"
                        color={colors.gray20}
                        text={dictionary.prompt_modal.description}
                        className="prompt-modal__description"
                    />
                )}
                <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={dictionary.prompt_modal.placeholder}
                    disabled={promptRequestState === 'loading'}
                    multiline
                    rows={isMobile ? 6 : 10}
                />
                <Checkbox
                    id="prompt-modal-generate-image"
                    checked={generateImage}
                    onChange={setGenerateImage}
                    title={dictionary.prompt_modal.generateImage}
                />
                {errorMessage && (
                    <Typography
                        type="label-small"
                        color={colors.red10}
                        text={errorMessage}
                    />
                )}
                <div className="prompt-modal__footer">
                    <div className="prompt-modal__footer-description">
                        <Typography
                            type="label-small"
                            color={colors.gray20}
                            text={
                                dictionary.prompt_modal.generateImageDescription
                            }
                            style={{
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                lineHeight: '18px',
                                visibility: generateImage
                                    ? 'visible'
                                    : 'hidden',
                            }}
                        />
                    </div>
                    <Button
                        classname="full-width"
                        title={
                            promptRequestState === 'loading'
                                ? dictionary.prompt_modal.sending
                                : dictionary.prompt_modal.submit
                        }
                        onPress={() =>
                            dispatch(
                                controller.onPromptSubmitRequest({
                                    prompt,
                                    generateImage,
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
                                <div
                                    style={{
                                        width: 16,
                                        height: 16,
                                        marginLeft: 8,
                                        border: '2px solid rgba(255,255,255,0.4)',
                                        borderTop: '2px solid #fff',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                    }}
                                />
                            ) : null
                        }
                    />
                </div>
                {promptRequestState === 'loading' && (
                    <div className="prompt-modal__overlay">
                        <div className="prompt-modal__spinner" />
                    </div>
                )}
            </div>
        </Modal>
    );
};
