/**
 * GH-197 на настоящем SDK OpenPanel: подменена только сеть. Видно, какие запросы
 * уходят на /track и с каким profileId. Событие без profileId сервер пишет на deviceId,
 * и в OpenPanel появляется безымянный профиль Anonymous.
 * Свежие копии модулей при том же localStorage изображают новую вкладку.
 */
jest.mock('@sentry/react', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
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

type OpenPanelModule = typeof import('../../../web/openpanel');
type SessionModule = typeof import('../../../web/session.ts');

type Sent = {
    type: string;
    payload: {
        name?: string;
        profileId?: string;
        firstName?: string;
        properties?: Record<string, unknown>;
    };
};

const MINUTE = 60 * 1000;
const LANDING_GUEST = 'landingguest';
const LANDING_NAME = 'anonymous000042';

let openpanel: OpenPanelModule;
let session: SessionModule;
const fetchMock = jest.fn();

async function openTab() {
    jest.resetModules();
    openpanel = await import('../../../web/openpanel');
    session = await import('../../../web/session.ts');
}

/** Запросы SDK живут в нескольких промисах подряд, одного тика не хватает */
const flushNetwork = async () => {
    for (let step = 0; step < 10; step += 1) {
        await Promise.resolve();
    }
};

const sent = (): Sent[] =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body) as Sent);

const tracked = (name: string) =>
    sent().filter(
        (body) => body.type === 'track' && body.payload.name === name
    );

/** Что оставляет лендинг: гостя, его имя, флаг старта и время последнего события */
function seedLandingGuest(idleMs = 0) {
    window.localStorage.setItem(
        session.OPENPANEL_PROFILE_STORAGE_KEY,
        LANDING_GUEST
    );
    window.localStorage.setItem(
        session.OPENPANEL_FIRST_NAME_STORAGE_KEY,
        LANDING_NAME
    );
    window.localStorage.setItem(session.OPENPANEL_SESSION_STARTED_KEY, '1');
    window.localStorage.setItem(
        session.OPENPANEL_LAST_ACTIVITY_STORAGE_KEY,
        String(Date.now() - idleMs)
    );
}

/** Каждый запрос в OpenPanel несёт именно этот профиль */
function expectEverythingSentAs(profileId: string) {
    expect(sent().length).toBeGreaterThan(0);
    for (const body of sent()) {
        expect(body.payload.profileId).toBe(profileId);
    }
}

beforeEach(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ({
        status: 200,
        text: async () =>
            JSON.stringify({ deviceId: 'device-1', sessionId: 'server-1' }),
    }));
    global.fetch = fetchMock as unknown as typeof fetch;
    await openTab();
});

afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
});

test('nothing-reaches-openpanel-before-the-profile-is-known', async () => {
    const service = new openpanel.OpenPanelService();

    service.onEvent('page_viewed', { path: '/project/default' });
    service.trackSentryEvent({ event_id: 'abc123', message: 'boom' });
    await flushNetwork();

    expect(fetchMock).not.toHaveBeenCalled();
});

// случай 1: лендинг, затем редактор в той же вкладке
test('case-1-the-landing-guest-gets-the-first-page-view', async () => {
    seedLandingGuest();
    const service = new openpanel.OpenPanelService();
    service.onEvent('page_viewed', { path: '/project/default' });

    await service.init();
    await flushNetwork();

    expectEverythingSentAs(LANDING_GUEST);
    expect(tracked('[E] Page viewed')).toHaveLength(1);
    // исходное время события SDK сохраняет, даже если оно ждало профиль в очереди
    expect(tracked('[E] Page viewed')[0].payload.properties).toEqual(
        expect.objectContaining({ __timestamp: expect.any(String) })
    );
    expect(tracked('[E] Session started')).toHaveLength(0);
    expect(sent()).toContainEqual(
        expect.objectContaining({
            type: 'identify',
            payload: expect.objectContaining({
                profileId: LANDING_GUEST,
                firstName: LANDING_NAME,
            }),
        })
    );
});

// случай 2: прямой заход, первое событие и порождённый им session_start идут на гостя
test('case-2-a-direct-visit-sends-the-page-view-as-the-new-guest', async () => {
    const service = new openpanel.OpenPanelService();
    service.onEvent('page_viewed', { path: '/project/default' });

    await service.init();
    await flushNetwork();

    const guestId = session.getSessionId() ?? '';
    expect(guestId).toMatch(/^[0-9A-Za-z]+$/);
    expectEverythingSentAs(guestId);
    // первым на сервер приходит page view: по нему сервер и начинает сессию
    expect(sent()[0].payload.name).toBe('[E] Page viewed');
    expect(tracked('[E] Session started')).toHaveLength(1);
    expect(sent()).toContainEqual(
        expect.objectContaining({
            type: 'identify',
            payload: expect.objectContaining({
                profileId: guestId,
                firstName: expect.stringMatching(/^anonymous\d{6}$/),
            }),
        })
    );
});

// случай 3: пример с лендинга открывается в новой вкладке, sessionStorage она не получает
test('case-3-a-new-tab-from-the-landing-continues-the-same-guest', async () => {
    seedLandingGuest();
    window.sessionStorage.clear();
    await openTab();
    const service = new openpanel.OpenPanelService();
    service.onEvent('page_viewed', { path: '/project/default' });

    await service.init();
    await flushNetwork();

    expect(session.getSessionId()).toBe(LANDING_GUEST);
    expectEverythingSentAs(LANDING_GUEST);
    expect(tracked('[E] Session started')).toHaveLength(0);
});

