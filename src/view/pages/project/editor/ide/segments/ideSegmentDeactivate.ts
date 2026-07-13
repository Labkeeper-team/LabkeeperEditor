import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { AppDispatch } from '../../../../../store';
import { controller } from '../../../../../../main.tsx';
import { syncCodeMirrorLayout } from '../../../../../utils/refreshCodeMirrorLayout';
import {
    clearIdeSegmentEditorSelection,
    getIdeSegmentEditorView,
} from './ideSegmentEditorView';

function isBelowLastVisibleLine(view: EditorView, clientY: number): boolean {
    const lines = view.contentDOM.querySelectorAll('.cm-line');
    if (lines.length === 0) {
        return false;
    }
    const lastLine = lines[lines.length - 1] as HTMLElement;
    return clientY > lastLine.getBoundingClientRect().bottom + 2;
}

export {
    clearIdeSegmentEditorSelection,
    getIdeSegmentEditorView,
    getIdeSegmentIndexFromTarget,
    isClickOutsideAllIdeSegments,
    shouldPlaceCursorOnIdeSegmentClick,
} from './ideSegmentEditorView';

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
    syncCodeMirrorLayout(view);
    const head = isBelowLastVisibleLine(view, clientY)
        ? view.state.doc.length
        : (view.posAtCoords({ x: clientX, y: clientY }, false) ??
          view.state.doc.length);
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
