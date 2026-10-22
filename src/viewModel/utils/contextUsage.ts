/**
 * GH-191: сколько процентов контекста модели занято после прогона, целым числом.
 * null, если поля нет или окно пустое: процент тогда не показывается вовсе
 */
export function contextUsagePercent(
    contextTokens: number | null | undefined,
    maxContextTokens: number | null | undefined
): number | null {
    // запись истории приходит без разбора кадра сокета, поэтому проверка та же: целое неотрицательное
    if (
        !Number.isInteger(contextTokens) ||
        !Number.isInteger(maxContextTokens) ||
        (contextTokens as number) < 0 ||
        (maxContextTokens as number) <= 0
    ) {
        return null;
    }
    return Math.round(
        ((contextTokens as number) / (maxContextTokens as number)) * 100
    );
}
