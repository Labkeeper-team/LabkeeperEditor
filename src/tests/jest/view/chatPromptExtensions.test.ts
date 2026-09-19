import { EditorState, Transaction, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
    externalValueWrite,
    promptEditorExtensions,
} from '../../../view/pages/project/viewer/chat/promptEditorExtensions.ts';

const PLACEHOLDER = 'Опишите, что сделать с проектом';

const views: EditorView[] = [];
let escaped: KeyboardEvent[] = [];

const listener = (event: Event) => {
    escaped.push(event as KeyboardEvent);
};

beforeEach(() => {
    escaped = [];
    document.addEventListener('keydown', listener);
});

afterEach(() => {
    document.removeEventListener('keydown', listener);
    views.splice(0).forEach((view) => view.destroy());
});

const promptView = (onSubmit: () => void = () => {}, extra: Extension = []) => {
    const view = new EditorView({
        state: EditorState.create({
            doc: '',
            extensions: [
                promptEditorExtensions({ label: PLACEHOLDER, onSubmit }),
                extra,
            ],
        }),
        parent: document.body,
    });
    views.push(view);
    return view;
};

// курсор двигаем вместе с текстом: иначе Shift+Enter перенесёт строку не там, где набирали
const type = (view: EditorView, text: string, at = Date.now()) =>
    view.dispatch({
        changes: { from: view.state.doc.length, insert: text },
        selection: { anchor: view.state.doc.length + text.length },
        userEvent: 'input.type',
        annotations: Transaction.time.of(at),
    });

const press = (view: EditorView, init: KeyboardEventInit) =>
    view.contentDOM.dispatchEvent(
        new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            ...init,
        })
    );

const undoKey: KeyboardEventInit = {
    key: 'z',
    code: 'KeyZ',
    keyCode: 90,
    ctrlKey: true,
};

// повтор шапка слушает двумя сочетаниями сразу, поле обязано перехватывать оба
const redoKeys: [string, KeyboardEventInit][] = [
    ['Ctrl+Y', { key: 'y', code: 'KeyY', keyCode: 89, ctrlKey: true }],
    [
        'Ctrl+Shift+Z',
        { key: 'Z', code: 'KeyZ', keyCode: 90, ctrlKey: true, shiftKey: true },
    ],
];

test('отмена в поле чата откатывает поле и не уходит к откату проекта', () => {
    const view = promptView();
    type(view, 'привет мир');

    press(view, undoKey);

    expect(view.state.doc.toString()).toBe('');
    // глобальный mod+z редактора слушает document, туда событие дойти не должно
    expect(escaped).toHaveLength(0);
});

test.each(redoKeys)(
    'повтор по %s возвращает текст и не уходит к повтору проекта',
    (_name, redoKey) => {
        const view = promptView();
        type(view, 'привет мир');
        press(view, undoKey);
        expect(view.state.doc.toString()).toBe('');

        press(view, redoKey);

        expect(view.state.doc.toString()).toBe('привет мир');
        // глобальный ctrl+y и mod+shift+z слушают document, туда события дойти не должны
        expect(escaped).toHaveLength(0);
    }
);

test('отмена не всплывает и при пустой истории', () => {
    const view = promptView();

    press(view, undoKey);

    expect(view.state.doc.toString()).toBe('');
    expect(escaped).toHaveLength(0);
});

test('очистка поля после отправки не возвращается отменой', () => {
    const view = promptView();
    // соседние правки история склеивает в одно событие, поэтому набираем с паузой
    type(view, 'сделай ', Date.now() - 1000);
    type(view, 'таблицу');
    // так @uiw пишет значение снаружи, этим же путём идёт очистка при отправке
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: '' },
        annotations: externalValueWrite.of(true),
    });

    press(view, undoKey);

    expect(view.state.doc.toString()).toBe('');
});

test('Enter отправляет, Shift+Enter переносит строку', () => {
    const submits: string[] = [];
    const view = promptView(() => submits.push(view.state.doc.toString()));
    type(view, 'строка');

    press(view, { key: 'Enter', code: 'Enter', keyCode: 13 });

    expect(submits).toEqual(['строка']);
    expect(view.state.doc.toString()).toBe('строка');

    press(view, { key: 'Enter', code: 'Enter', keyCode: 13, shiftKey: true });

    expect(submits).toEqual(['строка']);
    expect(view.state.doc.toString()).toBe('строка\n');
});

test('Enter не отправляет пустой запрос и запрос во время прогона', () => {
    const submits: string[] = [];
    const empty = promptView(() => submits.push('empty'));

    press(empty, { key: 'Enter', code: 'Enter', keyCode: 13 });

    expect(submits).toEqual([]);

    const running = promptView(
        () => submits.push('running'),
        EditorState.readOnly.of(true)
    );
    type(running, 'запрос');

    press(running, { key: 'Enter', code: 'Enter', keyCode: 13 });

    expect(submits).toEqual([]);
    // Enter всё равно съеден, переноса строки в поле не появилось
    expect(running.state.doc.toString()).toBe('запрос');
});

test('стандартная раскладка на месте: Ctrl+A выделяет весь текст', () => {
    const view = promptView();
    type(view, 'весь текст');

    press(view, { key: 'a', code: 'KeyA', keyCode: 65, ctrlKey: true });

    expect(view.state.selection.main.from).toBe(0);
    expect(view.state.selection.main.to).toBe(view.state.doc.length);
});

test('поле ищется по плейсхолдеру, названо и проверяет орфографию', () => {
    const view = promptView();

    expect(view.contentDOM.getAttribute('placeholder')).toBe(PLACEHOLDER);
    expect(view.contentDOM.getAttribute('aria-label')).toBe(PLACEHOLDER);
    expect(view.contentDOM.getAttribute('spellcheck')).toBe('true');
});
