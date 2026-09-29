import { logBreadcrumb } from '../viewModel/utils/logBreadcrumb.ts';

export const LABKEEPER_SESSION_HEADER = 'X-Labkeeper-Session-Id';

// ключи вкладки общие с лендингом: переход в редактор не начинает нового человека
export const OPENPANEL_PROFILE_STORAGE_KEY = 'labkeeper.openpanel.profileId';
export const OPENPANEL_SESSION_STARTED_KEY =
    'labkeeper.openpanel.sessionStarted';
export const OPENPANEL_ATTRIBUTION_STORAGE_KEY =
    'labkeeper.openpanel.attribution';
export const OPENPANEL_FIRST_NAME_STORAGE_KEY = 'labkeeper.openpanel.firstName';

const CAMPAIGN_PARAM_NAMES = [
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'yclid',
    'campaign_id',
    'ad_id',
    'banner_id',
    'phrase_id',
    'source',
    'device',
    'region',
] as const;

const PROFILE_ID_PATTERN = /^[0-9A-Za-z]+$/;
const ANONYMOUS_NAME_PATTERN = /^anonymous\d{6}$/;

export function sessionIdAsProfileId(sessionId: string): string {
    return sessionId.replace(/[^0-9A-Za-z]/g, '');
}

let sessionId: string | undefined;

export function getSessionId(): string | undefined {
    return sessionId;
}

function readStoredGuestSessionId(): string | undefined {
    try {
        const stored = sessionStorage.getItem(OPENPANEL_PROFILE_STORAGE_KEY);
        if (stored && PROFILE_ID_PATTERN.test(stored)) {
            return stored;
        }
    } catch {
        // приватный режим не должен ронять вкладку: id останется только в памяти
    }
    return undefined;
}

function writeStoredGuestSessionId(id: string) {
    try {
        sessionStorage.setItem(OPENPANEL_PROFILE_STORAGE_KEY, id);
    } catch {
        // без хранилища лендинг и редактор не склеят профиль, запросы редактора живы
    }
}

function clearOpenPanelTabStorage() {
    try {
        sessionStorage.removeItem(OPENPANEL_PROFILE_STORAGE_KEY);
        sessionStorage.removeItem(OPENPANEL_SESSION_STARTED_KEY);
        sessionStorage.removeItem(OPENPANEL_ATTRIBUTION_STORAGE_KEY);
        sessionStorage.removeItem(OPENPANEL_FIRST_NAME_STORAGE_KEY);
    } catch {
        // выход не зависит от того, доступно ли хранилище вкладки
    }
}

function newAnonymousDisplayName(): string {
    const suffix = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    return `anonymous${String(suffix).padStart(6, '0')}`;
}

// имя гостя живёт вместе с профилем вкладки: переход между страницами его не меняет
export function readOrCreateGuestDisplayName(): string {
    try {
        const stored = sessionStorage.getItem(OPENPANEL_FIRST_NAME_STORAGE_KEY);
        if (stored && ANONYMOUS_NAME_PATTERN.test(stored)) {
            return stored;
        }
    } catch {
        return newAnonymousDisplayName();
    }
    const name = newAnonymousDisplayName();
    try {
        sessionStorage.setItem(OPENPANEL_FIRST_NAME_STORAGE_KEY, name);
    } catch {
        // без хранилища имя останется только в этом identify
    }
    return name;
}

export function landingSessionAlreadyStarted(): boolean {
    try {
        return sessionStorage.getItem(OPENPANEL_SESSION_STARTED_KEY) === '1';
    } catch {
        return false;
    }
}

export function readOpenPanelAttribution(): Record<string, string> | undefined {
    try {
        const raw = sessionStorage.getItem(OPENPANEL_ATTRIBUTION_STORAGE_KEY);
        if (!raw) {
            return undefined;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return undefined;
        }
        const record = parsed as Record<string, unknown>;
        const properties: Record<string, string> = {};
        for (const name of CAMPAIGN_PARAM_NAMES) {
            const value = record[name];
            if (typeof value !== 'string') {
                continue;
            }
            const trimmed = value.trim();
            if (!trimmed) {
                continue;
            }
            properties[name] = trimmed;
        }
        return Object.keys(properties).length > 0 ? properties : undefined;
    } catch {
        return undefined;
    }
}

export function createGuestSessionId(): string {
    if (!sessionId) {
        // id вкладки лежит в sessionStorage: заход с лендинга и обновление редактора
        // не рвут цепочку, а подмена посреди работы по-прежнему запрещена
        sessionId =
            readStoredGuestSessionId() ??
            sessionIdAsProfileId(crypto.randomUUID());
        writeStoredGuestSessionId(sessionId);
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
    clearOpenPanelTabStorage();
    return createGuestSessionId();
}

export function withSessionQuery(url: string): string {
    if (!sessionId) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}
