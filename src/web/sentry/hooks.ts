import * as Sentry from '@sentry/react';
import type { Breadcrumb, BrowserOptions, ErrorEvent } from '@sentry/react';
import type { RootOptions } from 'react-dom/client';
import { isAnalyticsDisabled } from '../analyticsFlag.ts';
import { scrubCaptcha, scrubCaptchaDeep } from './scrubCaptcha.ts';

function scrubString(value: unknown): unknown {
    return typeof value === 'string' ? scrubCaptcha(value) : value;
}

/** beforeBreadcrumb: убирает токен капчи из адресов навигации, запросов и строк консоли. */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
    const { message, data } = breadcrumb;
    return {
        ...breadcrumb,
        ...(typeof message === 'string' && { message: scrubCaptcha(message) }),
        // в data ещё живые объекты приложения, их не копируем и не меняем: глубокий проход делает beforeSend
        ...(data && {
            data: Object.fromEntries(
                Object.entries(data).map(([key, value]) => [
                    key,
                    Array.isArray(value)
                        ? value.map(scrubString)
                        : scrubString(value),
                ])
            ),
        }),
    };
}

/** beforeSend: одно и то же вычищенное событие уходит и в Sentry, и в onEvent. */
export function createBeforeSend(onEvent: (event: ErrorEvent) => void) {
    return (event: ErrorEvent): ErrorEvent | null => {
        if (window?.location?.host?.includes('localhost')) {
            console.log('Error event is dropped due to dev hostname');
            return null;
        }
        const scrubbed = scrubCaptchaDeep(event);
        onEvent(scrubbed);
        return scrubbed;
    };
}

/** Теги автоматических прогонов: события не выбрасываем, а даём отфильтровать их в Bugsink. */
export function automationTags(): Record<string, string> {
    return {
        automation: navigator.webdriver ? 'webdriver' : 'none',
        ...(isAnalyticsDisabled() && { e2e: '1' }),
    };
}

/** Опции Sentry.init без dsn: main.tsx и опыт с настоящим SDK берут одну и ту же проводку. */
export function sentryOptions(
    onEvent: (event: ErrorEvent) => void
): BrowserOptions {
    return {
        maxBreadcrumbs: 100,
        initialScope: { tags: automationTags() },
        // e2e открывает приложение с токеном обхода капчи в адресе, а адрес SDK кладёт и в событие, и в крошки
        beforeBreadcrumb: scrubBreadcrumb,
        beforeSend: createBeforeSend(onEvent),
    };
}

/**
 * Обработчики ошибок корня React. Ошибку, которую поймала граница (в том числе
 * errorElement роутера), React отдаёт сюда вместе со стеком компонентов, и
 * Sentry кладёт его в событие. Без этого в Bugsink уходит только
 * минифицированный стек, по которому не понять, какой компонент зациклился,
 * как вышло с React #185 в GH-134
 *
 * Граница роутера ловит ту же ошибку и тоже отправляет её, но повторный захват
 * того же объекта Sentry отбрасывает, поэтому событие одно
 */
export function reactRootErrorOptions(): RootOptions {
    // React по умолчанию пишет пойманную ошибку в консоль, без этого её не видно при разработке
    const logToConsole = (error: unknown) => console.error(error);
    return {
        onCaughtError: Sentry.reactErrorHandler(logToConsole),
        onUncaughtError: Sentry.reactErrorHandler(logToConsole),
        onRecoverableError: Sentry.reactErrorHandler(),
    };
}
