import { Fragment, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import { Events } from '../../../../../model/service/ObserverService.ts';
import {
    AgentChangeSummary,
    ChatMessage,
} from '../../../../../viewModel/repository';
import { AgentHistoryEntry } from '../../../../../model/domain.ts';
import { AGENT_STOP_REASONS } from '../../../../../model/rpi/agentSocket.ts';
import { Routes } from '../../../../../viewModel/routes.ts';
import { useNavigate } from 'react-router-dom';
import { AgentMarkdown } from './AgentMarkdown';
import { ExpandIcon } from '../../../../icons';
import { toggleChatSteps } from '../../../../store/slices/chat';
import { groupChatSteps } from '../../../../../viewModel/utils/chatSteps.ts';
import { eventLabel } from './eventLabel.ts';

/** Насколько близко к низу считаем, что пользователь «внизу» и можно доскроллить */
const STICK_TO_BOTTOM_PX = 40;

const formatTime = (iso: string): string => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    });
};

const RequestCard = ({
    text,
    createdAt,
}: {
    text: string;
    createdAt: string;
}) => (
    <div className="agent-chat__request">
        <span className="agent-chat__request-text">{text}</span>
        <span className="agent-chat__request-time">
            {formatTime(createdAt)}
        </span>
    </div>
);

const ResponseBlock = ({ text }: { text: string }) => {
    const dictionary = useSelector(useDictionary);
    return (
        <div className="agent-chat__response">
            <div className="agent-chat__response-label">
                {dictionary.agent_chat.result}
            </div>
            <div className="agent-chat__response-text">
                <AgentMarkdown text={text} />
            </div>
        </div>
    );
};

