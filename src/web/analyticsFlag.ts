export const ANALYTICS_DISABLED_STORAGE_KEY = 'labkeeper_analytics_disabled';

// флаг ставит e2e до загрузки приложения: по нему молчит аналитика и помечаются события Sentry
export function isAnalyticsDisabled(): boolean {
    if (typeof window === 'undefined') {
        return false;
    }
    try {
        return (
            window.localStorage.getItem(ANALYTICS_DISABLED_STORAGE_KEY) === '1'
        );
    } catch {
        return false;
    }
}
