/**
 * Идентификатор сессии лежит в модульной переменной, поэтому каждый случай
 * получает свежую копию модуля через resetModules и динамический импорт.
 * Новая копия модуля при том же localStorage и есть новая вкладка того же устройства.
 */
jest.mock('../../../viewModel/utils/logBreadcrumb.ts', () => ({
    logBreadcrumb: jest.fn(),
}));

type SessionModule = typeof import('../../../web/session.ts');

let session: SessionModule;
let logBreadcrumb: jest.Mock;

const MINUTE = 60 * 1000;
const NOW = Date.parse('2026-10-22T12:00:00Z');

/** Ключи гостя с отметкой активности: так их оставляет лендинг или соседняя вкладка */
function seedGuest(values: Record<string, string>, idleMs = 0) {
    for (const [key, value] of Object.entries(values)) {
        window.localStorage.setItem(key, value);
    }
    window.localStorage.setItem(
        session.OPENPANEL_LAST_ACTIVITY_STORAGE_KEY,
        String(Date.now() - idleMs)
    );
}

const stored = (key: string) => window.localStorage.getItem(key);

/** Свежая копия модуля при том же хранилище: так открывается ещё одна вкладка */
async function openAnotherTab(): Promise<SessionModule> {
    jest.resetModules();
    return import('../../../web/session.ts');
}

beforeEach(async () => {
    jest.useFakeTimers({ now: NOW });
    window.localStorage.clear();
    window.sessionStorage.clear();
    jest.resetModules();
    session = await import('../../../web/session.ts');
    ({ logBreadcrumb } =
        (await import('../../../viewModel/utils/logBreadcrumb.ts')) as unknown as {
            logBreadcrumb: jest.Mock;
        });
});

afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
});

test('guest-session-id-is-issued-once', () => {
    const first = session.createGuestSessionId();

    expect(session.createGuestSessionId()).toBe(first);
    expect(session.getSessionId()).toBe(first);
});

test('analytics-session-id-is-adopted-once', () => {
    session.adoptAnalyticsSessionId('s-1');
    session.adoptAnalyticsSessionId('s-2');

    expect(session.getSessionId()).toBe('s-1');
    expect(logBreadcrumb).toHaveBeenCalledWith(
        'session',
        'session id replacement ignored',
        { previous: 's-1', next: 's-2' },
        'warning'
    );
});

test('analytics-does-not-replace-the-guest-id', () => {
    const guest = session.createGuestSessionId();

    session.adoptAnalyticsSessionId('s-1');

    expect(session.getSessionId()).toBe(guest);
});

test('logout-issues-a-new-id-and-keeps-the-one-assignment-rule', () => {
    session.adoptAnalyticsSessionId('s-1');

    const afterLogout = session.resetSessionIdOnLogout();
    session.adoptAnalyticsSessionId('s-2');

    expect(afterLogout).not.toBe('s-1');
    expect(session.getSessionId()).toBe(afterLogout);
});

test('guest-session-id-is-taken-from-the-landing', () => {
    seedGuest({ [session.OPENPANEL_PROFILE_STORAGE_KEY]: 'landingprofile' });

    expect(session.createGuestSessionId()).toBe('landingprofile');
    expect(session.getSessionId()).toBe('landingprofile');
});

// случай 3 из GH-197: пример с лендинга открывается в новой вкладке без копии sessionStorage
test('another-tab-of-the-device-keeps-the-same-guest', async () => {
    const first = session.createGuestSessionId();
    const name = session.readOrCreateGuestDisplayName();
    window.sessionStorage.clear();

    const another = await openAnotherTab();

    expect(another.createGuestSessionId()).toBe(first);
    expect(another.readOrCreateGuestDisplayName()).toBe(name);
});

test('the-guest-survives-a-pause-of-exactly-the-session-length', () => {
    seedGuest(
        {
            [session.OPENPANEL_PROFILE_STORAGE_KEY]: 'landingprofile',
            [session.OPENPANEL_SESSION_STARTED_KEY]: '1',
        },
        session.OPENPANEL_SESSION_IDLE_MS
    );

    expect(session.createGuestSessionId()).toBe('landingprofile');
    expect(session.guestSessionAlreadyStarted()).toBe(true);
});

