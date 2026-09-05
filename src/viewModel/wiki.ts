/**
 * Ссылки на wiki проекта (Diplodoc-сайт из репозитория Docs),
 * размещённую на нашем домене по пути /wiki.
 *
 * Пути страниц соответствуют docs/toc.yaml, а якоря — id заголовков,
 * которые Diplodoc генерирует транслитерацией русских заголовков.
 */
export const WIKI_BASE_URL = '/wiki/';

export const WikiLinks = {
    /** Главная страница wiki. */
    home: WIKI_BASE_URL,
    /** Примеры. */
    examples: `${WIKI_BASE_URL}examples.html`,
    /** Примеры → «Примеры разнообразных механизмов отрисовки математики». */
    mathRenderingExamples: `${WIKI_BASE_URL}examples.html#primery-raznoobraznyh-mehanizmov-otrisovki-matematiki`,
    /** Концепции → Сегменты. */
    segments: `${WIKI_BASE_URL}concepts/segments.html`,
    /** Концепции → Сегменты → «Подстановка значений в текстовые сегменты». */
    valueSubstitution: `${WIKI_BASE_URL}concepts/segments.html#podstanovka-znachenij-v-tekstovye-segmenty`,
    /** Вычислительный язык → Синтаксис → «Оператор погрешности». */
    errorOperator: `${WIKI_BASE_URL}language/syntax.html#operator-pogreshnosti`,
    /** Вычислительный язык → Функции → Прорисовка. */
    plot: `${WIKI_BASE_URL}language/functions/plot.html`,
} as const;
