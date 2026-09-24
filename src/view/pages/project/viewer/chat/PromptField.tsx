import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import classNames from 'classnames';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import { AGENT_TOKEN_OPTIONS } from '../../../../../model/rpi/agentSocket.ts';
import { SegmentedControl } from '../../../../components/segmentedControl';
import { promptEditorExtensions } from './promptEditorExtensions.ts';
import { useIsMobile } from '../../../../hooks/useMobile';
import { useHasFinePointer } from '../../../../hooks/useFinePointer';
import { setAgentPromptHeight } from '../../../../store/slices/persistence';
import { usePromptFieldResize } from './usePromptFieldResize.ts';
import { AgentSettings } from './AgentSettings.tsx';

const FIELD_ID = 'agent-chat-field';

const formatTokens = (value: number): string =>
    value >= 1000 ? `${Math.round(value / 1000)}k` : String(value);

export const PromptField = ({ isEmpty }: { isEmpty: boolean }) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isMobile = useIsMobile();
    const hasFinePointer = useHasFinePointer();
    // ручка только при мыши или тачпаде: телефону, даже повёрнутому, она ни к чему
    const resizable = !isMobile && hasFinePointer;
    const fieldRef = useRef<HTMLDivElement>(null);
    const controlsRef = useRef<HTMLDivElement>(null);
    const viewRef = useRef<EditorView | null>(null);
    const storedHeight = useSelector(
        (state: StorageState) => state.persistence.agentPromptHeight
    );
    const commitHeight = useCallback(
        (value: number | null) => dispatch(setAgentPromptHeight(value)),
        [dispatch]
    );
    const resize = usePromptFieldResize({
        fieldRef,
        enabled: resizable,
        isEmpty,
        storedHeight,
        onCommit: commitHeight,
    });
    // поле ужалось, пока в нём печатали, а CodeMirror сам не возвращает курсор из-под нижней кромки
    useLayoutEffect(() => {
        const view = viewRef.current;
        if (!view || !view.hasFocus) {
            return;
        }
        view.dispatch({
            effects: EditorView.scrollIntoView(view.state.selection.main.head, {
                y: 'nearest',
            }),
        });
    }, [resize.height]);
    const input = useSelector((state: StorageState) => state.chat.input);
    const requestState = useSelector(
        (state: StorageState) => state.chat.requestState
    );
    const maxTokens = useSelector(
        (state: StorageState) => state.persistence.agentMaxTokens
    );

    const isRunning =
        requestState === 'running' || requestState === 'connecting';
    const canSubmit = input.trim().length > 0 && !isRunning;

    // пустой запрос и работающего агента отсекают выключенная кнопка и сама команда Enter
    const submit = useCallback(() => {
        dispatch(controller.onAgentPromptSubmitRequest());
    }, [dispatch]);

    const placeholder = dictionary.agent_chat.placeholder;
    // стабильная ссылка: иначе @uiw пересобирает расширения на каждый символ
    const extensions = useMemo(
        () => promptEditorExtensions({ label: placeholder, onSubmit: submit }),
        [placeholder, submit]
    );

    const onChange = useCallback(
        (text: string) => {
            dispatch(controller.onAgentPromptChangedRequest({ text }));
        },
        [dispatch]
    );

    const onCreateEditor = useCallback((view: EditorView) => {
        viewRef.current = view;
    }, []);

    return (
        <div
            id={FIELD_ID}
            ref={fieldRef}
            className={classNames('agent-chat__field', {
                'agent-chat__field--sized': resize.height != null,
            })}
            // высота идёт стилем, а не пропом height у @uiw: тот пересобирает расширения на каждое значение
            style={
                resize.height != null ? { height: resize.height } : undefined
            }
        >
            {resizable && (
                <div
                    {...resize.separatorProps}
                    aria-label={dictionary.agent_chat.resize_prompt}
                    aria-controls={FIELD_ID}
                    className={classNames('agent-chat__resize', {
                        'agent-chat__resize--active': resize.dragging,
                    })}
                />
            )}
            <CodeMirror
                className="agent-chat__input"
                placeholder={placeholder}
                value={input}
                readOnly={isRunning}
                onChange={onChange}
                extensions={extensions}
                onCreateEditor={onCreateEditor}
                basicSetup={false}
                // иначе Tab перестанет уводить фокус из поля
                indentWithTab={false}
            />
            <div ref={controlsRef} className="agent-chat__controls">
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
                {/* панель живёт внутри поля: соседи поля в .agent-chat задают границы ручки */}
                <AgentSettings
                    fieldRef={fieldRef}
                    controlsRef={controlsRef}
                    isRunning={isRunning}
                />
                {/* пока агент работает, та же круглая кнопка прерывает прогон */}
                {isRunning ? (
                    <button
                        type="button"
                        className="agent-chat__submit agent-chat__submit--stop"
                        aria-label={dictionary.agent_chat.abort}
                        onClick={() =>
                            dispatch(controller.onAgentAbortRequest())
                        }
                    >
                        <StopSquare />
                    </button>
                ) : (
                    <button
                        type="button"
                        className="agent-chat__submit"
                        disabled={!canSubmit}
                        aria-label={dictionary.agent_chat.send}
                        onClick={submit}
                    >
                        <ArrowRight />
                    </button>
                )}
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

const StopSquare = () => (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="5" y="5" width="10" height="10" rx="2" fill="currentColor" />
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
