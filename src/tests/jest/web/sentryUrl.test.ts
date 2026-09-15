import { sentryIssueSearchUrl } from '../../../web/sentry/sentryUrl.ts';

test('builds cloud issues search from ingest dsn', () => {
    expect(
        sentryIssueSearchUrl('https://key@o1.ingest.sentry.io/99', 'abc123')
    ).toBe('https://sentry.io/issues/?project=99&query=abc123');
});

test('builds regional cloud host from ingest dsn', () => {
    expect(
        sentryIssueSearchUrl('https://key@o1.ingest.us.sentry.io/99', 'abc123')
    ).toBe('https://us.sentry.io/issues/?project=99&query=abc123');
});

test('builds self-hosted host from dsn', () => {
    expect(
        sentryIssueSearchUrl('https://key@sentry.internal/7', 'abc123')
    ).toBe('https://sentry.internal/issues/?project=7&query=abc123');
});

test('returns undefined without dsn or event id', () => {
    expect(sentryIssueSearchUrl(undefined, 'abc123')).toBeUndefined();
    expect(sentryIssueSearchUrl('', 'abc123')).toBeUndefined();
    expect(
        sentryIssueSearchUrl('https://key@o1.ingest.sentry.io/99', '  ')
    ).toBeUndefined();
});
