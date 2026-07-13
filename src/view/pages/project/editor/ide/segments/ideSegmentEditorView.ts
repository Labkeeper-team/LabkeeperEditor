import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';

const SEGMENTS_CONTAINER_ID = 'segments-container';
const SEGMENTS_CONTAINER_TOP_PADDING_PX = 10;

export function getIdeSegmentEditorView(
    segmentIndex: number
): EditorView | null {
    const dom = document.getElementById(`ide-segment-${segmentIndex}`);
    if (!dom) {
        return null;
    }
    return EditorView.findFromDOM(dom) ?? null;
}

/** Ставит курсор на строку и прокручивает её к верху списка сегментов (SyncTeX PDF → editor). */
export function scrollIdeEditorLineToContainerTop(
    segmentIndex: number,
    line: number
): boolean {
    const view = getIdeSegmentEditorView(segmentIndex);
    const segmentsContainer = document.getElementById(SEGMENTS_CONTAINER_ID);
    if (!view || !segmentsContainer) {
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

    const lineCoords = view.coordsAtPos(offset);
    if (lineCoords) {
        const containerRect = segmentsContainer.getBoundingClientRect();
        const scaleFactor =
            +document.documentElement.style.getPropertyValue(
                '--mobile-scale'
            ) || 1;
        const effectiveScale = scaleFactor > 0 ? scaleFactor : 1;
        const lineTopRelativeToContainer =
            (lineCoords.top - containerRect.top) / effectiveScale;
        const newScrollTop =
            segmentsContainer.scrollTop +
            lineTopRelativeToContainer -
            SEGMENTS_CONTAINER_TOP_PADDING_PX;

        segmentsContainer.scrollTo({
            top: Math.max(0, newScrollTop),
            behavior: 'auto',
        });
    }

    view.focus();
    return true;
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
