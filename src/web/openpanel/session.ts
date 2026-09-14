export const OPENPANEL_SESSION_HEADER = 'X-OpenPanel-Session-Id';
const STORAGE_KEY = 'labkeeper.openpanel.sessionId';

export function getOpenPanelSessionId(): string {
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

export function withOpenPanelSessionQuery(url: string): string {
    const sessionId = getOpenPanelSessionId();
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}
