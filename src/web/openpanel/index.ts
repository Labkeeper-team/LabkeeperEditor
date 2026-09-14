import { OpenPanel } from '@openpanel/web';
import { Secrets } from '../../constants.ts';
import { ObserverService } from '../../model/service/ObserverService.ts';
import { logBreadcrumb } from '../../viewModel/utils/logBreadcrumb.ts';
import { createGuestSessionId, setSessionId } from '../session.ts';

const SESSION_TIMEOUT_MS = 2000;

function anonymousDisplayName(): string {
    const suffix = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    return `anonymous${String(suffix).padStart(6, '0')}`;
}

export class OpenPanelService implements ObserverService {
    private op: OpenPanel | undefined;
    private started = false;

    async init(userId?: string, email?: string) {
        if (!this.ensureClient()) {
            return;
        }
        if (!this.started) {
            await this.startSession(userId, email);
            return;
        }
        if (userId) {
            await this.identify(userId, { email });
        }
    }

    onEvent() {}

    setUserState() {}

    private ensureClient(): boolean {
        if (this.op) {
            return true;
        }
        const clientId = configuredSecret(Secrets.openpanelClientId);
        const apiUrl = configuredSecret(Secrets.openpanelApiUrl);
        if (!clientId || !apiUrl) {
            return false;
        }
        this.op = new OpenPanel({
            clientId,
            apiUrl,
            trackScreenViews: false,
            trackOutgoingLinks: false,
        });
        return true;
    }

    private async startSession(userId?: string, email?: string) {
        if (!this.op) {
            return;
        }
        try {
            const profileId = userId ?? createGuestSessionId();
            const result = await withTimeout(
                this.op.track('screen_view', {
                    __path: window.location.pathname,
                    __title: document.title,
                    profileId,
                }),
                SESSION_TIMEOUT_MS
            );
            if (userId && result?.sessionId) {
                setSessionId(result.sessionId);
            }
            this.started = true;
            if (userId) {
                await this.identify(userId, { email });
            } else {
                await this.identify(profileId, {
                    firstName: anonymousDisplayName(),
                    adoptSession: false,
                });
            }
        } catch (error) {
            logBreadcrumb('openpanel', 'session start failed', { error });
        }
    }

    private async identify(
        profileId: string,
        options?: { email?: string; firstName?: string; adoptSession?: boolean }
    ) {
        if (!this.op) {
            return;
        }
        const payload = {
            profileId,
            ...(options?.email ? { email: options.email } : {}),
            ...(options?.firstName ? { firstName: options.firstName } : {}),
        };
        try {
            const result = await Promise.resolve(this.op.identify(payload));
            if (options?.adoptSession !== false && result?.sessionId) {
                setSessionId(result.sessionId);
            }
        } catch (error) {
            logBreadcrumb('openpanel', 'identify failed', { error });
        }
    }
}

function configuredSecret(value: string | undefined): string {
    if (!value || value.startsWith('IO_LABKEEPER_FRONTEND_')) {
        return '';
    }
    return value.trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
            reject(new Error(`OpenPanel session timed out after ${ms}ms`));
        }, ms);
        promise.then(
            (value) => {
                window.clearTimeout(timer);
                resolve(value);
            },
            (error) => {
                window.clearTimeout(timer);
                reject(error);
            }
        );
    });
}
