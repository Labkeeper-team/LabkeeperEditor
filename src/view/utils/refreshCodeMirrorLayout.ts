import { EditorView } from '@codemirror/view';

/** После CSS scale (ScaleWrapper) CM не всегда пересчитывает scaleX/scaleY — клики попадают не туда. */
export function refreshCodeMirrorLayout(): void {
    requestAnimationFrame(() => {
        document.querySelectorAll('.cm-editor').forEach((dom) => {
            const view = EditorView.findFromDOM(dom);
            view?.requestMeasure();
        });
    });
}

export function syncCodeMirrorLayout(view: EditorView): void {
    view.requestMeasure();
    view.readMeasured();
}