// после 30 минут тишины OpenPanel начинает новую сессию, и гость с ней новый
test('everything-of-the-guest-expires-after-a-longer-pause', () => {
    seedGuest(
        {
            [session.OPENPANEL_PROFILE_STORAGE_KEY]: 'landingprofile',
            [session.OPENPANEL_SESSION_STARTED_KEY]: '1',
            [session.OPENPANEL_ATTRIBUTION_STORAGE_KEY]:
                '{"utm_campaign":"spring"}',
            [session.OPENPANEL_FIRST_NAME_STORAGE_KEY]: 'anonymous000042',
        },
        session.OPENPANEL_SESSION_IDLE_MS + 1
    );

    expect(session.guestSessionAlreadyStarted()).toBe(false);
    expect(session.readOpenPanelAttribution()).toBeUndefined();
    expect(session.readOrCreateGuestDisplayName()).not.toBe('anonymous000042');
    const issued = session.createGuestSessionId();
    expect(issued).not.toBe('landingprofile');
    expect(stored(session.OPENPANEL_PROFILE_STORAGE_KEY)).toBe(issued);
    expect(stored(session.OPENPANEL_SESSION_STARTED_KEY)).toBeNull();
    expect(stored(session.OPENPANEL_ATTRIBUTION_STORAGE_KEY)).toBeNull();
});

// старый лендинг или чужая запись без времени не знают, когда гость был активен
test('a-guest-without-activity-time-is-not-reused', () => {
    window.localStorage.setItem(
        session.OPENPANEL_PROFILE_STORAGE_KEY,
        'landingprofile'
    );

    expect(session.createGuestSessionId()).not.toBe('landingprofile');
});

test('activity-from-the-future-counts-as-expired', () => {
    seedGuest(
        { [session.OPENPANEL_PROFILE_STORAGE_KEY]: 'landingprofile' },
        -MINUTE
    );

    expect(session.createGuestSessionId()).not.toBe('landingprofile');
});

test('every-event-moves-the-window-forward', async () => {
    const first = session.createGuestSessionId();
    jest.advanceTimersByTime(25 * MINUTE);
    session.markOpenPanelActivity();
    jest.advanceTimersByTime(25 * MINUTE);

    const another = await openAnotherTab();

    expect(another.createGuestSessionId()).toBe(first);
});

test('without-events-the-window-closes', async () => {
    const first = session.createGuestSessionId();
    jest.advanceTimersByTime(session.OPENPANEL_SESSION_IDLE_MS + MINUTE);

    const another = await openAnotherTab();

    expect(another.createGuestSessionId()).not.toBe(first);
});

// вкладка, пережившая паузу, своего гостя не меняет: подмена посреди работы запрещена
test('an-open-tab-keeps-its-guest-after-the-window-closed', () => {
    const first = session.createGuestSessionId();
    jest.advanceTimersByTime(session.OPENPANEL_SESSION_IDLE_MS + MINUTE);

    session.markOpenPanelActivity();

    expect(session.createGuestSessionId()).toBe(first);
    expect(session.getSessionId()).toBe(first);
});

test('a-closed-window-is-not-reopened-by-the-next-event', async () => {
    seedGuest(
        {
            [session.OPENPANEL_PROFILE_STORAGE_KEY]: 'landingprofile',
            [session.OPENPANEL_SESSION_STARTED_KEY]: '1',
        },
        session.OPENPANEL_SESSION_IDLE_MS + MINUTE
    );

    session.markOpenPanelActivity();

    expect(stored(session.OPENPANEL_PROFILE_STORAGE_KEY)).toBeNull();
    expect(stored(session.OPENPANEL_SESSION_STARTED_KEY)).toBeNull();
    expect(stored(session.OPENPANEL_LAST_ACTIVITY_STORAGE_KEY)).toBe(
        String(NOW)
    );
});

test('the-start-flag-is-shared-by-the-tabs', async () => {
    session.markGuestSessionStarted();

    const another = await openAnotherTab();

    expect(another.guestSessionAlreadyStarted()).toBe(true);
});

test('a-throwing-storage-does-not-break-the-tab', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
    });

    const issued = session.createGuestSessionId();
    session.markOpenPanelActivity();
    session.markGuestSessionStarted();
    session.captureOpenPanelAttributionFromLocation();

    expect(issued).toMatch(/^[0-9A-Za-z]+$/);
    expect(session.guestSessionAlreadyStarted()).toBe(false);
    expect(session.readOpenPanelAttribution()).toBeUndefined();
    expect(session.readOrCreateGuestDisplayName()).toMatch(/^anonymous\d{6}$/);
    expect(session.resetSessionIdOnLogout()).toMatch(/^[0-9A-Za-z]+$/);
});

