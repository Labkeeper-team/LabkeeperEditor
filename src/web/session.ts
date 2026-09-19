import { logBreadcrumb } from '../viewModel/utils/logBreadcrumb.ts';

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

// значение живёт до конца вкладки: подмена посреди работы разрывает цепочку запросов
// на бэкенде, и до этого её не было видно ни в одном логе
export function adoptAnalyticsSessionId(next: string | undefined) {
    if (!next) {
        return;
    }
    if (sessionId) {
        if (sessionId !== next) {
            logBreadcrumb(
                'session',
                'session id replacement ignored',
                { previous: sessionId, next },
                'warning'
            );
        }
        return;
    }
    sessionId = next;
}

// единственное исключение из правила одного присвоения: иначе вкладка до закрытия
// ходила бы с идентификатором вышедшего пользователя
export function resetSessionIdOnLogout(): string {
    logBreadcrumb('session', 'session id reset on logout', {
        previous: sessionId,
    });
    sessionId = undefined;
    return createGuestSessionId();
}

export function withSessionQuery(url: string): string {
    if (!sessionId) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}
