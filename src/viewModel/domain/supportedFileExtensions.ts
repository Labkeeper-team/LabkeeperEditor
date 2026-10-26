/**
 * Двоичные форматы, которые редактор принимает в проект: картинки для LaTeX и
 * Markdown. PDF вставляется в LaTeX как картинка, и агенту его дают прямо из чата.
 * EPS и PS бывают с двоичным заголовком превью, поэтому тоже в списке
 *
 * Текстовые файлы принимаются с любым расширением, их отличают по содержимому
 * (GH-209): классы, пакеты, стили библиографии и данные не приходится
 * добавлять в список по одному
 */
export const BINARY_EXTENSIONS = [
    '.png',
    '.jpg',
    '.jpeg',
    '.svg',
    '.pdf',
    '.eps',
    '.ps',
] as const;

/** Сколько байт смотреть, как git: в двоичном файле нулевой байт встречается в самом начале */
const TEXT_SNIFF_BYTES = 8000;

export const hasBinaryExtension = (fileName: string): boolean => {
    const lower = fileName.toLowerCase();
    return BINARY_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

const readHead = (file: Blob): Promise<ArrayBuffer> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(file.slice(0, TEXT_SNIFF_BYTES));
    });

/** Текст ли это: в начале файла нет нулевых байтов. Пустой файл тоже текст */
export const looksLikeTextFile = async (file: Blob): Promise<boolean> =>
    !new Uint8Array(await readHead(file)).includes(0);
