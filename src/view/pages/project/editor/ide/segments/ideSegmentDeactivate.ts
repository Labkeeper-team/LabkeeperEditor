import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { AppDispatch } from '../../../../../store';
import { controller } from '../../../../../../main.tsx';

export function getIdeSegmentEditorView(
    segmentIndex: number
): EditorView | null {
    const dom = document.getElementById(`ide-segment-${segmentIndex}`);
    if (!dom) {
        return null;
    }
    return EditorView.findFromDOM(dom) ?? null;
}

export function clearIdeSegmentEditorSelection(segmentIndex: number): void {
    const view = getIdeSegmentEditorView(segmentIndex);
    if (!view) {
        return;
    }
    const head = view.state.selection.main.head;
    view.dispatch({
        selection: EditorSelection.cursor(head),
    });
}

export function deactivateIdeSegment(
    segmentIndex: number,
    dispatch: AppDispatch
): void {
    clearIdeSegmentEditorSelection(segmentIndex);
    getIdeSegmentEditorView(segmentIndex)?.contentDOM.blur();
    dispatch(
        controller.onBlurSegmentRequest({
            segmentIndex,
        })
    );
}

export function focusIdeSegmentAtPoint(
    segmentIndex: number,
    dispatch: AppDispatch,
    clientX: number,
    clientY: number
): void {
    const view = getIdeSegmentEditorView(segmentIndex);
    if (!view) {
        return;
    }
    const pos = view.posAtCoords({ x: clientX, y: clientY }, false);
    const head = pos ?? view.state.doc.length;
    view.dispatch({
        selection: EditorSelection.cursor(head),
        scrollIntoView: true,
    });
    dispatch(
        controller.onFocusSegmentRequest({
            segmentIndex,
        })
    );
    view.focus();
}

/** Клик в зоне CM ниже последней строки или по gutter (пустая min-height область). */
export function shouldPlaceCursorOnIdeSegmentClick(
    event: MouseEvent,
    target: Element,
    view: EditorView
): boolean {
    if (!view.dom.contains(target)) {
        return true;
    }
    if (target.closest('.cm-gutters')) {
        return true;
    }
    const lines = view.contentDOM.querySelectorAll('.cm-line');
    if (lines.length === 0) {
        return true;
    }
    const lastLine = lines[lines.length - 1] as HTMLElement;
    return event.clientY > lastLine.getBoundingClientRect().bottom + 2;
}

/** Индекс сегмента по клику (редактор или плашка `.editor-rules`). */
export function getIdeSegmentIndexFromTarget(target: Element): number | null {
    const container = target.closest('.segment-editor-container');
    if (!container) {
        return null;
    }
    const cmHost = container.querySelector('[id^="ide-segment-"]');
    if (!(cmHost instanceof HTMLElement)) {
        return null;
    }
    const segmentIndex = Number.parseInt(
        cmHost.id.replace('ide-segment-', ''),
        10
    );
    return Number.isNaN(segmentIndex) ? null : segmentIndex;
}

/** Клик вне любого сегмента: footer/header LaTeX, divider, padding контейнера. */
export function isClickOutsideAllIdeSegments(target: Element): boolean {
    if (target.closest('.segment-editor-container')) {
        return false;
    }
    if (
        target.closest(
            '.latex-header-segment, .latex-footer-segment, .segment-divider'
        )
    ) {
        return true;
    }
    return target.closest('#segments-container') !== null;
}

