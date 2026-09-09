import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { resetLockedViewportScrollAfterFocus } from '../../../../utils/resetLockedViewportScroll';

export const TEXT_FILE_EDITOR_HOST_ID = 'text-file-editor-host';

export function getTextFileEditorView(): EditorView | null {
    const dom = document.getElementById(TEXT_FILE_EDITOR_HOST_ID);
    if (!dom) {
        return null;
    }
    return EditorView.findFromDOM(dom) ?? null;
}

/**
 * Курсор на строку + прокрутка в текстовом файле (SyncTeX, ошибки, изменения агента).
 * С focus: false курсор и фокус не трогаем: фокус должен остаться в поле промпта.
 */
export function scrollTextFileEditorLineIntoView(
    line: number,
    options?: { focus?: boolean }
): boolean {
    const view = getTextFileEditorView();
    if (!view) {
        return false;
    }

    const doc = view.state.doc;
    const lineNumber = Math.max(1, Math.min(line, doc.lines));
    const offset = doc.line(lineNumber).from;

    const shouldFocus = options?.focus !== false;

    view.dispatch({
        selection: shouldFocus ? EditorSelection.cursor(offset) : undefined,
        effects: EditorView.scrollIntoView(offset, {
            y: 'start',
            x: 'nearest',
        }),
    });
    if (shouldFocus) {
        view.focus();
    }
    resetLockedViewportScrollAfterFocus();
    return true;
}
