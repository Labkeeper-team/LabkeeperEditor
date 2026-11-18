import { expect, test, type Locator, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-253: SmartCaptcha did not load or its token expired. The captcha script
 * is replaced: either the request fails, as with an ad blocker, or hangs, as
 * on a broken network, or a fake widget is served whose events the test
 * raises itself
 */

const CAPTCHA_SCRIPT = 'https://smartcaptcha.cloud.yandex.ru/captcha.js*';
const OPENPANEL_API = 'http://localhost:3000/gh253-openpanel';

const LOADING = 'Loading the captcha…';
const LOAD_FAILED =
    'The captcha did not load. Turn off your ad blocker or VPN and try again';
const RELOAD_CAPTCHA = 'Reload the captcha';

/** Timings of authCaptcha.tsx and captchaWidget.tsx */
const ATTEMPT_TIMEOUT_MS = 5_000;
const FIRST_RETRY_DELAY_MS = 1_000;
const LOAD_TIMEOUT_MS = 15_000;
const RENDER_TIMEOUT_MS = 10_000;
/** A blocked script is given up after three requests, 1 s and 3 s apart */
const BLOCKED_SCRIPT_GIVES_UP_IN_MS = 10_000;

/**
 * The same window.smartCaptcha interface as the real script; the test raises
 * the events. Like the real checkbox, the widget draws an iframe, unless the
 * test sets window.__captchaDraws to false
 */
const FAKE_CAPTCHA = `(function () {
    var handlers = {};
    var nextId = 0;
    window.__captcha = {
        renders: 0,
        emit: function (event, data) {
            (handlers[event] || []).forEach(function (fn) { fn(data); });
        },
    };
    window.smartCaptcha = {
        render: function (container) {
            window.__captcha.renders += 1;
            nextId += 1;
            container.innerHTML = window.__captchaDraws === false
                ? ''
                : '<div class="fake-captcha">captcha ' + nextId +
                  '<iframe title="SmartCaptcha" style="width:60px;height:20px;border:0"></iframe></div>';
            return nextId;
        },
        subscribe: function (id, event, fn) {
            handlers[event] = (handlers[event] || []).concat([fn]);
            return function () {
                handlers[event] = handlers[event].filter(function (f) { return f !== fn; });
            };
        },
        destroy: function () {},
        reset: function () {},
        execute: function () {},
        showError: function () {},
        setTheme: function () {},
        getResponse: function () { return ''; },
    };
    if (window.__onSmartCaptchaReady) { window.__onSmartCaptchaReady(); }
})();`;

const serveFakeCaptcha = { contentType: 'text/javascript', body: FAKE_CAPTCHA };

type Tracked = { name: string; properties: Record<string, unknown> };

/** The page is served with OpenPanel keys, and OpenPanel itself is replaced */
async function trackOpenPanel(page: Page) {
    const tracked: Tracked[] = [];
    await page.route('**/project/default**', async (route) => {
        if (route.request().resourceType() !== 'document') {
            await route.fallback();
            return;
        }
        const response = await route.fetch();
        const html = (await response.text())
            .replace('IO_LABKEEPER_FRONTEND_OPENPANEL_CLIENT_ID', 'gh253')
            .replace('IO_LABKEEPER_FRONTEND_OPENPANEL_API_URL', OPENPANEL_API);
        await route.fulfill({ response, body: html });
    });
    await page.route(`${OPENPANEL_API}/**`, async (route) => {
        const body = route.request().postDataJSON() as {
            type?: string;
            payload?: { name?: string; properties?: Record<string, unknown> };
        } | null;
        if (body?.type === 'track' && body.payload?.name) {
            tracked.push({
                name: body.payload.name,
                properties: body.payload.properties ?? {},
            });
        }
        await route.fulfill({ json: {} });
    });
    return (name: string) =>
        tracked
            .filter((event) => event.name === `[E] ${name}`)
            .map((event) => event.properties);
}

/** The auth modal on its login form, which shows the captcha right away */
async function openLogin(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.setupGetDefaultProjectRequest();
    await page.goto('/project/default');
    // the retry must happen in place: a reload would wipe this mark
    await page.evaluate(() => {
        (window as unknown as { __samePage: boolean }).__samePage = true;
    });
    await page.locator('.labkeeper_header .login-button').click();
    return page.locator('.auth-modal');
}

async function goToRegistration(modal: Locator) {
    await modal
        .getByRole('button', { name: 'Registration', exact: true })
        .click();
    await modal
        .getByPlaceholder('Email', { exact: true })
        .fill('new@example.com');
    await modal.getByRole('checkbox').check();
}

async function openRegistration(page: Page) {
    const modal = await openLogin(page);
    await goToRegistration(modal);
    return modal;
}

const samePage = (page: Page) =>
    page.evaluate(
        () => (window as unknown as { __samePage?: boolean }).__samePage
    );

const emit = (page: Page, event: string, data?: string) =>
    page.evaluate(
        ([name, value]) =>
            (
                window as unknown as {
                    __captcha: { emit: (e: string, d?: string) => void };
                }
            ).__captcha.emit(name, value),
        [event, data] as const
    );

/** How many widgets the fake script has drawn; 0 until it has run */
const renders = (page: Page) =>
    page.evaluate(
        () =>
            (window as unknown as { __captcha?: { renders: number } }).__captcha
                ?.renders ?? 0
    );

test('a-blocked-captcha-script-explains-itself-and-is-counted', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    const requests: string[] = [];
    await page.route(CAPTCHA_SCRIPT, (route) => {
        requests.push(route.request().url());
        return route.abort();
    });

    const modal = await openLogin(page);

    await expect(modal.getByText(LOADING)).toBeVisible();
    await expect(modal.getByText(LOAD_FAILED)).toBeVisible({
        timeout: BLOCKED_SCRIPT_GIVES_UP_IN_MS,
    });
    // three requests, each later one with its own URL, before giving up
    expect(requests).toHaveLength(3);
    expect(new Set(requests).size).toBe(3);
    expect(requests[1]).toContain('&_=');
    await expect(
        modal.getByRole('button', { name: RELOAD_CAPTCHA })
    ).toBeVisible();
    await expect(
        modal.getByRole('button', { name: 'Login', exact: true })
    ).toBeDisabled();

    // the registration form learns about the failure at once, without new requests
    await goToRegistration(modal);
    await expect(modal.getByText(LOAD_FAILED)).toBeVisible();
    await expect(
        modal.getByRole('button', { name: 'Send code', exact: true })
    ).toBeDisabled();
    expect(requests).toHaveLength(3);
    await expect
        .poll(() => named('Captcha failed'))
        .toEqual([
            expect.objectContaining({ reason: 'script', form: 'login' }),
            expect.objectContaining({ reason: 'script', form: 'email' }),
        ]);
});

