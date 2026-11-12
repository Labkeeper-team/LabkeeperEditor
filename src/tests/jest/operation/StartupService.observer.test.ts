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
import { Events, States } from '../../../model/service/ObserverService.ts';
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

    expect(observerService.init).toHaveBeenCalledWith('111');
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

// OpenPanel копит события до профиля, и без init они не ушли бы до закрытия вкладки
test('analytics-starts-as-a-guest-when-user-info-did-not-answer', async () => {
    const { startupService, rpi, observerService } = mockContext();
    mockAuthenticatedStartup(rpi);
    rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 0,
        body: undefined,
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });
    observerService.init = jest.fn();

    await startupService.onAppStartup();

    expect(observerService.init).toHaveBeenCalledTimes(1);
    expect(observerService.init).toHaveBeenCalledWith(undefined);
    expect(rpi.getDefaultProjectRequest).not.toHaveBeenCalled();
});

// GH-250: язык уходит в аналитику с начала сессии и при каждой смене
test('analytics-learns-the-language-before-the-session-starts', async () => {
    const { startupService, rpi, repository, observerService } = mockContext();
    mockAuthenticatedStartup(rpi);
    repository.persistenceViewModelRepository.setLanguage('zh');
    const calls: string[] = [];
    observerService.setUserState = jest.fn((name: string, value: string) => {
        calls.push(`${name}=${value}`);
    });
    observerService.init = jest.fn(() => {
        calls.push('init');
    });

    await startupService.onAppStartup();

    expect(calls.indexOf(`${States.STATE_LANGUAGE}=zh`)).toBeGreaterThanOrEqual(
        0
    );
    expect(calls.indexOf(`${States.STATE_LANGUAGE}=zh`)).toBeLessThan(
        calls.indexOf('init')
    );
});

test('a-selected-language-is-tracked-saved-and-carried-by-analytics', () => {
    const { startupService, repository, observerService } = mockContext();
    repository.persistenceViewModelRepository.setLanguage('ru');
    const events: { event: string; properties?: unknown }[] = [];
    observerService.onEvent = (event: string, properties?: unknown) =>
        events.push({ event, properties });
    observerService.setUserState = jest.fn();

    startupService.onLanguageSelected('en');

    expect(repository.persistenceViewModelRepository.language()).toBe('en');
    expect(events).toContainEqual({
        event: Events.EVENT_LANGUAGE_CHANGED,
        properties: expect.objectContaining({ from: 'ru', to: 'en' }),
    });
    expect(observerService.setUserState).toHaveBeenCalledWith(
        States.STATE_LANGUAGE,
        'en'
    );
});

test('selecting-the-current-language-sends-nothing', () => {
    const { startupService, repository, observerService } = mockContext();
    repository.persistenceViewModelRepository.setLanguage('en');
    observerService.onEvent = jest.fn();
    observerService.setUserState = jest.fn();

    startupService.onLanguageSelected('en');

    expect(observerService.onEvent).not.toHaveBeenCalled();
    expect(observerService.setUserState).not.toHaveBeenCalled();
});
