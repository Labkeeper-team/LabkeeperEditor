import { Rpi } from '../../model/rpi';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import {
    VoiceRecorder,
    VoiceRecorderFailure,
    VoiceRecorderFailureReason,
    VoiceRecording,
} from '../../model/voice.ts';
import { Language } from '../dictionaries';
import { ViewModelRepository } from '../repository';
import { trackEvent } from '../utils/observerContext.ts';
import { TokenPageService } from './TokenPageService.ts';

/** Предел записи, пока цены с сервера не пришли: столько же отдаёт спека */
export const VOICE_FALLBACK_LIMIT_SECONDS = 30;

/**
 * Запись останавливается чуть раньше предела: сервер отвергает запись
 * длиннее него, а таймер и кодек отстают на доли секунды
 */
export const VOICE_LIMIT_MARGIN_MS = 500;

/**
 * Короче этого распознавать нечего, а сервер берёт плату за каждые
 * начатые 15 секунд: случайное двойное нажатие не должно стоить токенов
 */
export const VOICE_MIN_DURATION_MS = 500;

const SPEECH_LANGUAGES: Record<Language, string> = {
    ru: 'ru-RU',
    en: 'en-US',
    zh: 'zh-CN',
};

type VoiceErrorKey =
    | VoiceRecorderFailureReason
    | 'too_short'
    | 'nothing_heard'
    | 'not_recognized'
    | 'no_tokens'
    | 'too_long'
    | 'unavailable';

/** Ответы recognizeSpeech по спеке v4 */
const ERROR_BY_CODE: Record<number, VoiceErrorKey> = {
    400: 'not_recognized',
    402: 'no_tokens',
    413: 'too_long',
    503: 'unavailable',
};

/**
 * GH-271: голосовой ввод в поле агента. Первое нажатие начинает запись,
 * второе отправляет её на распознавание, а текст дописывается в поле.
 * Агенту он сам не уходит: человек может его поправить
 */
export class VoiceInputService {
    private limitTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(
        private repository: ViewModelRepository,
        private rpi: Rpi,
        private recorder: VoiceRecorder,
        private tokenPageService: TokenPageService,
        private observerService: ObserverService
    ) {}

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    private get chat() {
        return this.repository.chatViewModelRepository;
    }

    onVoiceButtonClicked = async (): Promise<void> => {
        const stage = this.chat.voice().stage;
        if (stage === 'recording') {
            await this.finish('button');
            return;
        }
        if (stage === 'idle') {
            await this.start();
        }
        // пока спрашиваем микрофон или распознаём, нажатие ничего не делает
    };

    /** Запись бросается без распознавания: человек ушёл со страницы */
    onVoiceCancelled = (): void => {
        const stage = this.chat.voice().stage;
        if (stage !== 'starting' && stage !== 'recording') {
            return;
        }
        this.clearLimitTimer();
        this.recorder.cancel();
        this.chat.setVoice({ stage: 'idle' });
    };

    private start = async (): Promise<void> => {
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            this.track(Events.EVENT_AUTH_MODAL_OPENED, { source: 'voice' });
            this.repository.authViewModelRepository.setCurrentView('login');
            return;
        }
        if (!this.recorder.isSupported()) {
            this.fail('unsupported');
            return;
        }
        this.chat.setVoice({ stage: 'starting' });
        try {
            await this.recorder.start();
        } catch (error) {
            this.chat.setVoice({ stage: 'idle' });
            this.fail(
                error instanceof VoiceRecorderFailure ? error.reason : 'failed'
            );
            return;
        }
        // запись бросили, пока браузер спрашивал микрофон
        if (this.chat.voice().stage !== 'starting') {
            this.recorder.cancel();
            return;
        }
        const limitSeconds = this.limitSeconds();
        this.chat.setVoice({
            stage: 'recording',
            startedAt: Date.now(),
            limitSeconds,
        });
        this.limitTimer = setTimeout(
            () => void this.finish('limit'),
            limitSeconds * 1000 - VOICE_LIMIT_MARGIN_MS
        );
        this.track(Events.EVENT_VOICE_INPUT_STARTED, {
            limit_seconds: limitSeconds,
        });
    };

    private finish = async (trigger: 'button' | 'limit'): Promise<void> => {
        if (this.chat.voice().stage !== 'recording') {
            return;
        }
        this.clearLimitTimer();
        this.chat.setVoice({ stage: 'recognizing' });
        let recording: VoiceRecording;
        try {
            recording = await this.recorder.stop();
        } catch (error) {
            this.chat.setVoice({ stage: 'idle' });
            this.fail(
                error instanceof VoiceRecorderFailure ? error.reason : 'failed'
            );
            return;
        }
        if (recording.durationMs < VOICE_MIN_DURATION_MS) {
            this.chat.setVoice({ stage: 'idle' });
            this.fail('too_short', recording);
            return;
        }
        const language =
            this.repository.persistenceViewModelRepository.language();
        const result = await this.rpi.recognizeSpeechRequest(
            recording,
            SPEECH_LANGUAGES[language] ?? SPEECH_LANGUAGES.ru
        );
        this.chat.setVoice({ stage: 'idle' });
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            await this.refreshBalance();
            return;
        }
        if (!result.isOk) {
            this.fail(ERROR_BY_CODE[result.code] ?? 'failed', recording, {
                http_code: result.code,
            });
            return;
        }
        // распознавание платное: баланс в шапке меняется
        await this.refreshBalance();
        const text = (result.body?.text ?? '').trim();
        if (!text) {
            this.fail('nothing_heard', recording);
            return;
        }
        this.appendToInput(text);
        this.track(Events.EVENT_VOICE_INPUT_RECOGNIZED, {
            ...this.describe(recording),
            trigger,
            chars: text.length,
        });
    };

    /** Текст дописывается к набранному через пробел, а не заменяет его */
    private appendToInput = (text: string) => {
        const current = this.chat.input();
        const separator = current && !/\s$/.test(current) ? ' ' : '';
        this.chat.setInput(`${current}${separator}${text}`);
    };

    private fail = (
        reason: VoiceErrorKey,
        recording?: VoiceRecording,
        extra?: Record<string, unknown>
    ) => {
        this.repository.toast(
            this.repository.dictionary.agent_chat.voice.errors[reason],
            'error'
        );
        this.track(Events.EVENT_VOICE_INPUT_FAILED, {
            reason,
            ...(recording ? this.describe(recording) : {}),
            ...extra,
        });
    };

    private describe = (recording: VoiceRecording) => ({
        format: recording.format,
        duration_s: Math.round(recording.durationMs / 100) / 10,
        size_kb: Math.round(recording.audio.size / 1024),
    });

    /** Предел из цен сервера; спека ограничивает его 30 секундами */
    private limitSeconds = (): number => {
        const limit =
            this.repository.billingViewModelRepository.pricing()?.servicePrices
                .speechRecognitionMaxDurationSeconds;
        return limit && limit > 0
            ? Math.min(limit, VOICE_FALLBACK_LIMIT_SECONDS)
            : VOICE_FALLBACK_LIMIT_SECONDS;
    };

    private clearLimitTimer = () => {
        if (this.limitTimer !== null) {
            clearTimeout(this.limitTimer);
            this.limitTimer = null;
        }
    };

    private refreshBalance = async (): Promise<void> => {
        try {
            await this.tokenPageService.refreshUserInfo();
        } catch (error) {
            // баланс это справка в шапке, его отказ не отменяет распознанный текст
            console.error(error);
        }
    };
}