test('a-captcha-request-that-fails-once-is-made-again-without-a-page-reload', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    const requests: string[] = [];
    await page.route(CAPTCHA_SCRIPT, (route) => {
        requests.push(route.request().url());
        return requests.length === 1
            ? route.abort()
            : route.fulfill(serveFakeCaptcha);
    });

    const modal = await openRegistration(page);

    await expect(modal.locator('.fake-captcha')).toBeVisible();
    expect(requests).toHaveLength(2);
    expect(requests[1]).toContain('&_=');
    await expect(modal.getByText(LOAD_FAILED)).toHaveCount(0);
    expect(await samePage(page)).toBe(true);
    expect(named('Captcha failed')).toEqual([]);
});

test('a-hanging-captcha-request-is-abandoned-and-made-again', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    await page.clock.install();
    let requests = 0;
    await page.route(CAPTCHA_SCRIPT, (route) => {
        requests += 1;
        // the first request never gets an answer, as on a stuck connection
        return requests === 1 ? undefined : route.fulfill(serveFakeCaptcha);
    });
    const modal = await openRegistration(page);
    await expect(modal.getByText(LOADING)).toBeVisible();

    await page.clock.runFor(ATTEMPT_TIMEOUT_MS);
    await page.clock.runFor(FIRST_RETRY_DELAY_MS);

    await expect(modal.locator('.fake-captcha')).toBeVisible();
    expect(requests).toBe(2);
    // the tag of the hung request is gone, the page keeps only the one that worked
    await expect(page.locator('script[src*="captcha.js"]')).toHaveCount(1);
    expect(named('Captcha failed')).toEqual([]);
});

test('reopening-the-auth-modal-does-not-restart-the-captcha-timeout', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    await page.clock.install();
    // the network is silent: no answer and no error
    await page.route(CAPTCHA_SCRIPT, () => {});
    const modal = await openLogin(page);
    await expect(modal.getByText(LOADING)).toBeVisible();
    await page.clock.runFor(LOAD_TIMEOUT_MS - 5_000);

    // the modal unmounts its forms when closed, and the new login form starts afresh
    await page
        .locator('.modal-container-overlay .close-button-container')
        .click();
    await expect(modal).toHaveCount(0);
    await page.locator('.labkeeper_header .login-button').click();
    await expect(modal.getByText(LOADING)).toBeVisible();
    await page.clock.runFor(5_000);

    // 15 s after the first form asked for the script, not after the second
    await expect(modal.getByText(LOAD_FAILED)).toBeVisible();
    await expect(
        modal.getByRole('button', { name: RELOAD_CAPTCHA })
    ).toBeVisible();
    await expect
        .poll(() => named('Captcha failed'))
        .toEqual([
            expect.objectContaining({ reason: 'timeout', form: 'login' }),
        ]);
});

