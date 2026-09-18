import { expect, test } from '@playwright/test';
import { RouteSetup } from './mock.routeSetUp.tsx';

test('registration-with-captcha-bypass-sends-the-code-without-the-widget', async ({
    page,
}) => {
    const routeSetup = new RouteSetup(page);
    await routeSetup.setupGetUserInfoRequest(false);
    await routeSetup.setupGetDefaultProjectRequest();
    const emailRequests: URL[] = [];
    await page.route('**/api/v4/public/email**', async (route) => {
        emailRequests.push(new URL(route.request().url()));
        await route.fulfill({ status: 200 });
    });

    await page.goto('/project/default?captcha=bypass-token');
    await page.locator('.labkeeper_header .login-button').click();
    const modal = page.locator('.auth-modal');
    await modal
        .getByRole('button', { name: 'Registration', exact: true })
        .click();
    await modal
        .getByPlaceholder('Email', { exact: true })
        .fill('new@example.com');
    await modal.getByRole('checkbox').check();

    // E2E на проде регистрирует пользователя с токеном обхода, а виджет в автотесте не пройти
    const sendCode = modal.getByRole('button', {
        name: 'Send code',
        exact: true,
    });
    await expect(sendCode).toBeEnabled();
    await sendCode.click();

    await expect(modal.locator('.auth-header')).toHaveText('Enter the code');
    expect(emailRequests).toHaveLength(1);
    expect(emailRequests[0].searchParams.get('captcha')).toBe('bypass-token');
});
