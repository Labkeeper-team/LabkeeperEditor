export const LABKEEPER_SESSION_HEADER = 'X-Labkeeper-Session-Id';

export function sessionIdAsProfileId(sessionId: string): string {
    return sessionId.replace(/[^0-9A-Za-z]/g, '');
}

let sessionId: string | undefined;

export function getSessionId(): string | undefined {
    return sessionId;
}

export function createGuestSessionId(): string {
    if (!sessionId) {
        sessionId = sessionIdAsProfileId(crypto.randomUUID());
    }
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
