/**
 * Идентификатор сессии лежит в модульной переменной, поэтому каждый случай
 * получает свежую копию модуля через resetModules и динамический импорт.
 */
jest.mock('../../../viewModel/utils/logBreadcrumb.ts', () => ({
    logBreadcrumb: jest.fn(),
}));

type SessionModule = typeof import('../../../web/session.ts');

let session: SessionModule;
let logBreadcrumb: jest.Mock;

beforeEach(async () => {
    window.sessionStorage.clear();
    jest.resetModules();
    session = await import('../../../web/session.ts');
    ({ logBreadcrumb } =
        (await import('../../../viewModel/utils/logBreadcrumb.ts')) as unknown as {
            logBreadcrumb: jest.Mock;
        });
});

afterEach(() => {
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

test('guest-session-id-is-taken-from-the-landing-tab', () => {
    window.sessionStorage.setItem(
        session.OPENPANEL_PROFILE_STORAGE_KEY,
        'landingprofile'
    );

    expect(session.createGuestSessionId()).toBe('landingprofile');
    expect(session.getSessionId()).toBe('landingprofile');
});

test('a-stored-id-with-punctuation-is-ignored', () => {
    window.sessionStorage.setItem(
        session.OPENPANEL_PROFILE_STORAGE_KEY,
        'not-a-profile'
    );

    const issued = session.createGuestSessionId();

    expect(issued).not.toBe('not-a-profile');
    expect(issued).toMatch(/^[0-9A-Za-z]+$/);
    expect(
        window.sessionStorage.getItem(session.OPENPANEL_PROFILE_STORAGE_KEY)
    ).toBe(issued);
});

test('logout-clears-the-landing-tab-and-issues-a-new-id', () => {
    window.sessionStorage.setItem(
        session.OPENPANEL_PROFILE_STORAGE_KEY,
        'landingprofile'
    );
    window.sessionStorage.setItem(session.OPENPANEL_SESSION_STARTED_KEY, '1');
    window.sessionStorage.setItem(
        session.OPENPANEL_ATTRIBUTION_STORAGE_KEY,
        '{"utm_campaign":"spring"}'
    );
    window.sessionStorage.setItem(
        session.OPENPANEL_FIRST_NAME_STORAGE_KEY,
        'anonymous000042'
    );
    session.adoptAnalyticsSessionId('s-1');

    const afterLogout = session.resetSessionIdOnLogout();

    expect(afterLogout).not.toBe('s-1');
    expect(afterLogout).not.toBe('landingprofile');
    expect(
        window.sessionStorage.getItem(session.OPENPANEL_PROFILE_STORAGE_KEY)
    ).toBe(afterLogout);
    expect(
        window.sessionStorage.getItem(session.OPENPANEL_SESSION_STARTED_KEY)
    ).toBeNull();
    expect(
        window.sessionStorage.getItem(session.OPENPANEL_ATTRIBUTION_STORAGE_KEY)
    ).toBeNull();
    expect(
        window.sessionStorage.getItem(session.OPENPANEL_FIRST_NAME_STORAGE_KEY)
    ).toBeNull();
});

test('guest-display-name-stays-the-same-for-the-tab', () => {
    const first = session.readOrCreateGuestDisplayName();

    expect(session.readOrCreateGuestDisplayName()).toBe(first);
    expect(
        window.sessionStorage.getItem(session.OPENPANEL_FIRST_NAME_STORAGE_KEY)
    ).toBe(first);
});

test('a-stored-guest-display-name-is-reused', () => {
    window.sessionStorage.setItem(
        session.OPENPANEL_FIRST_NAME_STORAGE_KEY,
        'anonymous000042'
    );

    expect(session.readOrCreateGuestDisplayName()).toBe('anonymous000042');
});

test('broken-campaign-json-does-not-throw', () => {
    window.sessionStorage.setItem(
        session.OPENPANEL_ATTRIBUTION_STORAGE_KEY,
        '{not-json'
    );

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
