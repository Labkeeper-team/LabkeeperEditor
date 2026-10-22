import { logBreadcrumb } from '../viewModel/utils/logBreadcrumb.ts';

export const LABKEEPER_SESSION_HEADER = 'X-Labkeeper-Session-Id';

// ключи гостя общие с лендингом и лежат в localStorage устройства: вкладка, открытая
// с лендинга через target="_blank", и возврат на лендинг продолжают того же гостя.
// Имена прежние: в sessionStorage старые значения просто остаются без чтения.
export const OPENPANEL_PROFILE_STORAGE_KEY = 'labkeeper.openpanel.profileId';
export const OPENPANEL_SESSION_STARTED_KEY =
    'labkeeper.openpanel.sessionStarted';
export const OPENPANEL_ATTRIBUTION_STORAGE_KEY =
    'labkeeper.openpanel.attribution';
export const OPENPANEL_FIRST_NAME_STORAGE_KEY = 'labkeeper.openpanel.firstName';
export const OPENPANEL_LAST_ACTIVITY_STORAGE_KEY =
    'labkeeper.openpanel.lastActivity';
// столько OpenPanel держит сессию без событий: после такой паузы гость начинается заново
export const OPENPANEL_SESSION_IDLE_MS = 30 * 60 * 1000;

const GUEST_STORAGE_KEYS = [
    OPENPANEL_PROFILE_STORAGE_KEY,
    OPENPANEL_SESSION_STARTED_KEY,
    OPENPANEL_ATTRIBUTION_STORAGE_KEY,
    OPENPANEL_FIRST_NAME_STORAGE_KEY,
    OPENPANEL_LAST_ACTIVITY_STORAGE_KEY,
];

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

// хранилище гостя, из которого уже убрано всё от истёкшей сессии. Время из будущего
// тоже считается истёкшим: после перевода часов назад иначе гость жил бы лишние часы
function guestStorage(): Storage | undefined {
    try {
        const storage = window.localStorage;
        const lastActivity = Number(
            storage.getItem(OPENPANEL_LAST_ACTIVITY_STORAGE_KEY)
        );
        const idle = Date.now() - lastActivity;
        const fresh =
            lastActivity > 0 && idle >= 0 && idle <= OPENPANEL_SESSION_IDLE_MS;
        if (!fresh) {
            removeGuestKeys(storage);
        }
        return storage;
    } catch {
        // приватный режим не должен ронять вкладку: гость останется только в памяти
        return undefined;
    }
}

function removeGuestKeys(storage: Storage) {
    for (const key of GUEST_STORAGE_KEYS) {
        storage.removeItem(key);
    }
}

function readGuestValue(key: string): string | null {
    try {
        return guestStorage()?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

function writeGuestValue(key: string, value: string) {
    const storage = guestStorage();
    try {
        storage?.setItem(key, value);
        // запись тоже продлевает окно: иначе следующее чтение сочло бы её истёкшей
        storage?.setItem(
            OPENPANEL_LAST_ACTIVITY_STORAGE_KEY,
            String(Date.now())
        );
    } catch {
        // без хранилища лендинг и другие вкладки не склеят профиль, запросы редактора живы
    }
}

// каждое событие в OpenPanel продлевает окно гостя для всех вкладок и лендинга
export function markOpenPanelActivity() {
    const storage = guestStorage();
    try {
        storage?.setItem(
            OPENPANEL_LAST_ACTIVITY_STORAGE_KEY,
            String(Date.now())
        );
    } catch {
        // без хранилища окно не продлится, а событие всё равно уйдёт
    }
}

function readStoredGuestSessionId(): string | undefined {
    const stored = readGuestValue(OPENPANEL_PROFILE_STORAGE_KEY);
    return stored && PROFILE_ID_PATTERN.test(stored) ? stored : undefined;
}

function clearGuestStorage() {
    try {
        removeGuestKeys(window.localStorage);
    } catch {
        // выход не зависит от того, доступно ли хранилище
    }
}

function newAnonymousDisplayName(): string {
    const suffix = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
    return `anonymous${String(suffix).padStart(6, '0')}`;
}

// имя гостя живёт вместе с его профилем: переход между страницами и вкладками его не меняет
export function readOrCreateGuestDisplayName(): string {
    const stored = readGuestValue(OPENPANEL_FIRST_NAME_STORAGE_KEY);
    if (stored && ANONYMOUS_NAME_PATTERN.test(stored)) {
        return stored;
    }
    const name = newAnonymousDisplayName();
    writeGuestValue(OPENPANEL_FIRST_NAME_STORAGE_KEY, name);
    return name;
}

// флаг ставит тот, кто первым отправил старт сессии гостя: лендинг или редактор
export function guestSessionAlreadyStarted(): boolean {
    return readGuestValue(OPENPANEL_SESSION_STARTED_KEY) === '1';
}

export function markGuestSessionStarted() {
    writeGuestValue(OPENPANEL_SESSION_STARTED_KEY, '1');
}

export function readOpenPanelAttribution(): Record<string, string> | undefined {
    try {
        const raw = readGuestValue(OPENPANEL_ATTRIBUTION_STORAGE_KEY);
        if (!raw) {
            return undefined;
        }
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            return undefined;
        }
        return campaignProperties((name) => {
            const value = (parsed as Record<string, unknown>)[name];
            return typeof value === 'string' ? value : undefined;
        });
    } catch {
        return undefined;
    }
}

// прямой заход в редактор несёт метки кампании в адресе. Запись лендинга этой сессии
// уже лежит в хранилище, и второй раз её подменять нельзя.
export function captureOpenPanelAttributionFromLocation() {
    if (readOpenPanelAttribution()) {
        return;
    }
    const params = new URLSearchParams(window.location.search);
    const properties = campaignProperties(
        (name) => params.get(name) ?? undefined
    );
    if (!properties) {
        return;
    }
    writeGuestValue(
        OPENPANEL_ATTRIBUTION_STORAGE_KEY,
        JSON.stringify(properties)
    );
}

function campaignProperties(
    read: (name: (typeof CAMPAIGN_PARAM_NAMES)[number]) => string | undefined
): Record<string, string> | undefined {
    const properties: Record<string, string> = {};
    for (const name of CAMPAIGN_PARAM_NAMES) {
        const value = read(name);
        if (!value) {
            continue;
        }
        const trimmed = value.trim();
        if (!trimmed) {
            continue;
        }
        properties[name] = trimmed;
    }
    return Object.keys(properties).length > 0 ? properties : undefined;
}

export function createGuestSessionId(): string {
    if (!sessionId) {
        // id гостя общий для вкладок в пределах окна сессии: заход с лендинга, новая
        // вкладка и обновление редактора не рвут цепочку, а подмена посреди работы запрещена
        sessionId =
            readStoredGuestSessionId() ??
            sessionIdAsProfileId(crypto.randomUUID());
        writeGuestValue(OPENPANEL_PROFILE_STORAGE_KEY, sessionId);
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
    clearGuestStorage();
    return createGuestSessionId();
}

export function withSessionQuery(url: string): string {
    if (!sessionId) {
        return url;
    }
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}sessionId=${encodeURIComponent(sessionId)}`;
}
