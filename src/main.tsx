import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

import App from './view/App.tsx';
import { Secrets } from './constants.ts';

import { createViewModelStateFromStore, store } from './view/store';
import { setupContext } from './viewModel/context.ts';
import { MetrikaService } from './web/yandex';
import { OpenPanelService } from './web/openpanel';
import { CompositeObserver } from './model/service/ObserverService.ts';
import { WebRpi } from './web/server';
import { WebAgentSocket } from './web/server/agentSocket.ts';
import { sentryOptions } from './web/sentry/hooks.ts';

const openPanelService = new OpenPanelService();

Sentry.init({
    dsn: Secrets.sentryDsn,
    ...sentryOptions((event) => openPanelService.trackSentryEvent(event)),
});

const observerService = new CompositeObserver([
    new MetrikaService(),
    openPanelService,
]);

export const { controller } = setupContext(
    new WebRpi(observerService),
    createViewModelStateFromStore(store),
    observerService,
    new WebAgentSocket()
);

createRoot(document.getElementById('root')!, {
    onRecoverableError: Sentry.reactErrorHandler(),
}).render(
    <StrictMode>
        <App />
    </StrictMode>
);
