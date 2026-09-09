import { Fragment, useEffect, useLayoutEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import { ChatMessage } from '../../../../../viewModel/repository';
import { AgentHistoryEntry } from '../../../../../model/domain.ts';
import { Routes } from '../../../../../viewModel/routes.ts';
import { useNavigate } from 'react-router-dom';

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
            <div className="agent-chat__response-text">{text}</div>
        </div>
    );
};

const ErrorBlock = ({
    reason,
}: {
    reason: Extract<ChatMessage, { kind: 'error' }>['reason'];
}) => {
    const dictionary = useSelector(useDictionary);
    const navigate = useNavigate();
    const stop = dictionary.agent_chat.stop as Record<string, string>;
    return (
        <div className="agent-chat__error">
            <div className="agent-chat__error-label">
                {dictionary.agent_chat.error}
            </div>
            <div className="agent-chat__error-text">
                {stop[reason] ?? stop.UnknownError}
            </div>
            {reason === 'PaymentRequired' && (
                <button
                    type="button"
                    className="agent-chat__buy-tokens"
                    onClick={() => navigate(Routes.Tokens)}
                >
                    {dictionary.agent_chat.buy_tokens}
                </button>
            )}
        </div>
    );
};

const NoticeBlock = ({
    reason,
}: {
    reason: Extract<ChatMessage, { kind: 'notice' }>['reason'];
}) => {
    const dictionary = useSelector(useDictionary);
    const stop = dictionary.agent_chat.stop as Record<string, string>;
    return (
        <div className="agent-chat__notice">
            <div className="agent-chat__notice-label">
                {dictionary.agent_chat.notice}
            </div>
            <div className="agent-chat__notice-text">
                {stop[reason] ?? stop.UnknownError}
            </div>
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
    const events = dictionary.agent_chat.event as Record<string, string>;
    const label =
        message.segmentId == null
            ? (events[message.labelKey] ?? message.labelKey)
                  .replace('№{segment}', '')
                  .trim()
            : (events[message.labelKey] ?? message.labelKey).replace(
                  '{segment}',
                  String(message.segmentId)
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

const HistoryPair = ({ entry }: { entry: AgentHistoryEntry }) => (
    <div className="agent-chat__pair">
        <RequestCard text={entry.request} createdAt={entry.createdAt} />
        <ResponseBlock text={entry.response} />
    </div>
);

export const Transcript = () => {
    const dictionary = useSelector(useDictionary);
    const messages = useSelector((state: StorageState) => state.chat.messages);
    const history = useSelector((state: StorageState) => state.chat.history);
    const requestState = useSelector(
        (state: StorageState) => state.chat.requestState
    );
    const historyRequestState = useSelector(
        (state: StorageState) => state.chat.historyRequestState
    );

    const containerRef = useRef<HTMLDivElement>(null);
    const stickToBottom = useRef(true);

    useEffect(() => {
        const node = containerRef.current;
        if (!node) {
            return;
        }
        const onScroll = () => {
            const distance =
                node.scrollHeight - node.scrollTop - node.clientHeight;
            stickToBottom.current = distance <= STICK_TO_BOTTOM_PX;
        };
        node.addEventListener('scroll', onScroll);
        return () => node.removeEventListener('scroll', onScroll);
    }, []);

    useLayoutEffect(() => {
        const node = containerRef.current;
        // не перебиваем пользователя, если он ушёл читать прошлые события
        if (!node || !stickToBottom.current) {
            return;
        }
        node.scrollTop = node.scrollHeight;
    }, [messages, history]);

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
                    case 'request':
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
                            </Fragment>
                        );
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
                            />
                        );
                    case 'event':
                        return (
                            <EventRow
                                key={message.id}
                                message={message}
                                pending={pending}
                            />
                        );
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
