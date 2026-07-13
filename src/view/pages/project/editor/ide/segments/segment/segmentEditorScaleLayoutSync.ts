import { EditorView } from '@codemirror/view';
import { syncCodeMirrorLayout } from '../../../../../../utils/refreshCodeMirrorLayout';

function mobileScaleFactor(): number {
    const k =
        +document.documentElement.style.getPropertyValue('--mobile-scale') || 1;
    return k > 0 ? k : 1;
}

/** Перед кликом обновить scaleX/scaleY CM после CSS scale на ScaleWrapper. */
export const segmentEditorScaleLayoutSync = EditorView.domEventHandlers({
    mousedown(_event, view) {
        if (mobileScaleFactor() < 0.995) {
            syncCodeMirrorLayout(view);
        }
        return false;
    },
});
