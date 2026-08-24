import { EditorSelection } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { resetLockedViewportScrollAfterFocus } from '../../../../../utils/resetLockedViewportScroll';
import { SegmentsViewportAnchor } from '../../../../../../viewModel/repository';

const SEGMENTS_CONTAINER_ID = 'segments-container';
const SEGMENTS_CONTAINER_TOP_PADDING_PX = 10;

function getEffectiveScale(): number {
    const scaleFactor =
        +document.documentElement.style.getPropertyValue('--mobile-scale') || 1;
    return scaleFactor > 0 ? scaleFactor : 1;
}

export function getIdeSegmentEditorView(
    segmentIndex: number
): EditorView | null {
    const dom = document.getElementById(`ide-segment-${segmentIndex}`);
    if (!dom) {
        return null;
    }
    return EditorView.findFromDOM(dom) ?? null;
}

/**
 * Прокручивает строку сегмента к верху списка.
 * По умолчанию ещё ставит курсор и фокусирует редактор (SyncTeX, переход по ошибке).
 * С focus: false курсор и фокус не трогаем, это нужно поиску
 */
export function scrollIdeEditorLineToContainerTop(
    segmentIndex: number,
    line: number,
    options?: { focus?: boolean }
): boolean {
    const view = getIdeSegmentEditorView(segmentIndex);
    const segmentsContainer = document.getElementById(SEGMENTS_CONTAINER_ID);
    if (!view || !segmentsContainer) {
        return false;
    }

    const shouldFocus = options?.focus !== false;
    const doc = view.state.doc;
    const lineNumber = Math.max(1, Math.min(line, doc.lines));
    const offset = doc.line(lineNumber).from;

    view.dispatch({
        ...(shouldFocus
            ? { selection: EditorSelection.cursor(offset) }
            : undefined),
        effects: EditorView.scrollIntoView(offset, {
            y: 'start',
            x: 'nearest',
        }),
    });

    const lineCoords = view.coordsAtPos(offset);
    if (lineCoords) {
        const containerRect = segmentsContainer.getBoundingClientRect();
        const lineTopRelativeToContainer =
            (lineCoords.top - containerRect.top) / getEffectiveScale();
        const newScrollTop =
            segmentsContainer.scrollTop +
            lineTopRelativeToContainer -
            SEGMENTS_CONTAINER_TOP_PADDING_PX;

        segmentsContainer.scrollTo({
            top: Math.max(0, newScrollTop),
            behavior: 'auto',
        });
    }

    if (shouldFocus) {
        view.focus();
    }
    // CM в scrollIntoView доходит до body и утаскивает весь документ, фокус тут ни при чём
    resetLockedViewportScrollAfterFocus();
    return true;
}

/**
 * Сегмент и строка у верхнего края видимой области.
 * Нужно поиску: первый Enter идёт к ближайшему совпадению ниже скролла.
 * null, если списка сегментов на странице нет
 */
export function getSegmentsViewportAnchor(): SegmentsViewportAnchor | null {
    const segmentsContainer = document.getElementById(SEGMENTS_CONTAINER_ID);
    if (!segmentsContainer) {
        return null;
    }
    const containerTop = segmentsContainer.getBoundingClientRect().top;
    const segments = segmentsContainer.querySelectorAll(
        '.segment-editor-container'
    );

    for (const segment of segments) {
        const rect = segment.getBoundingClientRect();
        // сегмент целиком выше видимой области
        if (rect.bottom <= containerTop + 1) {
            continue;
        }
        const segmentIndex = getIdeSegmentIndexFromTarget(segment);
        if (segmentIndex === null) {
            continue;
        }
        // начинается ниже верхнего края, значит якорь на первой строке
        if (rect.top >= containerTop) {
            return { segmentIndex, line: 1 };
        }
        // край проходит внутри сегмента, ищем строку под ним
        const view = getIdeSegmentEditorView(segmentIndex);
        if (!view) {
            return { segmentIndex, line: 1 };
        }
        // posAtCoords и getBoundingClientRect в одних координатах, --mobile-scale учитывать не надо
        const position = view.posAtCoords(
            { x: rect.left + 1, y: containerTop },
            false
        );
        return {
            segmentIndex,
            line: view.state.doc.lineAt(
                Math.max(0, Math.min(position, view.state.doc.length))
            ).number,
        };
    }

    return null;
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
