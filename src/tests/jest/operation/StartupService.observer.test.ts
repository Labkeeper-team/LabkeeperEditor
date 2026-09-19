/**
 * Аналитика ушла с критического пути открытия проекта.
 * Sentry мокаем целиком: проверяем, что потерянная ошибка init доезжает до отчёта.
 */
jest.mock('@sentry/react', () => ({
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    addBreadcrumb: jest.fn(),
}));

import * as Sentry from '@sentry/react';
import {
    mockAuthenticatedStartup,
    mockContext,
    PROJECT_ID,
} from '../common.ts';

test('startup-does-not-wait-for-analytics', async () => {
    const { startupService, rpi, repository, observerService } = mockContext();
    mockAuthenticatedStartup(rpi);
    let releaseInit: () => void = () => {};
    observerService.init = jest.fn(
        () =>
            new Promise<void>((resolve) => {
                releaseInit = resolve;
            })
    );

    await startupService.onAppStartup();

    expect(observerService.init).toHaveBeenCalledWith('111', 'a@gmail.com');
    expect(rpi.getDefaultProjectRequest).toHaveBeenCalled();
    expect(repository.projectViewModelRepository.project()?.projectId).toBe(
        PROJECT_ID
    );

    releaseInit();
});

test('a-broken-analytics-init-does-not-break-startup', async () => {
    const { startupService, rpi, repository, observerService } = mockContext();
    mockAuthenticatedStartup(rpi);
    observerService.init = jest
        .fn()
        .mockRejectedValue(new Error('openpanel недоступен'));

    await startupService.onAppStartup();

    expect(rpi.getDefaultProjectRequest).toHaveBeenCalled();
    expect(repository.projectViewModelRepository.project()?.projectId).toBe(
        PROJECT_ID
    );
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(
        new Error('openpanel недоступен'),
        expect.objectContaining({
            tags: { 'error.context': 'startup.observerInit' },
        })
    );
});
