import * as Sentry from '@sentry/react';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';

export function reportToSentry(context: string, cause?: unknown): void {
    Sentry.captureException(
        cause instanceof Error ? cause : new Error(context),
        {
            fingerprint: ['unexpected-error', context],
            tags: {
                'error.context': context,
            },
            extra: {
                context,
                cause,
            },
        }
    );
}

/** Неожиданная ошибка вне HTTP-обёртки RPI: и Метрика, и Sentry. */
export function reportUnexpectedError(
    observer: ObserverService,
    context: string,
    cause?: unknown
): void {
    observer.onEvent(Events.EVENT_RPI_UNKNOWN);
    reportToSentry(context, cause);
}
