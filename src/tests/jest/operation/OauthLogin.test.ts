import { mockContext } from '../common.ts';
import { Events } from '../../../model/service/ObserverService.ts';
import { OAUTH_NO_EMAIL_ERROR } from '../../../viewModel/operation/StartupService.ts';

const failedOauth = (body: unknown) => ({
    code: 401,
    body,
    isOk: false,
    isUnauth: true,
    isForbidden: false,
});

test('oauth-login-without-email-shows-no-email-error', async () => {
    const { repository, rpi, startupService, observerService } = mockContext();
    const onEvent = jest.spyOn(observerService, 'onEvent');
    rpi.oauthCodeRequest = jest
        .fn()
        .mockResolvedValue(failedOauth({ error: OAUTH_NO_EMAIL_ERROR }));
    startupService.onAppStartup = jest.fn().mockResolvedValue(undefined);

    await startupService.onAppEnterWithOauthCode('code', 'state');

    expect(repository.authViewModelRepository.currentView()).toBe('login');
    expect(repository.authViewModelRepository.loginRequest()).toBe(
        'oauth_no_email'
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_LOGIN_FAILED,
        expect.objectContaining({ method: 'oauth', reason: 'oauth_no_email' })
    );
    expect(startupService.onAppStartup).toHaveBeenCalled();
});

test('oauth-login-other-failure-shows-generic-error', async () => {
    const { repository, rpi, startupService } = mockContext();
    rpi.oauthCodeRequest = jest
        .fn()
        .mockResolvedValue(failedOauth({ error: 'invalid_token' }));
    startupService.onAppStartup = jest.fn().mockResolvedValue(undefined);

    await startupService.onAppEnterWithOauthCode('code', 'state');

    expect(repository.authViewModelRepository.loginRequest()).toBe(
        'oauth_error'
    );
});

test('oauth-login-failure-without-body-shows-generic-error', async () => {
    const { repository, rpi, startupService } = mockContext();
    rpi.oauthCodeRequest = jest.fn().mockResolvedValue(failedOauth(''));
    startupService.onAppStartup = jest.fn().mockResolvedValue(undefined);

    await startupService.onAppEnterWithOauthCode('code', 'state');

    expect(repository.authViewModelRepository.loginRequest()).toBe(
        'oauth_error'
    );
});
