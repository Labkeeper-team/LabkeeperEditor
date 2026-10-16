import { EditorView } from '@codemirror/view';
import { getIdeSegmentEditorView } from '../editor/ide/segments/ideSegmentEditorView.ts';

export const SEARCH_INPUT_ID = 'project-search-input';

// панель или редактор появляются после рендера, а в новом сегменте ещё и после сохранения
const MAX_FRAMES = 60;

/** Ждёт, пока элемент появится, и отдаёт его действию. Не дождался за секунду, молча выходит */
const whenReady = <T>(find: () => T | null, act: (found: T) => void) => {
    let frames = 0;
    const attempt = () => {
        const found = find();
        if (found) {
            act(found);
            return;
        }
        frames += 1;
        if (frames < MAX_FRAMES) {
            requestAnimationFrame(attempt);
        }
    };
    attempt();
};

export const focusSearchInput = () =>
    whenReady(
        () => {
            const input = document.getElementById(SEARCH_INPUT_ID);
            // поле в дереве всегда, но пока поиск закрыт, оно спрятано и фокус не примет
            return input instanceof HTMLInputElement && input.offsetParent
                ? input
                : null;
        },
        (input) => {
            input.focus();
            // как в поиске браузера: повторный Ctrl+F выделяет запрос, чтобы набрать новый
            input.select();
        }
    );

/** Каретка остаётся, где её оставили, в нетронутом сегменте она в начале текста */
export const focusSegmentEditor = (segmentIndex: number) =>
    whenReady(
        () => getIdeSegmentEditorView(segmentIndex),
        (view) => {
            view.focus();
            view.dispatch({
                effects: EditorView.scrollIntoView(
                    view.state.selection.main.head,
                    { y: 'nearest' }
                ),
            });
        }
    );

/** Курсор в конец текста: после «отправить ошибки» дописывают к подставленному */
export const focusChatPrompt = (expectedText?: string) =>
    whenReady(
        () => {
            const dom = document.querySelector('#agent-chat-field .cm-editor');
            const view =
                dom instanceof HTMLElement && EditorView.findFromDOM(dom);
            if (!view) {
                return null;
            }
            // текст из store доезжает в CodeMirror эффектом, ждём его, иначе конец будет старый
            if (
                expectedText !== undefined &&
                view.state.doc.toString() !== expectedText
            ) {
                return null;
            }
            return view;
        },
        (view) => {
            view.focus();
            view.dispatch({
                selection: { anchor: view.state.doc.length },
                scrollIntoView: true,
            });
        }
    );

export const focusResultPanel = () =>
    whenReady(
        () => {
            const pane = document.querySelector('.viewer-pane:not([hidden])');
            // прокручивается сам документ, а не колонка вокруг него; до сборки есть только колонка
            return (
                pane?.querySelector<HTMLElement>(
                    '.pdf-result-scroll, #compile-result'
                ) ??
                pane?.querySelector<HTMLElement>('.result-container') ??
                null
            );
        },
        (panel) => {
            // tabIndex ставим здесь, а не в разметке: панель не входит в обход Tab, а снимки вывода не меняются
            if (!panel.hasAttribute('tabindex')) {
                panel.tabIndex = -1;
            }
            // фокус на прокручиваемой панели: стрелки и PageDown листают документ
            panel.focus({ preventScroll: true });
        }
    );
