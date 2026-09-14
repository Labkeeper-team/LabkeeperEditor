import { OpenPanel } from '@openpanel/web';
import { Secrets } from '../../constants.ts';
import { logBreadcrumb } from '../../viewModel/utils/logBreadcrumb.ts';
import { setSessionId } from '../session.ts';

const SESSION_TIMEOUT_MS = 2000;

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

export async function startOpenPanelSession() {
    const clientId = configuredSecret(Secrets.openpanelClientId);
    const apiUrl = configuredSecret(Secrets.openpanelApiUrl);
    if (!clientId || !apiUrl) {
        return;
    }
    const op = new OpenPanel({
        clientId,
        apiUrl,
        trackScreenViews: false,
        trackOutgoingLinks: false,
    });
    try {
        const result = await withTimeout(
            op.track('screen_view', {
                __path: window.location.pathname,
                __title: document.title,
            }),
            SESSION_TIMEOUT_MS
        );
        if (result?.sessionId) {
            setSessionId(result.sessionId);
        }
    } catch (error) {
        logBreadcrumb('openpanel', 'session start failed', { error });
    }
}
