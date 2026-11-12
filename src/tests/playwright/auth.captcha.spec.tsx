import { expect, test, type Page } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

/**
 * GH-253: SmartCaptcha не загрузилась или её токен устарел. Скрипт капчи
 * подменяется: либо загрузка обрывается, как у блокировщика рекламы, либо
 * отдаётся виджет, события которого опыт шлёт сам
 */

const CAPTCHA_SCRIPT = 'https://smartcaptcha.cloud.yandex.ru/captcha.js*';
const OPENPANEL_API = 'http://localhost:3000/gh253-openpanel';

/** Тот же интерфейс window.smartCaptcha, что у настоящего скрипта, события шлёт опыт */
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
            container.innerHTML = '<div class="fake-captcha">captcha ' + nextId + '</div>';
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

type Tracked = { name: string; properties: Record<string, unknown> };

/** Страница отдаётся с ключами OpenPanel, а сам OpenPanel подменён */
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

async function openRegistration(page: Page) {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.setupGetDefaultProjectRequest();
    await page.goto('/project/default');
    await page.locator('.labkeeper_header .login-button').click();
    const modal = page.locator('.auth-modal');
    await modal
        .getByRole('button', { name: 'Registration', exact: true })
        .click();
    await modal
        .getByPlaceholder('Email', { exact: true })
        .fill('new@example.com');
    await modal.getByRole('checkbox').check();
    return modal;
}

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

test('a-blocked-captcha-script-explains-itself-and-is-counted', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    await page.route(CAPTCHA_SCRIPT, (route) => route.abort());

    const modal = await openRegistration(page);

    await expect(
        modal.getByText(
            'The captcha did not load. Turn off your ad blocker or VPN and try again'
        )
    ).toBeVisible();
    // без скрипта новый виджет его не запросит: помогает только перезагрузка
    await expect(
        modal.getByRole('button', { name: 'Reload the page' })
    ).toBeVisible();
    await expect(
        modal.getByRole('button', { name: 'Send code', exact: true })
    ).toBeDisabled();
    await expect
        .poll(() => named('Captcha failed'))
        .toEqual([
            expect.objectContaining({ reason: 'script', form: 'email' }),
        ]);
});

test('an-expired-captcha-token-disables-the-form-until-it-is-passed-again', async ({
    page,
}) => {
    await page.route(CAPTCHA_SCRIPT, (route) =>
        route.fulfill({ contentType: 'text/javascript', body: FAKE_CAPTCHA })
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
        route.fulfill({ contentType: 'text/javascript', body: FAKE_CAPTCHA })
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
    const renders = () =>
        page.evaluate(
            () =>
                (window as unknown as { __captcha: { renders: number } })
                    .__captcha.renders
        );
    const rendersBefore = await renders();

    await modal.getByRole('button', { name: 'Reload the captcha' }).click();

    await expect.poll(renders).toBe(rendersBefore + 1);
    await expect(
        modal.getByText(
            'The captcha did not load. Turn off your ad blocker or VPN and try again'
        )
    ).toHaveCount(0);
});

test('a-captcha-script-that-never-answers-is-reported-after-the-timeout', async ({
    page,
}) => {
    const named = await trackOpenPanel(page);
    await page.clock.install();
    // сеть молчит: ни ответа, ни ошибки
    await page.route(CAPTCHA_SCRIPT, () => {});
    const modal = await openRegistration(page);
    await expect(
        modal.getByRole('button', { name: 'Reload the page' })
    ).toHaveCount(0);

    await page.clock.fastForward(15_000);

    await expect(
        modal.getByRole('button', { name: 'Reload the page' })
    ).toBeVisible();
    await expect
        .poll(() => named('Captcha failed'))
        .toEqual([
            expect.objectContaining({ reason: 'timeout', form: 'email' }),
        ]);
});
