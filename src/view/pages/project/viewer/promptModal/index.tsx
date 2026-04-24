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

    const errorMessage = useMemo((): string => {
        if (promptRequestState === 'bad_request') {
            return dictionary.prompt_modal.errors.bad_request;
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
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    padding: '24px 28px',
                    width: 420,
                    maxWidth: '90vw',
                    position: 'relative',
                }}
            >
                <div style={{ textAlign: 'center' }}>
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
                        style={{
                            backgroundColor: colors.gray60,
                            borderRadius: 8,
                            padding: '10px 12px',
                        }}
                    />
                )}
                <Input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={dictionary.prompt_modal.placeholder}
                    disabled={promptRequestState === 'loading'}
                    multiline
                    rows={10}
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
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-end',
                        gap: 12,
                        width: '100%',
                    }}
                >
                    <div style={{ flex: 1, minWidth: 0 }}>
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
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            backgroundColor: 'rgba(255, 255, 255, 0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 1000,
                            borderRadius: 8,
                        }}
                    >
                        <div
                            style={{
                                width: '40px',
                                height: '40px',
                                border: '4px solid #f3f3f3',
                                borderTop: '4px solid #007bff',
                                borderRadius: '50%',
                                animation: 'spin 1s linear infinite',
                            }}
                        />
                    </div>
                )}
                <style>
                    {`
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    `}
                </style>
            </div>
        </Modal>
    );
};
