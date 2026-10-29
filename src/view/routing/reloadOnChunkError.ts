import { logBreadcrumb } from '../../viewModel/utils/logBreadcrumb.ts';

const RELOADED_AT_KEY = 'labkeeper.chunkReloadedAt';
// за это время перезагрузка уже была: второй раз не помогает, значит, дело не в сети
const RELOAD_WINDOW_MS = 60 * 1000;

// так браузеры сообщают, что модуль из import() не загрузился: Safari, Chrome, Firefox, Vite
const CHUNK_LOAD_ERROR =
    /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|Unable to preload CSS/i;

export const isChunkLoadError = (error: unknown): boolean =>
    error instanceof Error && CHUNK_LOAD_ERROR.test(error.message);

const reloadedRecently = (now: number): boolean => {
    try {
        const reloadedAt = Number(sessionStorage.getItem(RELOADED_AT_KEY));
        return (
            reloadedAt > 0 &&
            now >= reloadedAt &&
            now - reloadedAt < RELOAD_WINDOW_MS
        );
    } catch {
        // без хранилища не отличить первую перезагрузку от петли, поэтому не перезагружаем
        return true;
    }
};

const markReload = (now: number) => {
    try {
        sessionStorage.setItem(RELOADED_AT_KEY, String(now));
    } catch {
        // reloadedRecently тогда тоже не прочтёт хранилище и петли не будет
    }
};

/**
 * Чанк страницы, который не загрузился, браузер помнит и повторный import()
 * того же адреса сразу отклоняет. Поэтому страница перезагружается один раз:
 * обычно это обрыв сети на телефоне или выкладка, после которой старых
 * чанков уже нет. Если и после перезагрузки чанк не пришёл, ошибка уходит
 * в границу ошибок, как раньше
 */
export const reloadOnChunkError = <T>(
    load: () => Promise<T>,
    reload: () => void = () => window.location.reload()
): Promise<T> =>
    load().catch((error: unknown) => {
        const now = Date.now();
        if (!isChunkLoadError(error) || reloadedRecently(now)) {
            throw error;
        }
        markReload(now);
        logBreadcrumb(
            'startup',
            'chunk load failed, reloading',
            { message: (error as Error).message },
            'warning'
        );
        reload();
        // страница уходит на перезагрузку, отрисовывать нечего
        return new Promise<T>(() => {});
    });