// без доступа к localStorage браузер бросает уже на чтении свойства
test('an-inaccessible-storage-does-not-break-the-tab', () => {
    jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new Error('SecurityError');
    });

    expect(session.createGuestSessionId()).toMatch(/^[0-9A-Za-z]+$/);
    expect(() => session.markOpenPanelActivity()).not.toThrow();
    expect(session.guestSessionAlreadyStarted()).toBe(false);
});

test('a-stored-id-with-punctuation-is-ignored', () => {
    seedGuest({ [session.OPENPANEL_PROFILE_STORAGE_KEY]: 'not-a-profile' });

    const issued = session.createGuestSessionId();

    expect(issued).not.toBe('not-a-profile');
    expect(issued).toMatch(/^[0-9A-Za-z]+$/);
    expect(stored(session.OPENPANEL_PROFILE_STORAGE_KEY)).toBe(issued);
});

test('logout-clears-the-guest-and-issues-a-new-id', () => {
    seedGuest({
        [session.OPENPANEL_PROFILE_STORAGE_KEY]: 'landingprofile',
        [session.OPENPANEL_SESSION_STARTED_KEY]: '1',
        [session.OPENPANEL_ATTRIBUTION_STORAGE_KEY]:
            '{"utm_campaign":"spring"}',
        [session.OPENPANEL_FIRST_NAME_STORAGE_KEY]: 'anonymous000042',
    });
    session.adoptAnalyticsSessionId('s-1');

    const afterLogout = session.resetSessionIdOnLogout();

    expect(afterLogout).not.toBe('s-1');
    expect(afterLogout).not.toBe('landingprofile');
    expect(stored(session.OPENPANEL_PROFILE_STORAGE_KEY)).toBe(afterLogout);
    expect(stored(session.OPENPANEL_SESSION_STARTED_KEY)).toBeNull();
    expect(stored(session.OPENPANEL_ATTRIBUTION_STORAGE_KEY)).toBeNull();
    expect(stored(session.OPENPANEL_FIRST_NAME_STORAGE_KEY)).toBeNull();
});

test('guest-display-name-stays-the-same-for-the-guest', () => {
    const first = session.readOrCreateGuestDisplayName();

    expect(session.readOrCreateGuestDisplayName()).toBe(first);
    expect(stored(session.OPENPANEL_FIRST_NAME_STORAGE_KEY)).toBe(first);
});

test('a-stored-guest-display-name-is-reused', () => {
    seedGuest({
        [session.OPENPANEL_FIRST_NAME_STORAGE_KEY]: 'anonymous000042',
    });

    expect(session.readOrCreateGuestDisplayName()).toBe('anonymous000042');
});

test('broken-campaign-json-does-not-throw', () => {
    seedGuest({ [session.OPENPANEL_ATTRIBUTION_STORAGE_KEY]: '{not-json' });

    expect(session.readOpenPanelAttribution()).toBeUndefined();
});

test('session-query-is-appended-with-the-right-separator', () => {
    expect(session.withSessionQuery('ws://host/path')).toBe('ws://host/path');

    session.adoptAnalyticsSessionId('s 1');

    expect(session.withSessionQuery('ws://host/path')).toBe(
        'ws://host/path?sessionId=s%201'
    );
    expect(session.withSessionQuery('ws://host/path?a=1')).toBe(
        'ws://host/path?a=1&sessionId=s%201'
    );
});

// находка разбора: простоявшая вкладка не должна оставлять хранилище пустым для лендинга
test('an-idle-tab-reclaims-the-window-with-its-guest', () => {
    const first = session.createGuestSessionId();
    jest.advanceTimersByTime(session.OPENPANEL_SESSION_IDLE_MS + MINUTE);

    expect(session.reclaimGuestWindow(first, 'anonymous000007')).toBe(true);

    expect(stored(session.OPENPANEL_PROFILE_STORAGE_KEY)).toBe(first);
    expect(stored(session.OPENPANEL_FIRST_NAME_STORAGE_KEY)).toBe(
        'anonymous000007'
    );
    expect(session.guestSessionAlreadyStarted()).toBe(true);
    // окно снова открыто, второй раз сессия не начинается
    expect(session.reclaimGuestWindow(first, 'anonymous000007')).toBe(false);
});

test('an-open-window-is-not-taken-over', () => {
    seedGuest({ [session.OPENPANEL_PROFILE_STORAGE_KEY]: 'landingprofile' });

    expect(session.reclaimGuestWindow('tabprofile', undefined)).toBe(false);

    expect(stored(session.OPENPANEL_PROFILE_STORAGE_KEY)).toBe(
        'landingprofile'
    );
});
