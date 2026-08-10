import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

export const TEXT_FILE_EDITOR_HOST_ID = 'text-file-editor-host';

export function getTextFileEditorView(): EditorView | null {
    const dom = document.getElementById(TEXT_FILE_EDITOR_HOST_ID);
    if (!dom) {
        return null;
    }
    return EditorView.findFromDOM(dom) ?? null;
}

/** Курсор на строку + прокрутка в текстовом файле (SyncTeX / ошибки). */
export function scrollTextFileEditorLineIntoView(line: number): boolean {
    const view = getTextFileEditorView();
    if (!view) {
        return false;
    }

    const doc = view.state.doc;
    const lineNumber = Math.max(1, Math.min(line, doc.lines));
    const offset = doc.line(lineNumber).from;

    view.dispatch({
        selection: EditorSelection.cursor(offset),
        effects: EditorView.scrollIntoView(offset, {
            y: 'start',
            x: 'nearest',
        }),
    });
    view.focus();
    return true;
}