// случай 4: лендинг после редактора читает этот контракт и второго гостя не заводит
test('case-4-the-editor-leaves-its-guest-for-the-landing', async () => {
    const service = new openpanel.OpenPanelService();
    service.onEvent('page_viewed', { path: '/project/default' });

    await service.init();
    await flushNetwork();

    const identifyBody = sent().find((body) => body.type === 'identify');
    expect(
        window.localStorage.getItem(session.OPENPANEL_PROFILE_STORAGE_KEY)
    ).toBe(session.getSessionId());
    expect(
        window.localStorage.getItem(session.OPENPANEL_FIRST_NAME_STORAGE_KEY)
    ).toBe(identifyBody?.payload.firstName);
    expect(
        window.localStorage.getItem(session.OPENPANEL_SESSION_STARTED_KEY)
    ).toBe('1');
    const lastActivity = Number(
        window.localStorage.getItem(session.OPENPANEL_LAST_ACTIVITY_STORAGE_KEY)
    );
    expect(Date.now() - lastActivity).toBeLessThan(MINUTE);
});

// согласованное отличие от задачи: у вошедшего page view сразу уходит на user{id}
test('a-signed-in-page-view-goes-to-the-user-and-no-guest-profile-appears', async () => {
    seedLandingGuest();
    const service = new openpanel.OpenPanelService();
    service.onEvent('page_viewed', { path: '/project/default' });
    service.trackSentryEvent({ event_id: 'abc123', message: 'boom' });

    await service.init('111');
    await flushNetwork();

    expectEverythingSentAs('111');
    expect(tracked('[E] Error reported to sentry')).toHaveLength(1);
    expect(sent()).toContainEqual(
        expect.objectContaining({
            type: 'identify',
            payload: expect.objectContaining({
                profileId: '111',
                firstName: 'user111',
            }),
        })
    );
});

test('the-landing-guest-is-reused-within-thirty-minutes', async () => {
    seedLandingGuest(29 * MINUTE);
    const service = new openpanel.OpenPanelService();

    await service.init();
    await flushNetwork();

    expectEverythingSentAs(LANDING_GUEST);
    expect(tracked('[E] Session started')).toHaveLength(0);
});

test('after-a-longer-pause-a-new-guest-starts-a-new-session', async () => {
    seedLandingGuest(31 * MINUTE);
    const service = new openpanel.OpenPanelService();
    service.onEvent('page_viewed', { path: '/project/default' });

    await service.init();
    await flushNetwork();

    const guestId = session.getSessionId() ?? '';
    expect(guestId).not.toBe(LANDING_GUEST);
    expectEverythingSentAs(guestId);
    expect(tracked('[E] Session started')).toHaveLength(1);
    expect(sent()).not.toContainEqual(
        expect.objectContaining({
            payload: expect.objectContaining({ firstName: LANDING_NAME }),
        })
    );
});

test('logout-sends-the-next-events-as-a-new-guest', async () => {
    const service = new openpanel.OpenPanelService();
    await service.init('111');
    await flushNetwork();
    fetchMock.mockClear();

    service.onLogout();
    service.onEvent('start_run');
    await flushNetwork();

    const guestId = session.getSessionId() ?? '';
    expect(guestId).not.toBe('111');
    expectEverythingSentAs(guestId);
});

// находка разбора: вкладка простояла дольше окна, и следующий заход на лендинг завёл бы второго гостя
test('an-idle-tab-keeps-the-device-on-its-guest-and-starts-a-new-session', async () => {
    const service = new openpanel.OpenPanelService();
    await service.init();
    await flushNetwork();
    const guestId = session.getSessionId() ?? '';
    const name = window.localStorage.getItem(
        session.OPENPANEL_FIRST_NAME_STORAGE_KEY
    );
    // пауза дольше окна: отметка активности ушла в прошлое
    window.localStorage.setItem(
        session.OPENPANEL_LAST_ACTIVITY_STORAGE_KEY,
        String(Date.now() - 31 * MINUTE)
    );
    fetchMock.mockClear();

    service.onEvent('start_run');
    await flushNetwork();

    expectEverythingSentAs(guestId);
    expect(tracked('[E] Session started')).toHaveLength(1);
    // новая вкладка или лендинг продолжают того же гостя и старт не повторяют
    await openTab();
    expect(session.createGuestSessionId()).toBe(guestId);
    expect(session.readOrCreateGuestDisplayName()).toBe(name);
    expect(session.guestSessionAlreadyStarted()).toBe(true);
});

test('an-idle-signed-in-tab-does-not-hand-its-user-to-the-landing', async () => {
    const service = new openpanel.OpenPanelService();
    await service.init('111');
    await flushNetwork();
    window.localStorage.setItem(
        session.OPENPANEL_LAST_ACTIVITY_STORAGE_KEY,
        String(Date.now() - 31 * MINUTE)
    );
    fetchMock.mockClear();

    service.onEvent('start_run');
    await flushNetwork();

    expect(tracked('[E] Session started')).toHaveLength(0);
    expect(
        window.localStorage.getItem(session.OPENPANEL_PROFILE_STORAGE_KEY)
    ).toBeNull();
});
