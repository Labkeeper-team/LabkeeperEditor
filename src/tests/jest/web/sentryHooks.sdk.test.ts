/**
 * @jest-environment-options {"url": "https://labkeeper.io/project/default?captcha=e2e-bypass-token-42&type=latex", "referrer": "https://labkeeper.io/project/default?captcha=e2e-bypass-token-42"}
 */
// настоящий SDK с опциями из main.tsx сам кладёт адрес, Referer, навигацию и консоль, а опыт читает конверт перед сетью
import * as Sentry from '@sentry/react';
import type { ErrorEvent } from '@sentry/react';
import { ANALYTICS_DISABLED_STORAGE_KEY } from '../../../web/analyticsFlag.ts';
import { sentryOptions } from '../../../web/sentry/hooks.ts';

const TOKEN = 'e2e-bypass-token-42';

test('an event of an e2e run leaves the browser without the captcha token', async () => {
    Object.defineProperty(window.navigator, 'webdriver', {
        configurable: true,
        get: () => true,
    });
    window.localStorage.setItem(ANALYTICS_DISABLED_STORAGE_KEY, '1');
    const bodies: string[] = [];
    const tracked: ErrorEvent[] = [];
    jest.spyOn(console, 'info').mockImplementation(() => {});

    Sentry.init({
        ...sentryOptions((event) => tracked.push(event)),
        dsn: 'https://key@sentry.test/1',
        transport: (options) =>
            Sentry.createTransport(options, async (request) => {
                bodies.push(String(request.body));
                return { statusCode: 200 };
            }),
    });
    console.info(`[startup] open ${window.location.href}`);
    window.history.pushState({}, '', '/projects');
    window.history.pushState({}, '', `/project/default?captcha=${TOKEN}`);
    Sentry.captureException(new Error(`Failed at ${window.location.href}`));
    await Sentry.flush(2000);

    const eventBody = bodies.find((body) => body.includes('"type":"event"'));
    expect(eventBody).toBeDefined();
    const event = JSON.parse(eventBody!.split('\n')[2]) as ErrorEvent;
    expect(event.request?.url).toBe(
        'https://labkeeper.io/project/default?captcha=[Filtered]'
    );
    expect(event.request?.headers?.Referer).toBe(
        'https://labkeeper.io/project/default?captcha=[Filtered]'
    );
    expect(event.exception?.values?.[0]?.value).toBe(
        'Failed at https://labkeeper.io/project/default?captcha=[Filtered]'
    );
    expect(event.breadcrumbs).toEqual(
        expect.arrayContaining([
            expect.objectContaining({
                category: 'console',
                message:
                    '[startup] open https://labkeeper.io/project/default?captcha=[Filtered]&type=latex',
            }),
            expect.objectContaining({
                category: 'navigation',
                data: {
                    from: '/project/default?captcha=[Filtered]&type=latex',
                    to: '/projects',
                },
            }),
            expect.objectContaining({
                category: 'navigation',
                data: {
                    from: '/projects',
                    to: '/project/default?captcha=[Filtered]',
                },
            }),
        ])
    );
    expect(event.tags).toEqual({ automation: 'webdriver', e2e: '1' });
    expect(tracked).toHaveLength(1);
    expect(JSON.stringify(tracked[0])).not.toContain(TOKEN);
    expect(bodies.join('\n')).not.toContain(TOKEN);
    // ошибку самого beforeSend SDK шлёт мимо него, и тогда крошки берутся из скоупа как есть
    expect(
        JSON.stringify(Sentry.getIsolationScope().getScopeData().breadcrumbs)
    ).not.toContain(TOKEN);

    await Sentry.close();
});
