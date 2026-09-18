import { mockContext } from '../common.ts';
import { Events } from '../../../model/service/ObserverService.ts';

test('form-login-closes-auth-modal-before-startup-completes', async () => {
    const { authService, repository, rpi, startupService, observerService } =
        mockContext();
    const onEvent = jest.spyOn(observerService, 'onEvent');
    let resolveStartup: (() => void) | undefined;

    repository.authViewModelRepository.setCurrentView('login');
    rpi.formLoginRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {},
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    startupService.onAppStartup = jest.fn(
        () =>
            new Promise<void>((resolve) => {
                resolveStartup = resolve;
            })
    );

    const loginPromise = authService.onFormLoginClicked(
        'a@gmail.com',
        'password',
        'captcha-token'
    );

    expect(repository.authViewModelRepository.loginRequest()).toBe('loading');

    await Promise.resolve();

    expect(startupService.onAppStartup).toHaveBeenCalled();
    expect(repository.authViewModelRepository.currentView()).toBe('closed');
    expect(repository.authViewModelRepository.loginRequest()).toBe('ok');

    resolveStartup?.();
    await loginPromise;

    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_LOGIN_SUBMITTED,
        expect.objectContaining({ method: 'password' })
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_LOGIN_SUCCEEDED,
        expect.objectContaining({ method: 'password' })
    );
});

test('form-login-failed-tracks-bad-credentials', async () => {
    const { authService, observerService, rpi } = mockContext();
    const onEvent = jest.spyOn(observerService, 'onEvent');
    rpi.formLoginRequest = jest.fn().mockResolvedValue({
        code: 401,
        body: {},
        isOk: false,
        isUnauth: true,
        isForbidden: false,
    });

    await authService.onFormLoginClicked(
        'a@gmail.com',
        'wrong',
        'captcha-token'
    );

    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_LOGIN_SUBMITTED,
        expect.objectContaining({ method: 'password' })
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_LOGIN_FAILED,
        expect.objectContaining({
            method: 'password',
            reason: 'bad_credentials',
        })
    );
});
