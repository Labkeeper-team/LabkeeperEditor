/**
 * Старт сессии аналитики: синхронная часть, отложенная сеть и правило одного присвоения.
 * Идентификатор сессии модульный, поэтому каждый случай берёт свежие копии модулей.
 */
jest.mock('@sentry/react', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}));

const track = jest.fn();
const identify = jest.fn();

jest.mock('@openpanel/web', () => ({
    OpenPanel: jest.fn(() => ({ track, identify })),
}));

jest.mock('../../../constants.ts', () => ({
    Secrets: {
        openpanelClientId: 'client-1',
        openpanelApiUrl: 'http://localhost:4401',
        sentryDsn: '',
    },
}));

jest.mock('../../../viewModel/utils/logBreadcrumb.ts', () => ({
    logBreadcrumb: jest.fn(),
}));

const SESSION_TIMEOUT_MS = 2000;

type OpenPanelModule = typeof import('../../../web/openpanel');
type SessionModule = typeof import('../../../web/session.ts');

let openpanel: OpenPanelModule;
let session: SessionModule;
let logBreadcrumb: jest.Mock;
let captureException: jest.Mock;

/** Сетевая часть старта живёт в нескольких промисах подряд, одного тика не хватает. */
const flushMicrotasks = async () => {
    for (let step = 0; step < 5; step += 1) {
        await Promise.resolve();
    }
};

const sessionStartCalls = () =>
    track.mock.calls.filter(([name]) => name === '[E] Session started');

const identifyPayloads = () => identify.mock.calls.map(([payload]) => payload);

const lastIdentifyPayload = () => {
    const payloads = identifyPayloads();
    return payloads[payloads.length - 1];
};

beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    track.mockResolvedValue(undefined);
    identify.mockReturnValue(undefined);
    openpanel = await import('../../../web/openpanel');
    session = await import('../../../web/session.ts');
    ({ logBreadcrumb } =
        (await import('../../../viewModel/utils/logBreadcrumb.ts')) as unknown as {
            logBreadcrumb: jest.Mock;
        });
    // копии модулей свежие после resetModules, поэтому и мок Sentry берём из того же графа
    ({ captureException } = (await import('@sentry/react')) as unknown as {
        captureException: jest.Mock;
    });
});

afterEach(() => {
    jest.useRealTimers();
});

test('guest-gets-the-header-value-before-analytics-answers', async () => {
    let answerTrack: (value: undefined) => void = () => {};
    track.mockReturnValue(
        new Promise<undefined>((resolve) => {
            answerTrack = resolve;
        })
    );
    const service = new openpanel.OpenPanelService();

    const starting = service.init();

    // запрос старта уже ушёл, ответа ещё нет, а заголовок у гостя уже есть
    const guestId = session.getSessionId();
    expect(sessionStartCalls()).toHaveLength(1);
    expect(guestId).toEqual(expect.any(String));
    expect(identifyPayloads()).toEqual([{ profileId: guestId }]);

    answerTrack(undefined);
    await starting;
});

test('an-authorized-tab-gets-a-local-id-when-the-server-sends-none', async () => {
    track.mockResolvedValue({});
    const service = new openpanel.OpenPanelService();

    await service.init('user-1', 'user@example.com');
    const afterStart = session.getSessionId();
    track.mockResolvedValue({ sessionId: 's-late' });
    await service.init('user-1', 'user@example.com');

    expect(afterStart).toEqual(expect.any(String));
    expect(session.getSessionId()).toBe(afterStart);
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(
        new Error('openpanel.sessionStart'),
        expect.objectContaining({
            tags: { 'error.context': 'openpanel.sessionStart' },
        })
    );
});

test('server-session-id-comes-from-session-started-and-identify-cannot-replace-it', async () => {
    track.mockResolvedValue({ sessionId: 's-1' });
    identify.mockResolvedValue({ sessionId: 's-2' });
    const service = new openpanel.OpenPanelService();

    await service.init('user-1', 'user@example.com');

    expect(session.getSessionId()).toBe('s-1');
});

test('identify-does-not-hold-the-start-longer-than-the-timeout', async () => {
    jest.useFakeTimers();
    identify.mockReturnValue(new Promise(() => {}));
    const service = new openpanel.OpenPanelService();

    const starting = service.init();
    await flushMicrotasks();
    jest.advanceTimersByTime(SESSION_TIMEOUT_MS);
    await starting;

    expect(logBreadcrumb).toHaveBeenCalledWith('openpanel', 'identify failed', {
        error: new Error('OpenPanel identify timed out after 2000ms'),
    });
});

test('a-repeated-init-after-a-broken-start-does-not-open-a-second-session', async () => {
    track.mockRejectedValue(new Error('сеть недоступна'));
    const service = new openpanel.OpenPanelService();

    await service.init();
    await service.init('user-1', 'user@example.com');

    expect(sessionStartCalls()).toHaveLength(1);
});

test('a-logout-during-the-first-init-keeps-the-guest-profile', async () => {
    let answerTrack: (value: { sessionId: string }) => void = () => {};
    track.mockReturnValue(
        new Promise<{ sessionId: string }>((resolve) => {
            answerTrack = resolve;
        })
    );
    const service = new openpanel.OpenPanelService();

    const starting = service.init('user-1', 'user@example.com');
    service.onLogout();
    answerTrack({ sessionId: 's-1' });
    await starting;

    expect(lastIdentifyPayload()).toEqual({
        profileId: session.getSessionId(),
    });
    expect(identifyPayloads()).not.toContainEqual(
        expect.objectContaining({ email: 'user@example.com' })
    );
});

test('a-login-during-the-first-init-identifies-the-user-after-it', async () => {
    let answerTrack: (value: { sessionId: string }) => void = () => {};
    track.mockReturnValue(
        new Promise<{ sessionId: string }>((resolve) => {
            answerTrack = resolve;
        })
    );
    const service = new openpanel.OpenPanelService();

    const guestStart = service.init();
    const guestId = session.getSessionId();
    const loginStart = service.init('user-1', 'user@example.com');
    answerTrack({ sessionId: 's-1' });
    await Promise.all([guestStart, loginStart]);

    expect(sessionStartCalls()).toHaveLength(1);
    expect(identifyPayloads()).toEqual([
        { profileId: guestId },
        { profileId: 'user-1' },
        { profileId: 'user-1', email: 'user@example.com' },
    ]);
});

test('logout-drops-the-id-of-the-user-who-left', async () => {
    track.mockResolvedValue({ sessionId: 's-1' });
    const service = new openpanel.OpenPanelService();
    await service.init('user-1', 'user@example.com');

    service.onLogout();

    const afterLogout = session.getSessionId();
    expect(afterLogout).toEqual(expect.any(String));
    expect(afterLogout).not.toBe('s-1');
    expect(lastIdentifyPayload()).toEqual({ profileId: afterLogout });
});
