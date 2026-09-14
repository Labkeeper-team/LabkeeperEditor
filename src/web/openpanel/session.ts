import { Secrets } from '../../constants.ts';

export const OPENPANEL_SESSION_HEADER = 'X-OpenPanel-Session-Id';
const OPENPANEL_URL_PLACEHOLDER = 'IO_LABKEEPER_OPENPANEL_BASE_URL';
const OPENPANEL_CLIENT_ID_PLACEHOLDER = 'IO_LABKEEPER_OPENPANEL_CLIENT_ID';

function resolvedSecret(
    value: string,
    placeholder: string
): string | undefined {
    const trimmed = value.trim();
    if (!trimmed || trimmed === placeholder) {
        return undefined;
    }
    return trimmed;
}

function isLocalhost(): boolean {
    return (
        typeof window !== 'undefined' &&
        window.location.hostname === 'localhost'
    );
}

export function getOpenPanelUrl(): string | undefined {
    const resolved = resolvedSecret(
        Secrets.openPanelUrl,
        OPENPANEL_URL_PLACEHOLDER
    );
    if (resolved) {
        return resolved;
    }
    return isLocalhost() ? 'http://localhost:4401' : undefined;
}

export function getOpenPanelClientId(): string | undefined {
    const resolved = resolvedSecret(
        Secrets.openPanelClientId,
        OPENPANEL_CLIENT_ID_PLACEHOLDER
    );
    if (resolved) {
        return resolved;
    }
    const configuredUrl = resolvedSecret(
        Secrets.openPanelUrl,
        OPENPANEL_URL_PLACEHOLDER
    );
    if (!configuredUrl && isLocalhost()) {
        return '00000000-0000-0000-0000-000000000003';
    }
    return undefined;
}

declare global {
    interface Window {
        __OPENPANEL_SESSION_ID__?: string;
    }
}

export function getOpenPanelSessionId(): string | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }
    const fromWindow = window.__OPENPANEL_SESSION_ID__;
    if (fromWindow) {
        return fromWindow;
    }
    return undefined;
}

export function withOpenPanelSessionQuery(url: string): string {
    const sessionId = getOpenPanelSessionId();
    if (!sessionId) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}
