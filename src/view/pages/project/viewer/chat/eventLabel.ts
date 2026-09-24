/** Текст строки ленты: подпись из словаря с номером сегмента, если он известен */
export function eventLabel(
    events: Record<string, string>,
    labelKey: string,
    segmentId?: number
): string {
    // только свои ключи словаря: по имени из прототипа нашлась бы функция, и лента упала бы
    const text = Object.prototype.hasOwnProperty.call(events, labelKey)
        ? events[labelKey]
        : events.unknown_tool;
    return segmentId == null
        ? text.replace('№{segment}', '').trim()
        : text.replace('{segment}', String(segmentId));
}
