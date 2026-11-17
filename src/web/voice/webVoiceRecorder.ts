import {
    VoiceRecorder,
    VoiceRecorderFailure,
    VoiceRecorderFailureReason,
    VoiceRecording,
} from '../../model/voice.ts';
import { PCM_SAMPLE_RATE, downsample, toPcm16 } from './pcm.ts';

/**
 * Запись голоса в браузере (GH-271). WebM сервер не принимает, поэтому
 * MediaRecorder годится, только если пишет Ogg с Opus (Firefox). Остальные
 * браузеры пишут PCM 16 кГц через Web Audio: 30 секунд речи в нём это
 * около 940 КБ, под предел сервера в 1 МБ
 */

const OGG_OPUS = 'audio/ogg;codecs=opus';

type AudioContextClass = typeof AudioContext;

interface OggSession {
    kind: 'ogg';
    stream: MediaStream;
    recorder: MediaRecorder;
    chunks: Blob[];
    startedAt: number;
}

interface PcmSession {
    kind: 'pcm';
    stream: MediaStream;
    context: AudioContext;
    source: MediaStreamAudioSourceNode;
    processor: ScriptProcessorNode;
    chunks: Float32Array[];
    startedAt: number;
}

type Session = OggSession | PcmSession;

const canRecordOgg = (): boolean =>
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(OGG_OPUS);

const audioContextClass = (): AudioContextClass | undefined =>
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextClass })
        .webkitAudioContext;

/** Имена ошибок getUserMedia по спецификации Media Capture and Streams */
function failureReason(error: unknown): VoiceRecorderFailureReason {
    const name = (error as { name?: string } | null)?.name;
    switch (name) {
        case 'NotAllowedError':
        case 'SecurityError':
            return 'denied';
        case 'NotFoundError':
        case 'OverconstrainedError':
            return 'no_microphone';
        // небезопасная страница: mediaDevices есть, а запись нельзя
        case 'TypeError':
            return 'unsupported';
        default:
            return 'failed';
    }
}

const stopTracks = (stream: MediaStream) =>
    stream.getTracks().forEach((track) => track.stop());

function startOgg(stream: MediaStream): OggSession {
    const recorder = new MediaRecorder(stream, { mimeType: OGG_OPUS });
    const session: OggSession = {
        kind: 'ogg',
        stream,
        recorder,
        chunks: [],
        startedAt: Date.now(),
    };
    recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
            session.chunks.push(event.data);
        }
    });
    recorder.start();
    return session;
}

async function startPcm(
    stream: MediaStream,
    context: AudioContext
): Promise<PcmSession> {
    if (context.state === 'suspended') {
        await context.resume();
    }
    const source = context.createMediaStreamSource(stream);
    // ScriptProcessorNode устарел, но есть во всех браузерах; AudioWorklet
    // потребовал бы отдельного модуля ради одной копии буфера
    const processor = context.createScriptProcessor(4096, 1, 1);
    const session: PcmSession = {
        kind: 'pcm',
        stream,
        context,
        source,
        processor,
        chunks: [],
        startedAt: Date.now(),
    };
    processor.onaudioprocess = (event) => {
        // буфер переиспользуется, поэтому копия; берём первый канал, это моно
        session.chunks.push(
            new Float32Array(event.inputBuffer.getChannelData(0))
        );
    };
    source.connect(processor);
    // без выхода Chrome не зовёт onaudioprocess; выход молчит
    processor.connect(context.destination);
    return session;
}

function release(session: Session) {
    if (session.kind === 'ogg') {
        if (session.recorder.state !== 'inactive') {
            session.recorder.stop();
        }
    } else {
        session.processor.onaudioprocess = null;
        session.source.disconnect();
        session.processor.disconnect();
        void session.context.close();
    }
    stopTracks(session.stream);
}

function finishOgg(session: OggSession): Promise<Blob> {
    const done = new Promise<Blob>((resolve) => {
        const collect = () =>
            resolve(new Blob(session.chunks, { type: 'audio/ogg' }));
        if (session.recorder.state === 'inactive') {
            collect();
            return;
        }
        session.recorder.addEventListener('stop', collect, { once: true });
    });
    release(session);
    return done;
}

export class WebVoiceRecorder implements VoiceRecorder {
    private session: Session | null = null;

    isSupported(): boolean {
        return (
            typeof navigator !== 'undefined' &&
            Boolean(navigator.mediaDevices?.getUserMedia) &&
            (canRecordOgg() || Boolean(audioContextClass()))
        );
    }

    async start(): Promise<void> {
        this.cancel();
        if (!this.isSupported()) {
            throw new VoiceRecorderFailure('unsupported');
        }
        const Context = audioContextClass();
        // контекст создаётся прямо в нажатии кнопки: после ожидания
        // разрешения Safari оставил бы его на паузе
        let context = !canRecordOgg() && Context ? new Context() : null;
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    echoCancellation: true,
                    noiseSuppression: true,
                },
            });
        } catch (error) {
            void context?.close();
            throw new VoiceRecorderFailure(failureReason(error));
        }
        try {
            const channels =
                stream.getAudioTracks()[0]?.getSettings().channelCount ?? 1;
            // стерео сервер не принимает, а из PCM берём один канал сами
            if (!context && canRecordOgg() && channels <= 1) {
                this.session = startOgg(stream);
                return;
            }
            if (!context && !Context) {
                throw new VoiceRecorderFailure('unsupported');
            }
            context = context ?? new Context!();
            this.session = await startPcm(stream, context);
        } catch (error) {
            stopTracks(stream);
            void context?.close();
            throw error instanceof VoiceRecorderFailure
                ? error
                : new VoiceRecorderFailure('failed');
        }
    }

    async stop(): Promise<VoiceRecording> {
        const session = this.session;
        if (!session) {
            throw new VoiceRecorderFailure('failed');
        }
        this.session = null;
        const durationMs = Date.now() - session.startedAt;
        if (session.kind === 'ogg') {
            return {
                audio: await finishOgg(session),
                format: 'oggopus',
                durationMs,
            };
        }
        const inputRate = session.context.sampleRate;
        release(session);
        const pcm = toPcm16(downsample(session.chunks, inputRate));
        return {
            audio: new Blob([pcm], { type: 'application/octet-stream' }),
            format: 'lpcm',
            sampleRateHertz: PCM_SAMPLE_RATE,
            durationMs,
        };
    }

    cancel(): void {
        const session = this.session;
        this.session = null;
        if (session) {
            release(session);
        }
    }
}
