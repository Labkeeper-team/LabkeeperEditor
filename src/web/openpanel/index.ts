import { OpenPanel } from '@openpanel/web';
import {
    ObserverService,
    States,
    mockObserver,
} from '../../model/service/ObserverService.ts';
import { getOpenPanelClientId, getOpenPanelUrl } from './session.ts';

export class OpenPanelService implements ObserverService {
    private readonly op: OpenPanel;

    constructor(clientId: string, apiUrl: string) {
        this.op = new OpenPanel({
            clientId,
            apiUrl,
            trackScreenViews: true,
            trackOutgoingLinks: true,
        });
        this.publishSessionId();
    }

    onEvent(event: string) {
        void Promise.resolve(this.op.track(event)).finally(() =>
            this.publishSessionId()
        );
    }

    setUserState(name: string, value: string) {
        if (name === States.USER_ID) {
            void Promise.resolve(
                this.op.identify({ profileId: value })
            ).finally(() => this.publishSessionId());
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
        );
    }

    private publishSessionId() {
        if (typeof window === 'undefined') {
            return;
        }
        window.__OPENPANEL_SESSION_ID__ = this.op.getSessionId();
    }
}

export function createOpenPanelService(): ObserverService {
    const clientId = getOpenPanelClientId();
    const apiUrl = getOpenPanelUrl();
    if (!clientId || !apiUrl) {
        return mockObserver();
    }
    return new OpenPanelService(clientId, apiUrl);
}
