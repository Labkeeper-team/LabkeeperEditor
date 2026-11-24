import { RequestResult } from '../../../model/rpi';
import { Events } from '../../../model/service/ObserverService.ts';
import { VoiceRecorderFailure, VoiceRecording } from '../../../model/voice.ts';
import { MockViewModelRepository } from '../../../viewModel/repository';
import { VOICE_LIMIT_MARGIN_MS } from '../../../viewModel/operation/VoiceInputService.ts';
import { mockContext, USER_EMAIL, USER_ID } from '../common.ts';

/**
 * GH-271: голосовой ввод в поле агента. Запись идёт через подменённый
 * микрофон, распознавание через подменённый сервер
 */

const RECORDING: VoiceRecording = {
    audio: new Blob([new Uint8Array(3200)]),
    format: 'lpcm',
    sampleRateHertz: 16000,
    durationMs: 2400,
};

const recognized = (text: string): RequestResult<{ text: string }> => ({
    body: { text },
    code: 200,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
});

const refused = (code: number): RequestResult<{ text: string }> => ({
    body: undefined as never,
    code,
    isOk: false,
    isUnauth: code === 401,
    isForbidden: code === 403,
});

function setup({ signedIn = true } = {}) {
    const ctx = mockContext();
    if (signedIn) {
        ctx.repository.userViewModelRepository.setUserInfo({
            email: USER_EMAIL,
            id: USER_ID,
            isAuthenticated: true,
            privacyPolicyAccepted: true,
            crossBorderDataTransferPolicyAccepted: true,
            tokenBalance: 10,
        });
    }
    ctx.voiceRecorder.recording = RECORDING;
    ctx.rpi.recognizeSpeechRequest = jest
        .fn()
        .mockResolvedValue(recognized('мир'));
    const refreshUserInfo = jest
        .spyOn(ctx.tokenPageService, 'refreshUserInfo')
        .mockResolvedValue(undefined as never);
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
    const toasts = () =>
        (ctx.repository as MockViewModelRepository)
            .mockState()
            .toasts.map((toast) => toast.message);
    const voice = () => ctx.repository.chatViewModelRepository.voice();
    const input = () => ctx.repository.chatViewModelRepository.input();
    const errors = ctx.repository.dictionary.agent_chat.voice.errors;
    return { ...ctx, refreshUserInfo, onEvent, toasts, voice, input, errors };
}

/** Нажать кнопку микрофона дважды: начать и закончить запись */
async function recordOnce(ctx: ReturnType<typeof setup>) {
    await ctx.voiceInputService.onVoiceButtonClicked();
    await ctx.voiceInputService.onVoiceButtonClicked();
}

test('распознанный текст дописывается к набранному через пробел', async () => {
    const ctx = setup();
    ctx.repository.chatViewModelRepository.setInput('Привет');

    await ctx.voiceInputService.onVoiceButtonClicked();
    expect(ctx.voice()).toEqual({
        stage: 'recording',
        startedAt: expect.any(Number),
        limitSeconds: 30,
    });
    await ctx.voiceInputService.onVoiceButtonClicked();

    expect(ctx.rpi.recognizeSpeechRequest).toHaveBeenCalledWith(
        RECORDING,
        'ru-RU'
    );
    expect(ctx.input()).toBe('Привет мир');
    expect(ctx.voice()).toEqual({ stage: 'idle' });
    expect(ctx.toasts()).toEqual([]);
    // агенту текст сам не уходит
    expect(ctx.repository.chatViewModelRepository.requestState()).toBe('idle');
    // распознавание платное: баланс в шапке перечитывается
    expect(ctx.refreshUserInfo).toHaveBeenCalled();
    expect(ctx.onEvent).toHaveBeenCalledWith(
        Events.EVENT_VOICE_INPUT_RECOGNIZED,
        expect.objectContaining({ format: 'lpcm', chars: 3, trigger: 'button' })
    );
});

test('текст в пустое поле и после пробела встаёт без лишнего пробела', async () => {
    const ctx = setup();

    await recordOnce(ctx);
    expect(ctx.input()).toBe('мир');

    ctx.repository.chatViewModelRepository.setInput('Строка\n');
    await recordOnce(ctx);
    expect(ctx.input()).toBe('Строка\nмир');
});

test('язык распознавания берётся из языка интерфейса', async () => {
    const ctx = setup();
    ctx.repository.persistenceViewModelRepository.setLanguage('zh');

    await recordOnce(ctx);

    expect(ctx.rpi.recognizeSpeechRequest).toHaveBeenCalledWith(
        RECORDING,
        'zh-CN'
    );
});

test('гостю вместо записи открывается вход', async () => {
    const ctx = setup({ signedIn: false });
    const start = jest.spyOn(ctx.voiceRecorder, 'start');

    await ctx.voiceInputService.onVoiceButtonClicked();

    expect(start).not.toHaveBeenCalled();
    expect(ctx.repository.authViewModelRepository.currentView()).toBe('login');
    expect(ctx.voice()).toEqual({ stage: 'idle' });
});

test.each([
    ['denied', 'denied'],
    ['no_microphone', 'no_microphone'],
    ['failed', 'failed'],
] as const)(
    'отказ микрофона «%s» объясняется, а запись не начинается',
    async (reason, key) => {
        const ctx = setup();
        ctx.voiceRecorder.startError = new VoiceRecorderFailure(reason);

        await ctx.voiceInputService.onVoiceButtonClicked();

        expect(ctx.toasts()).toEqual([ctx.errors[key]]);
        expect(ctx.voice()).toEqual({ stage: 'idle' });
        expect(ctx.onEvent).toHaveBeenCalledWith(
            Events.EVENT_VOICE_INPUT_FAILED,
            expect.objectContaining({ reason })
        );
    }
);