const ErrorBlock = ({
    reason,
}: {
    reason: Extract<ChatMessage, { kind: 'error' }>['reason'];
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const navigate = useNavigate();
    const stop = dictionary.agent_chat.stop as Record<string, string>;
    // вход меняет дело только там, где отказал сам агент: под обрывом связи и
    // неудачей сохранения он ничего не снимает и выглядел бы разводом на регистрацию
    const offerLogin =
        !isAuthenticated && (AGENT_STOP_REASONS as string[]).includes(reason);
    // вход снимает только лимит для незарегистрированных: под остальными отказами
    // тот же запрос упрётся в то же самое и после входа, обещать это нельзя
    const loginHint =
        reason === 'UnauthorizedLimitExceeded'
            ? dictionary.agent_chat.guest_login_hint_limit
            : dictionary.agent_chat.guest_login_hint;
    return (
        <div className="agent-chat__error">
            <div className="agent-chat__error-label">
                {dictionary.agent_chat.error}
            </div>
            <div className="agent-chat__error-text">
                {stop[reason] ?? stop.UnknownError}
            </div>
            {/* гостю баланс пополнять некуда: покупка всё равно начинается со входа */}
            {reason === 'PaymentRequired' && isAuthenticated && (
                <button
                    type="button"
                    className="agent-chat__buy-tokens"
                    onClick={() => {
                        controller.trackUiEvent(
                            Events.EVENT_BUY_TOKENS_FROM_CHAT
                        );
                        navigate(Routes.Tokens);
                    }}
                >
                    {dictionary.agent_chat.buy_tokens}
                </button>
            )}
            {offerLogin && (
                <>
                    <div className="agent-chat__login-hint">{loginHint}</div>
                    <button
                        type="button"
                        className="agent-chat__login"
                        onClick={() =>
                            dispatch(
                                controller.onAuthButtonClickedRequest(
                                    'agent_error'
                                )
                            )
                        }
                    >
                        {dictionary.agent_chat.guest_login_action}
                    </button>
                </>
            )}
        </div>
    );
};

/** Строка списка собирается здесь: лента хранит ключи, а язык меняется на ходу */
const changeText = (
    texts: Record<string, string>,
    change: AgentChangeSummary
): string =>
    (texts[change.labelKey] ?? change.labelKey)
        .replace('{segment}', String(change.segmentId ?? ''))
        .replace('{file}', change.file ?? '');

const NoticeBlock = ({
    reason,
    changes,
}: {
    reason: Extract<ChatMessage, { kind: 'notice' }>['reason'];
    changes?: AgentChangeSummary[];
}) => {
    const dictionary = useSelector(useDictionary);
    const stop = dictionary.agent_chat.stop as Record<string, string>;
    const texts = dictionary.agent_chat.change as Record<string, string>;
    return (
        <div className="agent-chat__notice">
            <div className="agent-chat__notice-label">
                {dictionary.agent_chat.notice}
            </div>
            <div className="agent-chat__notice-text">
                {stop[reason] ?? stop.UnknownError}
            </div>
            {changes && changes.length > 0 && (
                <ul className="agent-chat__notice-changes">
                    {changes.map((change) => (
                        <li
                            key={`${change.labelKey}:${change.segmentId ?? change.file ?? ''}`}
                        >
                            {changeText(texts, change)}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

const EventRow = ({
    message,
    pending,
}: {
    message: Extract<ChatMessage, { kind: 'event' }>;
    pending: boolean;
}) => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const label = eventLabel(
        dictionary.agent_chat.event as Record<string, string>,
        message.labelKey,
        message.segmentId
    );

    const onNavigate = () => {
        if (!message.target) {
            return;
        }
        dispatch(
            controller.onAgentChangeClickedRequest({ target: message.target })
        );
    };

    return (
        <div className="agent-chat__event">
            <span className="agent-chat__event-label">{label}</span>
            {message.file && (
                <button
                    type="button"
                    className="agent-chat__event-file"
                    onClick={onNavigate}
                    disabled={!message.target}
                >
                    <span className="agent-chat__event-dot" />
                    {message.file}
                </button>
            )}
            {message.lines && (
                <button
                    type="button"
                    className="agent-chat__event-lines"
                    onClick={onNavigate}
                    disabled={!message.target}
                >
                    {message.lines}
                </button>
            )}
            {pending && <span className="agent-chat__spinner" aria-hidden />}
        </div>
    );
};

const StepsToggle = ({
    count,
    expanded,
    onToggle,
}: {
    count: number;
    expanded: boolean;
    onToggle: () => void;
}) => {
    const dictionary = useSelector(useDictionary);
    return (
        <button
            type="button"
            className="agent-chat__steps-toggle"
            aria-expanded={expanded}
            onClick={onToggle}
        >
            {dictionary.agent_chat.steps_toggle.replace(
                '{count}',
                String(count)
            )}
            <ExpandIcon
                aria-hidden
                className={classNames('agent-chat__steps-icon', {
                    'agent-chat__steps-icon--expanded': expanded,
                })}
            />
        </button>
    );
};

const HistoryPair = ({ entry }: { entry: AgentHistoryEntry }) => (
    <div className="agent-chat__pair">
        <RequestCard text={entry.request} createdAt={entry.createdAt} />
        <ResponseBlock text={entry.response} />
    </div>
);

export const Transcript = () => {
    const dispatch = useDispatch<AppDispatch>();
    const dictionary = useSelector(useDictionary);
    const messages = useSelector((state: StorageState) => state.chat.messages);
    const history = useSelector((state: StorageState) => state.chat.history);
    const requestState = useSelector(
        (state: StorageState) => state.chat.requestState
    );
    const historyRequestState = useSelector(
        (state: StorageState) => state.chat.historyRequestState
    );
    const expandedSteps = useSelector(
        (state: StorageState) => state.chat.expandedStepRequestIds
    );
    const steps = useMemo(() => groupChatSteps(messages), [messages]);

    const containerRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);
    // низ отпустила кнопка шагов у прилипшей ленты, а не прокрутка человека
    const releasedByToggle = useRef(false);
    const lastRequestId = useRef<number | null>(null);

    useEffect(() => {
        const node = containerRef.current;
        if (!node) {
            return;
        }
        // высота ленты, которую уже видел ResizeObserver ниже
        let observedHeight = node.clientHeight;
        const onScroll = () => {
            // ленту ужали, а наблюдатель ещё не отработал: это не прокрутка человека, и расстояние до низа врёт
            if (node.clientHeight !== observedHeight) {
                return;
            }
            const distance =
                node.scrollHeight - node.scrollTop - node.clientHeight;
            stickToBottom.current = distance <= STICK_TO_BOTTOM_PX;
            releasedByToggle.current = false;
        };
        // панель запроса подросла (авторост или ручка), и низ ленты не должен уйти под неё
        const observer = new ResizeObserver(() => {
            observedHeight = node.clientHeight;
            if (stickToBottom.current) {
                node.scrollTop = node.scrollHeight;
            }
        });
        observer.observe(node);
        node.addEventListener('scroll', onScroll);
        return () => {
            node.removeEventListener('scroll', onScroll);
            observer.disconnect();
        };
    }, []);

    useLayoutEffect(() => {
        const node = containerRef.current;
        let requestId: number | null = null;
        for (const message of messages) {
            if (message.kind === 'request') {
                requestId = message.id;
            }
        }
        if (requestId !== lastRequestId.current) {
            lastRequestId.current = requestId;
            // новый запрос сам свернул развёрнутые шаги, и держать низ отпущенным больше незачем
            if (releasedByToggle.current) {
                releasedByToggle.current = false;
                stickToBottom.current = true;
            }
        }
        // не перебиваем пользователя, если он ушёл читать прошлые события
        if (!node || !stickToBottom.current) {
            return;
        }
        node.scrollTop = node.scrollHeight;
    }, [messages, history]);

    // MathJax набирает формулы уже после докрутки, и ответ подрастает снизу
    useEffect(() => {
        const node = containerRef.current;
        if (!node) {
            return;
        }
        const observer = new MutationObserver(() => {
            if (stickToBottom.current) {
                node.scrollTop = node.scrollHeight;
            }
        });
        observer.observe(node, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, []);

    const onToggleSteps = (requestId: number) => {
        // прилипшая к низу лента докрутилась бы вниз и увела кнопку вверх на высоту развёрнутых строк
        if (stickToBottom.current) {
            releasedByToggle.current = true;
        }
        stickToBottom.current = false;
        dispatch(toggleChatSteps(requestId));
        // через кадр низ считается заново: в короткой ленте прокручивать нечего, и без этого она не поехала бы за новым прогоном
        requestAnimationFrame(() => {
            const node = containerRef.current;
            if (node) {
                stickToBottom.current =
                    node.scrollHeight - node.scrollTop - node.clientHeight <=
                    STICK_TO_BOTTOM_PX;
            }
        });
    };

    const isRunning =
        requestState === 'running' || requestState === 'connecting';
    const lastIndex = messages.length - 1;
    // пока событий ещё нет, спиннеру не на чем висеть, показываем его отдельной строкой
    const lastMessageIsNotEvent =
        lastIndex < 0 || messages[lastIndex].kind !== 'event';

    const isEmpty = messages.length === 0 && history.length === 0;

    if (historyRequestState === 'loading' && isEmpty) {
        return (
            <div
                className="agent-chat__transcript agent-chat__transcript--empty"
                ref={containerRef}
            >
                <span className="agent-chat__spinner" aria-hidden />
                <span className="agent-chat__hint">
                    {dictionary.agent_chat.history_loading}
                </span>
            </div>
        );
    }

    if (isEmpty && !isRunning) {
        return (
            <div
                className="agent-chat__transcript agent-chat__transcript--empty"
                ref={containerRef}
            >
                {historyRequestState === 'error' && (
                    <span className="agent-chat__hint agent-chat__hint--error">
                        {dictionary.agent_chat.history_error}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="agent-chat__transcript" ref={containerRef}>
            {history.map((entry) => (
                <HistoryPair key={entry.id} entry={entry} />
            ))}
            {messages.map((message, index) => {
                const pending = isRunning && index === lastIndex;
                switch (message.kind) {
                    case 'request': {
                        const stepCount = steps.pastStepCounts[message.id] ?? 0;
                        return (
                            <Fragment key={message.id}>
                                {/* между парами в ленте разделитель, как в макете */}
                                {(index > 0 || history.length > 0) && (
                                    <div className="agent-chat__separator" />
                                )}
                                <RequestCard
                                    text={message.text}
                                    createdAt={message.createdAt}
                                />
                                {stepCount > 0 && (
                                    <StepsToggle
                                        count={stepCount}
                                        expanded={expandedSteps.includes(
                                            message.id
                                        )}
                                        onToggle={() =>
                                            onToggleSteps(message.id)
                                        }
                                    />
                                )}
                            </Fragment>
                        );
                    }
                    case 'response':
                        return (
                            <ResponseBlock
                                key={message.id}
                                text={message.text}
                            />
                        );
                    case 'error':
                        return (
                            <ErrorBlock
                                key={message.id}
                                reason={message.reason}
                            />
                        );
                    case 'notice':
                        return (
                            <NoticeBlock
                                key={message.id}
                                reason={message.reason}
                                changes={message.changes}
                            />
                        );
                    case 'event': {
                        const owner = steps.stepOwner[index];
                        // шаги прошлого прогона ждут под кнопкой у его запроса
                        if (owner !== null && !expandedSteps.includes(owner)) {
                            return null;
                        }
                        return (
                            <EventRow
                                key={message.id}
                                message={message}
                                pending={pending}
                            />
                        );
                    }
                }
            })}
            {isRunning && lastMessageIsNotEvent && (
                <div className="agent-chat__event">
                    <span className="agent-chat__spinner" aria-hidden />
                </div>
            )}
        </div>
    );
};
