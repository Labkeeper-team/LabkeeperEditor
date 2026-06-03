import { EditorSelection } from '@codemirror/state';
import { AppDispatch } from '../../../../../store';
import { controller } from '../../../../../../main.tsx';
import {
    clearIdeSegmentEditorSelection,
    getIdeSegmentEditorView,
} from './ideSegmentEditorView';

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
