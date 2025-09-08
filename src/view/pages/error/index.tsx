import * as Sentry from '@sentry/react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import React from 'react';
import { controller } from '../../../main.tsx';

export const RouterErrorBoundary: React.FC = () => {
    const error = useRouteError();

    React.useEffect(() => {
        // Захватываем ошибку один раз при монтировании страницы ошибки
        if (error) {
            controller.onUndefinedError();
            if (isRouteErrorResponse(error)) {
                Sentry.captureMessage(
                    `Route error response: ${error.status} ${error.statusText}`,
                    {
                        level: 'error',
                        extra: { data: (error as { data: string }).data },
                    }
                );
            } else if (error instanceof Error) {
                Sentry.captureException(error);
            } else {
                Sentry.captureMessage('Unknown route error', {
                    level: 'error',
                    extra: { error },
                });
            }
        }
    }, [error]);

    const title = isRouteErrorResponse(error)
        ? `${error.status} ${error.statusText}`
        : 'Unexpected navigation error';

    return (
        <div style={{ padding: 24, backgroundColor: '#fff', color: '#000' }}>
            <h2>{title}</h2>
            <p>The error was reported to Sentry.</p>
            <button onClick={() => location.assign('/')}>Go to home</button>
        </div>
    );
};
