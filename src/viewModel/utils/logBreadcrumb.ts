import * as Sentry from '@sentry/react';

type BreadcrumbLevel = 'debug' | 'info' | 'warning' | 'error';

/** Пишет след и в консоль, и в Sentry — к моменту ошибки в событии уже виден путь. */
export function logBreadcrumb(
    category: string,
    message: string,
    data?: Record<string, unknown>,
    level: BreadcrumbLevel = 'info'
): void {
    Sentry.addBreadcrumb({
        category,
        message,
        data,
        level,
    });
    if (data) {
        console.info(`[${category}] ${message}`, data);
        return;
    }
    console.info(`[${category}] ${message}`);
}
