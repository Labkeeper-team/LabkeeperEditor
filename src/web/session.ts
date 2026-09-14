export const LABKEEPER_SESSION_HEADER = 'X-Labkeeper-Session-Id';
const STORAGE_KEY = 'labkeeper.sessionId';

export function getSessionId(): string {
    if (typeof window === 'undefined') {
        return crypto.randomUUID();
    }
    const existing = window.sessionStorage.getItem(STORAGE_KEY);
    if (existing) {
        return existing;
    }
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(STORAGE_KEY, created);
    return created;
}

export function withSessionQuery(url: string): string {
    const sessionId = getSessionId();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}