test('браузер без записи звука получает объяснение', async () => {
    const ctx = setup();
    ctx.voiceRecorder.supported = false;

    await ctx.voiceInputService.onVoiceButtonClicked();

    expect(ctx.toasts()).toEqual([ctx.errors.unsupported]);
});

test.each([
    [400, 'not_recognized'],
    [402, 'no_tokens'],
    [413, 'too_long'],
    [503, 'unavailable'],
    [500, 'failed'],
] as const)(
    'ответ %i объясняется своими словами, а поле не меняется',
    async (code, key) => {
        const ctx = setup();
        ctx.repository.chatViewModelRepository.setInput('Привет');
        ctx.rpi.recognizeSpeechRequest = jest
            .fn()
            .mockResolvedValue(refused(code));

        await recordOnce(ctx);

        expect(ctx.toasts()).toEqual([ctx.errors[key]]);
        expect(ctx.input()).toBe('Привет');
        expect(ctx.voice()).toEqual({ stage: 'idle' });
    }
);

test('пустой ответ значит, что в записи ничего не сказано', async () => {
    const ctx = setup();
    ctx.rpi.recognizeSpeechRequest = jest
        .fn()
        .mockResolvedValue(recognized('  '));

    await recordOnce(ctx);

    expect(ctx.toasts()).toEqual([ctx.errors.nothing_heard]);
    expect(ctx.input()).toBe('');
});

test('истёкшая сессия сообщает о себе', async () => {
    const ctx = setup();
    ctx.rpi.recognizeSpeechRequest = jest.fn().mockResolvedValue(refused(401));

    await recordOnce(ctx);

    expect(ctx.toasts()).toEqual([
        ctx.repository.dictionary.filemanager.errors.sessionExpired,
    ]);
    expect(ctx.refreshUserInfo).toHaveBeenCalled();
});

test('слишком короткая запись не уходит на платное распознавание', async () => {
    const ctx = setup();
    ctx.voiceRecorder.recording = { ...RECORDING, durationMs: 200 };

    await recordOnce(ctx);

    expect(ctx.rpi.recognizeSpeechRequest).not.toHaveBeenCalled();
    expect(ctx.toasts()).toEqual([ctx.errors.too_short]);
});

test('запись останавливается сама у предела из цен сервера', async () => {
    jest.useFakeTimers();
    try {
        const ctx = setup();
        ctx.repository.billingViewModelRepository.setPricing({
            servicePrices: {
                latexCompilationTokenCostPerSecond: 0.1,
                markdownCompilationTokenCostPerSecond: 0.1,
                gptTextPromptTokenCost: 1,
                textRecognitionTokenCostPerPage: 1,
                speechRecognitionTokenCostPer15Seconds: 0.4,
                speechRecognitionMaxDurationSeconds: 10,
            },
            tokenPrices: [],
            userRegularRefill: { amount: 0, period: 'P1D' } as never,
            newUserInitialTokensCount: 0,
        });

        await ctx.voiceInputService.onVoiceButtonClicked();
        expect(ctx.voice()).toMatchObject({ limitSeconds: 10 });
        await jest.advanceTimersByTimeAsync(10_000 - VOICE_LIMIT_MARGIN_MS - 1);
        expect(ctx.rpi.recognizeSpeechRequest).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(1);

        expect(ctx.rpi.recognizeSpeechRequest).toHaveBeenCalledTimes(1);
        expect(ctx.input()).toBe('мир');
        expect(ctx.onEvent).toHaveBeenCalledWith(
            Events.EVENT_VOICE_INPUT_RECOGNIZED,
            expect.objectContaining({ trigger: 'limit' })
        );
    } finally {
        jest.useRealTimers();
    }
});

test('пока браузер спрашивает микрофон, второе нажатие ничего не делает', async () => {
    const ctx = setup();
    let allow: () => void = () => {};
    const start = jest
        .spyOn(ctx.voiceRecorder, 'start')
        .mockReturnValue(new Promise<void>((resolve) => (allow = resolve)));

    const first = ctx.voiceInputService.onVoiceButtonClicked();
    await ctx.voiceInputService.onVoiceButtonClicked();
    expect(ctx.voice()).toEqual({ stage: 'starting' });
    allow();
    await first;

    expect(start).toHaveBeenCalledTimes(1);
    expect(ctx.voice()).toMatchObject({ stage: 'recording' });
});

test('уход со страницы бросает запись и освобождает микрофон', async () => {
    const ctx = setup();
    const cancel = jest.spyOn(ctx.voiceRecorder, 'cancel');
    await ctx.voiceInputService.onVoiceButtonClicked();

    ctx.voiceInputService.onVoiceCancelled();

    expect(cancel).toHaveBeenCalled();
    expect(ctx.voice()).toEqual({ stage: 'idle' });
    expect(ctx.rpi.recognizeSpeechRequest).not.toHaveBeenCalled();
});

test('запись, брошенную во время вопроса о микрофоне, не начинаем', async () => {
    const ctx = setup();
    let allow: () => void = () => {};
    jest.spyOn(ctx.voiceRecorder, 'start').mockReturnValue(
        new Promise<void>((resolve) => (allow = resolve))
    );
    const cancel = jest.spyOn(ctx.voiceRecorder, 'cancel');

    const pending = ctx.voiceInputService.onVoiceButtonClicked();
    ctx.voiceInputService.onVoiceCancelled();
    allow();
    await pending;

    expect(ctx.voice()).toEqual({ stage: 'idle' });
    // микрофон, выданный уже после ухода, тоже отпускаем
    expect(cancel).toHaveBeenCalledTimes(2);
});
