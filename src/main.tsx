import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

import App from './view/App.tsx';
import { createViewModelStateFromStore, store } from './view/store';
import { Secrets } from './constants.ts';
import { setupContext } from './viewModel/context.ts';
import { MetrikaService } from './web/yandex';
import { WebRpi } from './web/server';

export const { controller } = setupContext(
    new WebRpi(),
    createViewModelStateFromStore(store),
    new MetrikaService()
);

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
