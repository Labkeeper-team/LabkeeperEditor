/**
 * @jest-environment-options {"url": "https://labkeeper.io/project/default"}
 */
import type { Breadcrumb, ErrorEvent } from '@sentry/react';
import { ANALYTICS_DISABLED_STORAGE_KEY } from '../../../web/analyticsFlag.ts';
import {
    automationTags,
    createBeforeSend,
    scrubBreadcrumb,
} from '../../../web/sentry/hooks.ts';
import { FILTERED_VALUE } from '../../../web/sentry/scrubCaptcha.ts';

const TOKEN = 'e2e-bypass-token-42';
const F = FILTERED_VALUE;

describe('scrubBreadcrumb', () => {
    test.each<[string, Breadcrumb, Breadcrumb]>([
        [
            'navigation from and to',
            {
                category: 'navigation',
                data: {
                    from: `/project/default?captcha=${TOKEN}`,
                    to: `/project/default?captcha=${TOKEN}&type=latex`,
                },
            },
            {
                category: 'navigation',
                data: {
                    from: `/project/default?captcha=${F}`,
                    to: `/project/default?captcha=${F}&type=latex`,
                },
            },
        ],
        [
            'xhr url',
            {
                category: 'xhr',
                type: 'http',
                data: {
                    method: 'POST',
                    url: `/api/v4/sec/email?email=a%40b.c&captcha=${TOKEN}`,
                    status_code: 200,
                },
            },
            {
                category: 'xhr',
                type: 'http',
                data: {
                    method: 'POST',
                    url: `/api/v4/sec/email?email=a%40b.c&captcha=${F}`,
                    status_code: 200,
                },
            },
        ],
        [
            'fetch url',
            {
                category: 'fetch',
                type: 'http',
                data: {
                    method: 'GET',
                    url: `https://labkeeper.io/mathjax/x.js?captcha=${TOKEN}`,
                },
            },
            {
                category: 'fetch',
                type: 'http',
                data: {
                    method: 'GET',
                    url: `https://labkeeper.io/mathjax/x.js?captcha=${F}`,
                },
            },
        ],
        [
            'sentry event message',
            {
                category: 'sentry.event',
                message: `Error: failed at /project/default?captcha=${TOKEN}`,
            },
            {
                category: 'sentry.event',
                message: `Error: failed at /project/default?captcha=${F}`,
            },
        ],
    ])('scrubs %s', (_, breadcrumb, expected) => {
        expect(scrubBreadcrumb(breadcrumb)).toEqual(expected);
    });

    test('scrubs console text and string arguments without touching live objects', () => {
        const state = { location: `/p?captcha=${TOKEN}` };
        const breadcrumb: Breadcrumb = {
            category: 'console',
            level: 'info',
            message: `[startup] open /project/default?captcha=${TOKEN} [object Object]`,
            data: {
                arguments: [
                    `[startup] open /project/default?captcha=${TOKEN}`,
                    state,
                ],
                logger: 'console',
            },
        };

        const scrubbed = scrubBreadcrumb(breadcrumb);

        expect(scrubbed.message).toBe(
            `[startup] open /project/default?captcha=${F} [object Object]`
        );
        expect(scrubbed.data?.arguments).toEqual([
            `[startup] open /project/default?captcha=${F}`,
            state,
        ]);
        expect(scrubbed.data?.arguments[1]).toBe(state);
        expect(state.location).toContain(TOKEN);
        expect(breadcrumb.data?.arguments[0]).toContain(TOKEN);
    });

    test.each([null, 42])('keeps a non-string message %p as is', (message) => {
        const breadcrumb = {
            category: 'console',
            message,
        } as unknown as Breadcrumb;

        expect(scrubBreadcrumb(breadcrumb)).toEqual(breadcrumb);
    });

    test('keeps a breadcrumb without message and data as is', () => {
        const breadcrumb: Breadcrumb = { category: 'ui.click', level: 'info' };

        expect(scrubBreadcrumb(breadcrumb)).toEqual(breadcrumb);
    });
});

