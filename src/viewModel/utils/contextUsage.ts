/**
 * GH-191: сколько процентов контекста модели занято после прогона, целым числом.
 * null, если поля нет или окно пустое: процент тогда не показывается вовсе
 */
export function contextUsagePercent(
    contextTokens: number | null | undefined,
    maxContextTokens: number | null | undefined
): number | null {
    if (
        typeof contextTokens !== 'number' ||
        typeof maxContextTokens !== 'number' ||
        !Number.isFinite(contextTokens) ||
        !Number.isFinite(maxContextTokens) ||
        maxContextTokens <= 0
    ) {
        return null;
    }
    return Math.round((contextTokens / maxContextTokens) * 100);
}
