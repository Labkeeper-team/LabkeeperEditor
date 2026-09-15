const CLOUD_INGEST_HOST = /^(?:o\d+\.)?ingest(?:\.([a-z]{2}))?\.sentry\.io$/;

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
    const projectId = uri.pathname
        .replace(/^\/+|\/+$/g, '')
        .split('/')
        .pop();
    if (!projectId) {
        return undefined;
    }
    const uiBase = sentryUiBaseUrl(uri);
    if (!uiBase) {
        return undefined;
    }
    return `${uiBase}/issues/?project=${projectId}&query=${id}`;
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
