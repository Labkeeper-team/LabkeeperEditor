const CLOUD_INGEST_HOST = /^(?:o\d+\.)?ingest(?:\.([a-z]{2}))?\.sentry\.io$/;
const HEX_EVENT_ID = /^[0-9a-fA-F]{32}$/;

export function sentryIssueSearchUrl(
    dsn: string | undefined,
    eventId: string
): string | undefined {
    const id = eventId.trim();
    if (!dsn || !id) {
        return undefined;
    }
    let uri: URL;
    try {
        uri = new URL(dsn);
    } catch {
        return undefined;
    }
    const uiBase = sentryUiBaseUrl(uri);
    if (!uiBase) {
        return undefined;
    }
    if (isBugsinkHost(uri.hostname)) {
        const uuid = toDashedUuid(id);
        return uuid ? `${uiBase}/issues/event/${uuid}/` : undefined;
    }
    const projectId = uri.pathname
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .pop();
    if (!projectId) {
        return undefined;
    }
    return `${uiBase}/issues/?project=${projectId}&query=${id}`;
}

export function toDashedUuid(eventId: string): string | undefined {
    const hex = eventId.trim().replace(/-/g, '');
    if (!HEX_EVENT_ID.test(hex)) {
        return undefined;
    }
    const normalized = hex.toLowerCase();
    return `${normalized.slice(0, 8)}-${normalized.slice(8, 12)}-${normalized.slice(12, 16)}-${normalized.slice(16, 20)}-${normalized.slice(20)}`;
}

function isBugsinkHost(host: string): boolean {
    return host.toLowerCase().includes('bugsink');
}

function sentryUiBaseUrl(dsnUri: URL): string | undefined {
    const host = dsnUri.hostname.trim();
    if (!host) {
        return undefined;
    }
    const cloud = CLOUD_INGEST_HOST.exec(host);
    if (cloud) {
        const region = cloud[1];
        return region ? `https://${region}.sentry.io` : 'https://sentry.io';
    }
    const scheme = dsnUri.protocol.replace(/:$/, '') || 'https';
    return `${scheme}://${host}`;
}
