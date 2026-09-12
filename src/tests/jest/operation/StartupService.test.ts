import {
    matchRepositorySnapshot,
    mockAuthenticatedStartup,
    mockContext,
    mockS3LabsFileForDefaultLab,
    mockUserInfoForUnauthorized,
    mockUserInfoWithDefaultUser,
    PROJECT_ID,
} from '../common.ts';
import { Routes } from '../../../viewModel/routes.ts';

/*
Сценарий:
1. Заходим на сайт с авторизацией
 */
test('onAppStartup-qr-test', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockS3LabsFileForDefaultLab(rpi);
    mockUserInfoForUnauthorized(rpi);
    repository.setLocation('/qr/v1');
    await startupService.onAppStartup();

    matchRepositorySnapshot(repository);
});

test('pay-page-restores-latest-pending-purchase', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoWithDefaultUser(rpi);
    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: { projects: [] },
    });
    rpi.listBillingPurchasesRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            purchases: [
                {
                    id: 'purchase-1',
                    tokenPriceId: 'price-1',
                    yookassa: { widgetToken: 'widget-token-1' },
                    status: 'pending',
                    createdAt: '2026-08-10T12:00:00Z',
                    updatedAt: '2026-08-10T12:00:00Z',
                },
            ],
        },
    });
    repository.setLocation(Routes.Pay);

    await startupService.onAppStartup();

    expect(rpi.listBillingPurchasesRequest).toHaveBeenCalledWith({
        page: 0,
        size: 1,
        status: 'pending',
    });
    expect(repository.billingViewModelRepository.paymentWidgetToken()).toBe(
        'widget-token-1'
    );
    expect(repository.location()).toBe(Routes.Pay);
});

test('pay-page-redirects-to-tokens-when-no-pending-purchases', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoWithDefaultUser(rpi);
    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: { projects: [] },
    });
    rpi.listBillingPurchasesRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: { purchases: [] },
    });
    repository.setLocation(Routes.Pay);

    await startupService.onAppStartup();

    expect(rpi.listBillingPurchasesRequest).toHaveBeenCalled();
    expect(
        repository.billingViewModelRepository.paymentWidgetToken()
    ).toBeUndefined();
    expect(repository.location()).toBe(Routes.Tokens);
});

test('pay-page-redirects-to-tokens-when-unauthenticated', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoForUnauthorized(rpi);
    rpi.listBillingPurchasesRequest = jest.fn();
    repository.setLocation(Routes.Pay);

    await startupService.onAppStartup();

    expect(rpi.listBillingPurchasesRequest).not.toHaveBeenCalled();
    expect(repository.location()).toBe(Routes.Tokens);
});

test('project-default-open-latex-replaces-history-entry', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoForUnauthorized(rpi);
    repository.projectViewModelRepository.setProjectType('markdown');
    repository.setLocation(Routes.ProjectDefault);
    const setLocation = jest.spyOn(repository, 'setLocation');

    await startupService.onAppStartup(undefined, 'latex');

    expect(repository.projectViewModelRepository.mode()).toBe('latex');
    expect(repository.location()).toBe(Routes.ProjectDefault);
    expect(setLocation).toHaveBeenCalledWith(Routes.ProjectDefault, {
        replace: true,
    });
});

test('home-open-latex-replaces-history-entry', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoForUnauthorized(rpi);
    repository.setLocation(Routes.Home);
    const setLocation = jest.spyOn(repository, 'setLocation');

    await startupService.onAppStartup(undefined, 'latex');

    expect(setLocation).toHaveBeenCalledWith(Routes.ProjectDefault, {
        replace: true,
    });
});

test('qr-redirect-to-project-default-keeps-history-entry', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockS3LabsFileForDefaultLab(rpi);
    mockUserInfoForUnauthorized(rpi);
    repository.setLocation('/qr/v1');
    const setLocation = jest.spyOn(repository, 'setLocation');

    await startupService.onAppStartup();

    expect(setLocation).toHaveBeenCalledWith(Routes.ProjectDefault, {
        replace: false,
    });
});

test('authenticated-project-default-replaces-with-project-id', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockAuthenticatedStartup(rpi);
    repository.setLocation(Routes.ProjectDefault);
    const setLocation = jest.spyOn(repository, 'setLocation');

    await startupService.onAppStartup();

    expect(setLocation).toHaveBeenCalledWith(
        Routes.Project.replace(':id', PROJECT_ID),
        { replace: true }
    );
});

/**
 * Согласие на трансграничную передачу, данное до входа, лежит только в браузере.
 * После входа оно должно уехать на сервер само, иначе плашка выскочит второй раз
 */

const okEmpty = {
    code: 200,
    body: undefined,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
};

function startupWithConsent(serverAccepted: boolean) {
    const ctx = mockContext();
    mockAuthenticatedStartup(ctx.rpi);
    ctx.rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            isAuthenticated: true,
            email: 'a@gmail.com',
            id: 1,
            privacyPolicyAccepted: true,
            crossBorderConsentAccepted: serverAccepted,
            tokenBalance: 0,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    ctx.rpi.acceptCrossBorderConsentRequest = jest
        .fn()
        .mockResolvedValue(okEmpty);
    ctx.repository.setLocation(`/project/${PROJECT_ID}`);
    return ctx;
}

test('consent-given-before-login-is-sent-after-login', async () => {
    const ctx = startupWithConsent(false);
    ctx.repository.persistenceViewModelRepository.setCrossBorderConsentAcceptedLocally(
        true
    );

    await ctx.startupService.onAppStartup();

    expect(ctx.rpi.acceptCrossBorderConsentRequest).toHaveBeenCalledTimes(1);
});

test('consent-already-on-the-server-is-not-sent-again', async () => {
    const ctx = startupWithConsent(true);
    ctx.repository.persistenceViewModelRepository.setCrossBorderConsentAcceptedLocally(
        true
    );

    await ctx.startupService.onAppStartup();

    expect(ctx.rpi.acceptCrossBorderConsentRequest).not.toHaveBeenCalled();
});

test('consent-is-not-invented-for-a-user-who-never-gave-it', async () => {
    const ctx = startupWithConsent(false);

    await ctx.startupService.onAppStartup();

    expect(ctx.rpi.acceptCrossBorderConsentRequest).not.toHaveBeenCalled();
});
