/**
 * Пропускает не больше limit срабатываний за скользящее окно windowMs.
 * Возвращает функцию: true, если срабатывание укладывается в лимит
 */
export function createRateLimiter(
    limit: number,
    windowMs: number,
    now: () => number = Date.now
): () => boolean {
    const stamps: number[] = [];
    return () => {
        const current = now();
        while (stamps.length > 0 && current - stamps[0] >= windowMs) {
            stamps.shift();
        }
        if (stamps.length >= limit) {
            return false;
        }
        stamps.push(current);
        return true;
    };
}