test('the-reload-button-brings-the-captcha-back-without-a-page-reload', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    let blocked = true;
    await page.route(CAPTCHA_SCRIPT, (route) =>
        blocked ? route.abort() : route.fulfill(serveFakeCaptcha)
    );
    const modal = await openRegistration(page);
    await expect(modal.getByText(LOAD_FAILED)).toBeVisible({
        timeout: BLOCKED_SCRIPT_GIVES_UP_IN_MS,
    });

    // for example the person turned the ad blocker off
    blocked = false;
    await modal.getByRole('button', { name: RELOAD_CAPTCHA }).click();

    await expect(modal.locator('.fake-captcha')).toBeVisible();
    await expect(modal.getByText(LOAD_FAILED)).toHaveCount(0);
    expect(await samePage(page)).toBe(true);
    await emit(page, 'success', 'token-1');
    await expect(
        modal.getByRole('button', { name: 'Send code', exact: true })
    ).toBeEnabled();
    await expect
        .poll(() => named('Captcha failed'))
        .toEqual([
            expect.objectContaining({ reason: 'script', form: 'email' }),
        ]);
});

test('a-captcha-widget-that-never-draws-offers-to-reload-it', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    await page.clock.install();
    await page.addInitScript(() => {
        (window as unknown as { __captchaDraws: boolean }).__captchaDraws =
            false;
    });
    await page.route(CAPTCHA_SCRIPT, (route) =>
        route.fulfill(serveFakeCaptcha)
    );
    const modal = await openRegistration(page);
    // the script is there, but the widget has drawn nothing yet
    await expect.poll(() => renders(page)).toBeGreaterThan(0);
    await expect(modal.getByText(LOADING)).toBeVisible();

    await page.clock.runFor(RENDER_TIMEOUT_MS);

    await expect(modal.getByText(LOAD_FAILED)).toBeVisible();
    await expect
        .poll(() => named('Captcha failed'))
        .toEqual([
            expect.objectContaining({ reason: 'render', form: 'email' }),
        ]);

    await page.evaluate(() => {
        (window as unknown as { __captchaDraws: boolean }).__captchaDraws =
            true;
    });
    await modal.getByRole('button', { name: RELOAD_CAPTCHA }).click();

    await expect(modal.locator('.fake-captcha')).toBeVisible();
    await expect(modal.getByText(LOAD_FAILED)).toHaveCount(0);
    await expect(modal.getByText(LOADING)).toHaveCount(0);
});

test('an-expired-captcha-token-disables-the-form-until-it-is-passed-again', async ({
    page,
}) => {
    await page.route(CAPTCHA_SCRIPT, (route) =>
        route.fulfill(serveFakeCaptcha)
    );
    const modal = await openRegistration(page);
    const sendCode = modal.getByRole('button', {
        name: 'Send code',
        exact: true,
    });
    await expect(modal.locator('.fake-captcha')).toBeVisible();

    await emit(page, 'success', 'token-1');
    await expect(sendCode).toBeEnabled();

    await emit(page, 'token-expired');
    await expect(sendCode).toBeDisabled();
    await expect(
        modal.getByText('The captcha check has expired, please pass it again')
    ).toBeVisible();

    await emit(page, 'success', 'token-2');
    await expect(sendCode).toBeEnabled();
    await expect(
        modal.getByText('The captcha check has expired, please pass it again')
    ).toHaveCount(0);
});

test('a-captcha-network-error-offers-to-reload-the-widget', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    await page.route(CAPTCHA_SCRIPT, (route) =>
        route.fulfill(serveFakeCaptcha)
    );
    const modal = await openRegistration(page);
    await expect(modal.locator('.fake-captcha')).toBeVisible();
    await emit(page, 'success', 'token-1');

    await emit(page, 'network-error');

    await expect(
        modal.getByRole('button', { name: 'Send code', exact: true })
    ).toBeDisabled();
    await expect
        .poll(() => named('Captcha failed'))
        .toEqual([
            expect.objectContaining({ reason: 'network', form: 'email' }),
        ]);
    const rendersBefore = await renders(page);

    await modal.getByRole('button', { name: RELOAD_CAPTCHA }).click();

    // a new widget is drawn (twice in development: StrictMode mounts it twice)
    await expect.poll(() => renders(page)).toBeGreaterThan(rendersBefore);
    await expect(modal.getByText(LOAD_FAILED)).toHaveCount(0);
});

test('a-captcha-script-that-never-answers-is-reported-after-the-timeout', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    await page.clock.install();
    // the network is silent: no answer and no error
    await page.route(CAPTCHA_SCRIPT, () => {});
    const modal = await openRegistration(page);
    // progress instead of an empty box while the script is on its way
    await expect(modal.getByText(LOADING)).toBeVisible();
    await expect(
        modal.getByRole('button', { name: RELOAD_CAPTCHA })
    ).toHaveCount(0);

    await page.clock.fastForward(LOAD_TIMEOUT_MS);

    await expect(
        modal.getByRole('button', { name: RELOAD_CAPTCHA })
    ).toBeVisible();
    await expect(modal.getByText(LOADING)).toHaveCount(0);
    await expect
        .poll(() => named('Captcha failed'))
        .toEqual([
            expect.objectContaining({ reason: 'timeout', form: 'email' }),
        ]);
});
