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
    jest.resetModules();
    session = await import('../../../web/session.ts');
    ({ logBreadcrumb } =
        (await import('../../../viewModel/utils/logBreadcrumb.ts')) as unknown as {
            logBreadcrumb: jest.Mock;
        });
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
