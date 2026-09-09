import { KeyboardEvent } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import {
    AGENT_ITERATION_OPTIONS,
    AGENT_TOKEN_OPTIONS,
} from '../../../../../model/rpi/agentSocket.ts';
import { SegmentedControl } from '../../../../components/segmentedControl';

const formatTokens = (value: number): string =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);

export const PromptField = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const input = useSelector((state: StorageState) => state.chat.input);
    const requestState = useSelector(
        (state: StorageState) => state.chat.requestState
    );
    const maxTokens = useSelector(
        (state: StorageState) => state.persistence.agentMaxTokens
    );
    const iterations = useSelector(
        (state: StorageState) => state.persistence.agentIterations
    );

    const isRunning =
        requestState === 'running' || requestState === 'connecting';
    const canSubmit = input.trim().length > 0 && !isRunning;

    const submit = () => {
        if (!canSubmit) {
            return;
        }
        dispatch(controller.onAgentPromptSubmitRequest());
    };

    const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
        // Enter отправляет, Shift+Enter переносит строку
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
        }
    };

    return (
        <div className="agent-chat__field">
            <textarea
                className="agent-chat__input"
                placeholder={dictionary.agent_chat.placeholder}
                value={input}
                readOnly={isRunning}
                onKeyDown={onKeyDown}
                onChange={(event) =>
                    dispatch(
                        controller.onAgentPromptChangedRequest({
                            text: event.target.value,
                        })
                    )
                }
            />
            <div className="agent-chat__controls">
                <div className="agent-chat__setting">
                    <span className="agent-chat__setting-label">
                        {dictionary.agent_chat.context_size}
                        <span
                            className="agent-chat__info"
                            title={dictionary.agent_chat.context_size_hint}
                        >
                            <InfoIcon />
                        </span>
                    </span>
                    <SegmentedControl
                        ariaLabel={dictionary.agent_chat.context_size}
                        options={AGENT_TOKEN_OPTIONS.map((value) => ({
                            value,
                            label: formatTokens(value),
                        }))}
                        value={maxTokens}
                        disabled={isRunning}
                        onChange={(value) =>
                            dispatch(
                                controller.onAgentMaxTokensChangedRequest({
                                    value,
                                })
                            )
                        }
                    />
                </div>
                <div className="agent-chat__setting">
                    <span className="agent-chat__setting-label">
                        {dictionary.agent_chat.max_iterations}
                        <span
                            className="agent-chat__info"
                            title={dictionary.agent_chat.max_iterations_hint}
                        >
                            <InfoIcon />
                        </span>
                    </span>
                    <SegmentedControl
                        ariaLabel={dictionary.agent_chat.max_iterations}
                        options={AGENT_ITERATION_OPTIONS.map((value) => ({
                            value,
                            label: String(value),
                        }))}
                        value={iterations}
                        disabled={isRunning}
                        onChange={(value) =>
                            dispatch(
                                controller.onAgentIterationsChangedRequest({
                                    value,
                                })
                            )
                        }
                    />
                </div>
                <button
                    type="button"
                    className="agent-chat__submit"
                    disabled={!canSubmit}
                    aria-label={dictionary.agent_chat.send}
                    onClick={submit}
                >
                    <ArrowRight />
                </button>
            </div>
        </div>
    );
};

const InfoIcon = () => (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
        <path
            d="M7 6v4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
        />
        <circle cx="7" cy="4" r="0.8" fill="currentColor" />
    </svg>
);

const ArrowRight = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
            d="M3 10h13M11 5l5 5-5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);
