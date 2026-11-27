import type { ProjectType, SegmentType } from '../../model/domain.ts';

/**
 * GH-230: что значит файл, вставленный или перетащенный в сегмент. Раньше
 * любой файл уходил на сервер, а в сегмент попадало то, что подвернётся:
 * в «Вычисление» .tex становился вызовом load_csv и падал при выполнении, а
 * в LaTeX и Маркдаун вместо файла вставлялись пустые строки
 *
 * - картинка: в каждом из трёх сегментов своей разметкой;
 * - таблица .csv: в «Вычисление» вызовом load_csv;
 * - файл .tex: в LaTeX-сегмент проекта LaTeX командой \input. Сервер кладёт
 *   файлы проекта рядом с main.tex, так подключают свои файлы и шаблоны.
 *   В проекте Markdown LaTeX не компилируется, и \input там не сработает
 *
 * Остальное в сегмент не вставляется: файл не загружается, а человек узнаёт,
 * что сюда можно вставить
 */
export type SegmentFileKind = 'image' | 'csv' | 'tex';

const extensionOf = (fileName: string): string => {
    const dot = fileName.lastIndexOf('.');
    return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
};

export function segmentFileKind(
    fileName: string,
    mimeType: string
): SegmentFileKind | null {
    if (mimeType.startsWith('image/')) {
        return 'image';
    }
    const extension = extensionOf(fileName);
    if (extension === 'csv') {
        return 'csv';
    }
    if (extension === 'tex') {
        return 'tex';
    }
    return null;
}

/** Какие файлы примет сегмент. Пустой список значит, что файл сюда не вставить вовсе */
export function segmentAcceptedFileKinds(
    segmentType: SegmentType | undefined,
    projectType: ProjectType
): SegmentFileKind[] {
    switch (segmentType) {
        case 'md':
            return ['image'];
        case 'latex':
            return projectType === 'latex' ? ['image', 'tex'] : ['image'];
        case 'computational':
            return ['image', 'csv'];
        default:
            return [];
    }
}

/**
 * Разметка для уже загруженного файла. url это адрес из ответа загрузки,
 * fileName имя, под которым файл лежит в проекте
 */
export function segmentFileSnippet(
    kind: SegmentFileKind,
    segmentType: SegmentType | undefined,
    url: string,
    fileName: string
): string {
    if (kind === 'csv') {
        return `load_csv("${fileName}")`;
    }
    if (kind === 'tex') {
        return `\\input{${fileName}}`;
    }
    switch (segmentType) {
        case 'md':
            return `!['image.png'](${url})`;
        case 'latex':
            return `\\begin{center}
\\includegraphics{${url}}
\\end{center}`;
        default:
            return `image("${url}")`;
    }
}

/**
 * GH-289: аргументы, которые ждут адрес картинки, по тексту до курсора: фигурные
 * скобки \includegraphics (с необязательными [параметрами]) и круглые скобки
 * картинки Markdown. Закрывающей скобки между началом аргумента и курсором нет
 */
const IMAGE_ARGUMENT_BEFORE_CURSOR: Partial<Record<SegmentType, RegExp>> = {
    latex: /\\includegraphics\*?\s*(?:\[[^\]]*\]\s*)?\{[^{}]*$/,
    md: /!\[[^\]]*\]\([^()\s]*$/,
};

/** Стоит ли курсор внутри аргумента, куда пишут адрес картинки */
export function isInsideImageArgument(
    segmentType: SegmentType | undefined,
    text: string,
    cursor: number
): boolean {
    const pattern = segmentType
        ? IMAGE_ARGUMENT_BEFORE_CURSOR[segmentType]
        : undefined;
    if (!pattern) {
        return false;
    }
    const at = Math.min(Math.max(cursor, 0), text.length);
    return pattern.test(text.slice(0, at));
}

/**
 * Куда и чем лёг загруженный файл. Картинка внутри аргумента, который ждёт её
 * адрес, встаёт одним адресом в месте курсора: целый блок с center внутри
 * \includegraphics{} давал вложенную конструкцию, и компиляция падала с
 * непонятными человеку ошибками. Остальное встаёт разметкой на своей строке
 */
export function insertSegmentFile(
    kind: SegmentFileKind,
    segmentType: SegmentType | undefined,
    text: string,
    cursor: number,
    url: string,
    fileName: string
): { text: string; cursor: number } {
    if (kind === 'image' && isInsideImageArgument(segmentType, text, cursor)) {
        const at = Math.min(Math.max(cursor, 0), text.length);
        return {
            text: `${text.slice(0, at)}${url}${text.slice(at)}`,
            cursor: at + url.length,
        };
    }
    return insertOnOwnLine(
        text,
        cursor,
        segmentFileSnippet(kind, segmentType, url, fileName)
    );
}

/**
 * Вставка отдельной строкой: перевод строки добавляется, только если курсор
 * стоит посреди строки. Раньше разметка всегда обрамлялась двумя переводами,
 * и в пустом сегменте оставались пустые строки сверху и снизу
 */
export function insertOnOwnLine(
    text: string,
    cursor: number,
    snippet: string
): { text: string; cursor: number } {
    const at = Math.min(Math.max(cursor, 0), text.length);
    const before = text.slice(0, at);
    const after = text.slice(at);
    const lead = before === '' || before.endsWith('\n') ? '' : '\n';
    const trail = after === '' || after.startsWith('\n') ? '' : '\n';
    return {
        text: `${before}${lead}${snippet}${trail}${after}`,
        cursor: before.length + lead.length + snippet.length,
    };
}
