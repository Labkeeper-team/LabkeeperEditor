import { sentryIssueSearchUrl } from '../../../web/sentry/sentryUrl.ts';

describe('sentryIssueSearchUrl', () => {
    test('builds cloud issues search from ingest dsn', () => {
        expect(
            sentryIssueSearchUrl('https://key@o1.ingest.sentry.io/99', 'abc123')
        ).toBe('https://sentry.io/issues/?project=99&query=abc123');
    });

    test('builds regional cloud host from ingest dsn', () => {
        expect(
            sentryIssueSearchUrl(
                'https://key@o1.ingest.us.sentry.io/99',
                'abc123'
            )
        ).toBe('https://us.sentry.io/issues/?project=99&query=abc123');
    });

    test('builds self-hosted sentry search from dsn', () => {
        expect(
            sentryIssueSearchUrl('https://key@sentry.internal/7', 'abc123')
        ).toBe('https://sentry.internal/issues/?project=7&query=abc123');
    });

    test('builds bugsink event url from sdk id without dashes', () => {
        expect(
            sentryIssueSearchUrl(
                'https://key@bugsink.mipt.io/2',
                '507bff3d173b412f9de2ab5384366988'
            )
        ).toBe(
            'https://bugsink.mipt.io/issues/event/507bff3d-173b-412f-9de2-ab5384366988/'
        );
    });

    test('builds bugsink event url from dashed uuid', () => {
        expect(
            sentryIssueSearchUrl(
                'https://key@bugsink.mipt.io/2',
                '507bff3d-173b-412f-9de2-ab5384366988'
            )
        ).toBe(
            'https://bugsink.mipt.io/issues/event/507bff3d-173b-412f-9de2-ab5384366988/'
        );
    });

    test('returns undefined for bugsink without uuid event id', () => {
        expect(
            sentryIssueSearchUrl('https://key@bugsink.mipt.io/2', 'abc123')
        ).toBeUndefined();
    });

    test('returns undefined without dsn', () => {
        expect(sentryIssueSearchUrl(undefined, 'abc123')).toBeUndefined();
        expect(sentryIssueSearchUrl('', 'abc123')).toBeUndefined();
    });
});
