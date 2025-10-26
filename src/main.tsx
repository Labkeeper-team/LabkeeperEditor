import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

import App from './view/App.tsx';
import { Secrets } from './constants.ts';

Sentry.init({
    dsn: Secrets.sentryDsn,
    sendDefaultPii: true,
    integrations: [],
    beforeSend(event) {
        if (window?.location?.host?.includes('localhost')) {
            console.log('Error event is dropped due to dev hostname');
            return null;
        }
        return event;
    },
});

createRoot(document.getElementById('root')!, {
    onRecoverableError: Sentry.reactErrorHandler(),
}).render(
    <StrictMode>
        <App />
    </StrictMode>
);
