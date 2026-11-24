import { useLayoutEffect, useState, type RefObject } from 'react';

/** Шапка колонки с вкладками */
const VIEWER_HEADER_HEIGHT = 50;
/** Зазор между чатом и помощью */
const COLUMN_GAP = 8;
/** Полоса «Помощь» и слайды под ней: высота слайдов та же, что $body-height в стилях помощи */
const HELP_HEADER_HEIGHT = 26;
const HELP_BODY_HEIGHT = 232;
/** GH-279: ряд файлов над полем запроса (32) и зазор до поля, он теперь в чате всегда */
const FILES_ROW_HEIGHT = 44;
/** Лента не ниже 120, ряд файлов, поле запроса 152, отступы и зазоры */
const CHAT_MIN_HEIGHT = 316 + FILES_ROW_HEIGHT;
/**
 * В пустом чате ленты нет: поле запроса, предупреждение под ним и отступы.
 * Ряд файлов здесь не в счёт: в тесноте он уступает помощи, её просил
 * заказчик под пустым чатом, а загрузить файл можно и в файловом менеджере
 */
const EMPTY_CHAT_MIN_HEIGHT = 232;

/** Какому чату хватит места, если под ним останется помощь: никакому, только пустому или любому */
export type HelpRoom = 'none' | 'empty' | 'any';

export const helpRoomFor = (
    columnHeight: number,
    helpExpanded: boolean
): HelpRoom => {
    const chatHeight =
        columnHeight -
        VIEWER_HEADER_HEIGHT -
        COLUMN_GAP -
        HELP_HEADER_HEIGHT -
        (helpExpanded ? HELP_BODY_HEIGHT : 0);
    if (chatHeight >= CHAT_MIN_HEIGHT) {
        return 'any';
    }
    return chatHeight >= EMPTY_CHAT_MIN_HEIGHT ? 'empty' : 'none';
};

/**
 * Сколько места в колонке останется чату под помощью. Высота колонки задана
 * страницей и от самой помощи не зависит, поэтому замер не зацикливается.
 * Считаем по вёрстке, а не по окну: клавиатура телефона сжимает страницу,
 * и помощь на это время уступает место полю запроса
 */
export const useHelpRoom = (
    columnRef: RefObject<HTMLElement | null>,
    helpExpanded: boolean
): HelpRoom => {
    const [room, setRoom] = useState<HelpRoom>('any');

    useLayoutEffect(() => {
        const column = columnRef.current;
        if (!column) {
            return;
        }
        const measure = () =>
            setRoom(helpRoomFor(column.offsetHeight, helpExpanded));
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(column);
        return () => observer.disconnect();
    }, [columnRef, helpExpanded]);

    return room;
};
