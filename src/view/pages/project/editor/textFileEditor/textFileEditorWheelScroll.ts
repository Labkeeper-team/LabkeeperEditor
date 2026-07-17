import { EditorView } from '@codemirror/view';

const wheelDeltaY = (event: WheelEvent): number => {
    switch (event.deltaMode) {
        case WheelEvent.DOM_DELTA_LINE:
            return event.deltaY * 20;
        case WheelEvent.DOM_DELTA_PAGE:
            return event.deltaY * (event.view?.innerHeight ?? 400);
        default:
            return event.deltaY;
    }
};

/** Явный scrollTop: нативный wheel на .cm-scroller в плавающей панели часто не срабатывает. */
export const textFileEditorWheelScroll = EditorView.domEventHandlers({
    wheel(event, view) {
        const scroller = view.scrollDOM;
        const deltaY = wheelDeltaY(event);
        if (!deltaY) {
            return false;
        }

        const maxScroll = scroller.scrollHeight - scroller.clientHeight;
        if (maxScroll <= 0) {
            return false;
        }

        const prevTop = scroller.scrollTop;
        const nextTop = Math.min(Math.max(prevTop + deltaY, 0), maxScroll);
        if (nextTop === prevTop) {
            return false;
        }

        scroller.scrollTop = nextTop;
        event.preventDefault();
        return true;
    },
});
