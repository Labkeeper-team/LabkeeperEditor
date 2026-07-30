import { mockContext } from '../common.ts';

test('form-login-closes-auth-modal-before-startup-completes', async () => {
    const { authService, repository, rpi, startupService } = mockContext();
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
});
