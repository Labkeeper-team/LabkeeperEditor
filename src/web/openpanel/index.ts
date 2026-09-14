import { OpenPanel } from '@openpanel/web';
import { Secrets } from '../../constants.ts';
import {
    ObserverService,
    States,
    mockObserver,
} from '../../model/service/ObserverService.ts';
import { logBreadcrumb } from '../../viewModel/utils/logBreadcrumb.ts';
import { setSessionId } from '../session.ts';

function configuredSecret(value: string | undefined): string {
    if (!value || value.startsWith('IO_LABKEEPER_FRONTEND_')) {
        return '';
    }
    return value.trim();
}

export function createOpenPanelService(): ObserverService {
    const clientId = configuredSecret(Secrets.openpanelClientId);
    const apiUrl = configuredSecret(Secrets.openpanelApiUrl);
    if (!clientId || !apiUrl) {
        return mockObserver();
    }
    return new OpenPanelService(clientId, apiUrl);
}

export async function startOpenPanelSession(observer: ObserverService) {
    if (observer instanceof OpenPanelService) {
        await observer.startSession();
    }
}

class OpenPanelService implements ObserverService {
    private readonly op: OpenPanel;

    constructor(clientId: string, apiUrl: string) {
        this.op = new OpenPanel({
            clientId,
            apiUrl,
            trackScreenViews: false,
            trackOutgoingLinks: true,
        });
    }

    async startSession() {
        try {
            const result = await this.op.track('screen_view', {
                __path: window.location.pathname,
                __title: document.title,
            });
            this.publishSession(result);
        } catch (error) {
            logBreadcrumb('openpanel', 'session start failed', { error });
        }
    }

    onEvent(event: string) {
        void Promise.resolve(this.op.track(event))
            .then((result) => this.publishSession(result))
            .catch((error) => {
                logBreadcrumb('openpanel', 'track failed', { event, error });
            });
    }

    setUserState(name: string, value: string) {
        if (name === States.USER_ID) {
            void Promise.resolve(this.op.identify({ profileId: value }))
                .then((result) => this.publishSession(result))
                .catch((error) => {
                    logBreadcrumb('openpanel', 'identify failed', { error });
                });
            return;
        }
        if (!this.op.profileId) {
            return;
        }
        void Promise.resolve(
            this.op.identify({
                profileId: this.op.profileId,
                properties: { [name]: value },
            })
        ).catch((error) => {
            logBreadcrumb('openpanel', 'identify failed', { name, error });
        });
    }

    private publishSession(result?: { sessionId?: string } | void | null) {
        if (result && result.sessionId) {
            setSessionId(result.sessionId);
        }
    }
}