describe('createBeforeSend', () => {
    const event = (): ErrorEvent => ({
        type: undefined,
        event_id: '507bff3d173b412f9de2ab5384366988',
        level: 'error',
        message: `Request /api/v4/sec/email?captcha=${TOKEN} failed`,
        request: {
            url: `https://labkeeper.io/project/default?captcha=${TOKEN}&type=latex`,
            query_string: `captcha=${TOKEN}&type=latex`,
            headers: {
                Referer: `https://labkeeper.io/project/default?captcha=${TOKEN}`,
                'User-Agent': 'Mozilla/5.0',
            },
        },
        exception: {
            values: [
                {
                    type: 'Error',
                    value: `Failed to load /project/default?captcha=${TOKEN}`,
                },
            ],
        },
        breadcrumbs: [
            {
                category: 'navigation',
                data: {
                    from: `/project/default?captcha=${TOKEN}`,
                    to: '/projects',
                },
            },
            {
                category: 'console',
                message: `open https://labkeeper.io/?captcha=${TOKEN}`,
                data: {
                    arguments: [{ url: `/p?captcha=${TOKEN}` }],
                    logger: 'console',
                },
            },
        ],
        extra: { cause: { config: { params: { captcha: TOKEN } } } },
        tags: { automation: 'webdriver', e2e: '1' },
    });

    test('scrubs the token everywhere and hands the same event to openpanel', () => {
        const onEvent = jest.fn();

        const sent = createBeforeSend(onEvent)(event());

        expect(sent).toEqual({
            type: undefined,
            event_id: '507bff3d173b412f9de2ab5384366988',
            level: 'error',
            message: `Request /api/v4/sec/email?captcha=${F} failed`,
            request: {
                url: `https://labkeeper.io/project/default?captcha=${F}&type=latex`,
                query_string: `captcha=${F}&type=latex`,
                headers: {
                    Referer: `https://labkeeper.io/project/default?captcha=${F}`,
                    'User-Agent': 'Mozilla/5.0',
                },
            },
            exception: {
                values: [
                    {
                        type: 'Error',
                        value: `Failed to load /project/default?captcha=${F}`,
                    },
                ],
            },
            breadcrumbs: [
                {
                    category: 'navigation',
                    data: {
                        from: `/project/default?captcha=${F}`,
                        to: '/projects',
                    },
                },
                {
                    category: 'console',
                    message: `open https://labkeeper.io/?captcha=${F}`,
                    data: {
                        arguments: [{ url: `/p?captcha=${F}` }],
                        logger: 'console',
                    },
                },
            ],
            extra: { cause: { config: { params: { captcha: F } } } },
            tags: { automation: 'webdriver', e2e: '1' },
        });
        expect(onEvent).toHaveBeenCalledTimes(1);
        expect(onEvent.mock.calls[0][0]).toBe(sent);
    });

    type QueryString = NonNullable<ErrorEvent['request']>['query_string'];

    test.each<[string, QueryString, QueryString]>([
        [
            'object',
            { captcha: TOKEN, type: 'latex' },
            { captcha: F, type: 'latex' },
        ],
        [
            'pairs',
            [
                ['captcha', TOKEN],
                ['type', 'latex'],
            ],
            [
                ['captcha', F],
                ['type', 'latex'],
            ],
        ],
    ])('scrubs query_string given as %s', (_, queryString, expected) => {
        const sent = createBeforeSend(jest.fn())({
            type: undefined,
            request: { query_string: queryString },
        });

        expect(sent?.request?.query_string).toEqual(expected);
    });

    test('keeps an event without the token unchanged', () => {
        const source: ErrorEvent = {
            type: undefined,
            message: 'boom',
            request: { url: 'https://labkeeper.io/projects?type=latex' },
            breadcrumbs: [
                { category: 'navigation', data: { to: '/projects' } },
            ],
        };

        expect(createBeforeSend(jest.fn())(source)).toEqual(source);
    });
});

describe('automationTags', () => {
    const setWebdriver = (value: boolean | undefined) =>
        Object.defineProperty(window.navigator, 'webdriver', {
            configurable: true,
            get: () => value,
        });

    afterEach(() => {
        window.localStorage.clear();
        setWebdriver(undefined);
        jest.restoreAllMocks();
    });

    test('marks a webdriver run started by e2e', () => {
        setWebdriver(true);
        window.localStorage.setItem(ANALYTICS_DISABLED_STORAGE_KEY, '1');

        expect(automationTags()).toEqual({
            automation: 'webdriver',
            e2e: '1',
        });
    });

    test('marks a live browser without the flag', () => {
        setWebdriver(false);
        window.localStorage.setItem(ANALYTICS_DISABLED_STORAGE_KEY, '0');

        expect(automationTags()).toEqual({ automation: 'none' });
    });

    test('survives a blocked localStorage', () => {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('denied', 'SecurityError');
        });

        expect(automationTags()).toEqual({ automation: 'none' });
    });
});
