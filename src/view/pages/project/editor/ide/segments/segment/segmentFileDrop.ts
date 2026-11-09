import type { EditorView } from '@codemirror/view';

/** Тащат файлы с диска, а не выделенный текст: текст по-прежнему переносит CodeMirror */
export const isFileDrag = (dataTransfer: DataTransfer | null): boolean =>
    Boolean(dataTransfer && Array.from(dataTransfer.types).includes('Files'));

/**
 * GH-230: куда встанет файл, брошенный на поле сегмента. Ниже текста, на
 * пустом месте поля, файл встаёт в конец; рядом со строкой, в том числе на
 * номерах строк, в ближайшее к точке место этой строки
 */
export function segmentDropPosition(
    view: EditorView,
    x: number,
    y: number
): number {
    const end = view.state.doc.length;
    const lastLine = view.coordsAtPos(end);
    if (!lastLine || y > lastLine.bottom) {
        return end;
    }
    return view.posAtCoords({ x, y }, false);
}
