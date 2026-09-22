import {
    FILTERED_VALUE,
    scrubCaptcha,
    scrubCaptchaDeep,
} from '../../../web/sentry/scrubCaptcha.ts';

// e2e кодирует токен через encodeURIComponent, поэтому в адресе он может быть с процентами
const TOKEN = 'e2e-Bypass_token%2B42';
const F = FILTERED_VALUE;

describe('scrubCaptcha', () => {
    test.each([
        [
            'relative address',
            `/project/default?captcha=${TOKEN}`,
            `/project/default?captcha=${F}`,
        ],
        [
            'absolute address',
            `https://labkeeper.io/project/default?captcha=${TOKEN}`,
            `https://labkeeper.io/project/default?captcha=${F}`,
        ],
        [
            'parameter first of several',
            `/project/default?captcha=${TOKEN}&type=latex`,
            `/project/default?captcha=${F}&type=latex`,
        ],
        [
            'parameter in the middle',
            `/projects?open=chat&captcha=${TOKEN}&type=latex`,
            `/projects?open=chat&captcha=${F}&type=latex`,
        ],
        [
            'parameter at the end',
            `/projects?open=chat&type=latex&captcha=${TOKEN}`,
            `/projects?open=chat&type=latex&captcha=${F}`,
        ],
        [
            'parameter before a fragment',
            `/project/default?captcha=${TOKEN}#segment-3`,
            `/project/default?captcha=${F}#segment-3`,
        ],
        [
            'repeated parameter',
            `/p?captcha=${TOKEN}&captcha=${TOKEN}`,
            `/p?captcha=${F}&captcha=${F}`,
        ],
        [
            'query string without question mark',
            `captcha=${TOKEN}&type=latex`,
            `captcha=${F}&type=latex`,
        ],
        [
            'request url inside an error text',
            `Request https://labkeeper.io/api/v4/sec/email?email=a%40b.c&registration=true&captcha=${TOKEN} failed`,
            `Request https://labkeeper.io/api/v4/sec/email?email=a%40b.c&registration=true&captcha=${F} failed`,
        ],
        [
            'address in quotes',
            `navigate to "/project/default?captcha=${TOKEN}", then reload`,
            `navigate to "/project/default?captcha=${F}", then reload`,
        ],
        [
            'apostrophe inside the value, which encodeURIComponent keeps',
            `/api/v4/sec/email?captcha=ab'${TOKEN}&type=latex`,
            `/api/v4/sec/email?captcha=${F}&type=latex`,
        ],
        [
            'query string on a new line',
            `request failed\ncaptcha=${TOKEN}&type=latex`,
            `request failed\ncaptcha=${F}&type=latex`,
        ],
        [
            'parameter after a space in a log line',
            `retry with captcha=${TOKEN} later`,
            `retry with captcha=${F} later`,
        ],
        [
            'unencoded nested address',
            `/login?next=/project/default?captcha=${TOKEN}`,
            `/login?next=/project/default?captcha=${F}`,
        ],
        [
            'percent-encoded name, as URLSearchParams decodes it',
            `/project/default?%63aptcha=${TOKEN}`,
            `/project/default?%63aptcha=${F}`,
        ],
        [
            'other case is another parameter for the app',
            `/project/default?Captcha=${TOKEN}`,
            `/project/default?Captcha=${TOKEN}`,
        ],
        [
            'similar names are kept',
            `/p?xcaptcha=1&captcha_id=2&hasCaptcha=true`,
            `/p?xcaptcha=1&captcha_id=2&hasCaptcha=true`,
        ],
        [
            'malformed name next to the parameter',
            `/p?%E0%A4%A=1&captcha=${TOKEN}`,
            `/p?%E0%A4%A=1&captcha=${F}`,
        ],
        ['empty value is kept', `/p?captcha=&a=1`, `/p?captcha=&a=1`],
        [
            'path segment is not a query',
            `/project/captcha=${TOKEN}`,
            `/project/captcha=${TOKEN}`,
        ],
        [
            'address without parameters',
            'https://labkeeper.io/project/default',
            'https://labkeeper.io/project/default',
        ],
    ])('%s', (_, input, expected) => {
        expect(scrubCaptcha(input)).toBe(expected);
    });
});

describe('scrubCaptchaDeep', () => {
    test('scrubs strings, captcha keys and captcha pairs at any depth', () => {
        const source = {
            url: `/project/default?captcha=${TOKEN}`,
            level: 3,
            nested: [{ captcha: TOKEN, hasCaptcha: true }],
            pairs: [
                ['captcha', TOKEN],
                ['type', 'latex'],
            ],
        };

        const scrubbed = scrubCaptchaDeep(source);

        expect(scrubbed).toEqual({
            url: `/project/default?captcha=${F}`,
            level: 3,
            nested: [{ captcha: F, hasCaptcha: true }],
            pairs: [
                ['captcha', F],
                ['type', 'latex'],
            ],
        });
        expect(source.url).toContain(TOKEN);
    });

    test('keeps holes of a sparse array in place', () => {
        const source: unknown[] = [];
        source[3] = `?captcha=${TOKEN}`;
        source.length = 5;

        const scrubbed = scrubCaptchaDeep(source);

        expect(scrubbed).toHaveLength(5);
        expect(Object.keys(scrubbed)).toEqual(['3']);
        expect(scrubbed[3]).toBe(`?captcha=${F}`);
    });

    test('keeps class instances and survives cycles', () => {
        const date = new Date(0);
        const source: Record<string, unknown> = {
            date,
            text: `?captcha=${TOKEN}`,
        };
        source.self = source;

        const scrubbed = scrubCaptchaDeep(source);

        expect(scrubbed.date).toBe(date);
        expect(scrubbed.text).toBe(`?captcha=${F}`);
        expect(scrubbed.self).toBe(scrubbed);
    });
});
