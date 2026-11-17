import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';
import { AppDispatch, StorageState } from '../../../../store';
import { useDictionary } from '../../../../store/selectors/translations';
import { controller } from '../../../../../main.tsx';
import { VOICE_FALLBACK_LIMIT_SECONDS } from '../../../../../viewModel/operation/VoiceInputService.ts';

const clock = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** Сколько секунд идёт запись; пересчитывается, пока она идёт */
const useElapsedSeconds = (startedAt: number | null) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (startedAt === null) {
            return;
        }
        // до первого тика прошедшее время 0: now старше startedAt
        const timer = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(timer);
    }, [startedAt]);
    return startedAt === null
        ? 0
        : Math.max(0, Math.floor((now - startedAt) / 1000));
};

/**
 * GH-271: голосовой ввод. Нажатие начинает запись, второе отправляет её на
 * распознавание, и текст дописывается в поле. Пока идёт запись, на кнопке
 * время, чтобы на телефоне было видно, что микрофон слушает
 */
export const VoiceButton = () => {
    const dispatch = useDispatch<AppDispatch>();
    const texts = useSelector(useDictionary).agent_chat.voice;
    const voice = useSelector((state: StorageState) => state.chat.voice);
    const prices = useSelector(
        (state: StorageState) => state.billing.pricing?.servicePrices
    );
    const recording = voice.stage === 'recording';
    const busy = voice.stage === 'starting' || voice.stage === 'recognizing';
    const elapsed = useElapsedSeconds(recording ? voice.startedAt : null);
    const limit = recording
        ? voice.limitSeconds
        : (prices?.speechRecognitionMaxDurationSeconds ??
          VOICE_FALLBACK_LIMIT_SECONDS);

    // ушли со страницы посреди записи: микрофон не должен остаться включённым
    useEffect(
        () => () => {
            dispatch(controller.onVoiceCancelledRequest());
        },
        [dispatch]
    );

    const label = recording
        ? texts.stop
        : voice.stage === 'recognizing'
          ? texts.recognizing
          : texts.start;
    const price =
        prices?.speechRecognitionTokenCostPer15Seconds !== undefined
            ? `${texts.start}: ${texts.price_hint
                  .replace('${seconds}', String(limit))
                  .replace(
                      '${cost}',
                      String(prices.speechRecognitionTokenCostPer15Seconds)
                  )}`
            : texts.start;

    return (
        <button
            type="button"
            className={classNames('agent-voice', {
                'agent-voice--recording': recording,
                'agent-voice--busy': busy,
            })}
            aria-label={label}
            aria-pressed={recording}
            aria-busy={busy}
            title={recording || busy ? label : price}
            disabled={busy}
            onClick={() => dispatch(controller.onVoiceButtonClickedRequest())}
        >
            {recording ? (
                <>
                    <StopIcon />
                    <span className="agent-voice__time" aria-live="off">
                        {clock(Math.min(elapsed, limit))}
                        <span className="agent-voice__limit">
                            {' / '}
                            {clock(limit)}
                        </span>
                    </span>
                </>
            ) : busy ? (
                <span className="agent-voice__spinner" aria-hidden="true" />
            ) : (
                <MicIcon />
            )}
        </button>
    );
};

const MicIcon = () => (
    <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
    >
        <rect
            x="7"
            y="2"
            width="6"
            height="11"
            rx="3"
            stroke="currentColor"
            strokeWidth="1.6"
        />
        <path
            d="M4 9.5a6 6 0 0 0 12 0M10 15.5V18"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
        />
    </svg>
);

const StopIcon = () => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        aria-hidden="true"
    >
        <rect width="14" height="14" rx="2" fill="currentColor" />
    </svg>
);
