export const LABKEEPER_SESSION_HEADER = 'X-Labkeeper-Session-Id';

let sessionId: string | undefined;

export function getSessionId(): string | undefined {
    return sessionId;
}

export function setSessionId(next: string | undefined) {
    if (!next) {
        return;
    }
    sessionId = next;
}

export function withSessionQuery(url: string): string {
    if (!sessionId) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}
