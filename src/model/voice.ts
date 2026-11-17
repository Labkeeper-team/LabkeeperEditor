/**
 * Голосовой ввод (GH-271): запись с микрофона для распознавания речи на
 * сервере. Форматы те, что принимает recognizeSpeech в спеке v4
 */

/** oggopus: Opus в контейнере Ogg; lpcm: сырой PCM 16 бит без заголовка */
export type SpeechFormat = 'oggopus' | 'lpcm';

export type SpeechSampleRate = 8000 | 16000 | 48000;

export interface VoiceRecording {
    audio: Blob;
    format: SpeechFormat;
    /** Частота PCM; у Ogg сервер её не спрашивает */
    sampleRateHertz?: SpeechSampleRate;
    durationMs: number;
}

/** Почему записать не вышло: о каждом случае человек узнаёт по-своему */
export type VoiceRecorderFailureReason =
    'denied' | 'no_microphone' | 'unsupported' | 'failed';

export class VoiceRecorderFailure extends Error {
    constructor(public readonly reason: VoiceRecorderFailureReason) {
        super(`Voice recording failed: ${reason}`);
        this.name = 'VoiceRecorderFailure';
    }
}

export interface VoiceRecorder {
    /** Браузер умеет записывать звук в одном из форматов сервера */
    isSupported(): boolean;
    /** Просит микрофон и начинает запись. Отказ приходит VoiceRecorderFailure */
    start(): Promise<void>;
    /** Заканчивает запись и отдаёт её. Микрофон освобождается */
    stop(): Promise<VoiceRecording>;
    /** Бросает запись без результата и освобождает микрофон */
    cancel(): void;
}
