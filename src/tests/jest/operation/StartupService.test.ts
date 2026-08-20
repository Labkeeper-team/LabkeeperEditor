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
