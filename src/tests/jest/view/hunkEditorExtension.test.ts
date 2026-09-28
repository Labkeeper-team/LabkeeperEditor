import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import {
    dispatchHunkGroups,
    hunkDecorationsField,
    hunkEditorExtensions,
} from '../../../view/pages/project/editor/hunkEditorExtension.ts';
import { groupHunks } from '../../../viewModel/utils/hunkGrouping.ts';
import { Hunk } from '../../../model/domain.ts';

const highlightedLines = (view: EditorView) => {
    const lines: number[] = [];
    view.state
        .field(hunkDecorationsField)
        .between(0, view.state.doc.length, (from, _to, decoration) => {
            const spec = decoration.spec as { class?: string };
            if (spec.class === 'cm-hunk-added-line') {
                lines.push(view.state.doc.lineAt(from).number);
            }
        });
    return lines;
};

const show = (view: EditorView, hunks: Hunk[]) =>
    dispatchHunkGroups(
        view,
        groupHunks(hunks).map((group) => ({ ...group, acceptLabel: 'Accept' })),
        [],
        true,
        'Reject'
    );

test('highlight follows a hunk that grew under the same id', () => {
    const view = new EditorView({
        state: EditorState.create({
            doc: 'a\nX\nY\nb',
            extensions: hunkEditorExtensions,
        }),
        parent: document.body,
    });
    const hunk: Hunk = {
        id: 'same',
        type: 'addLinesToSegment',
        segmentId: 1,
        startLine: 2,
        endLine: 2,
        text: 'X',
    };
    show(view, [hunk]);
    expect(highlightedLines(view)).toEqual([2]);

    // вторую строку сервер дописал в тот же hunk
    show(view, [{ ...hunk, endLine: 3, text: 'X\nY' }]);

    expect(highlightedLines(view)).toEqual([2, 3]);
    view.destroy();
});

test('highlight follows a hunk that grew upwards under the same id', () => {
    const view = new EditorView({
        state: EditorState.create({
            doc: 'a\nX\nY\nb',
            extensions: hunkEditorExtensions,
        }),
        parent: document.body,
    });
    const hunk: Hunk = {
        id: 'same',
        type: 'addLinesToSegment',
        segmentId: 1,
        startLine: 3,
        endLine: 3,
        text: 'Y',
    };
    show(view, [hunk]);

    show(view, [{ ...hunk, startLine: 2, text: 'X\nY' }]);

    expect(highlightedLines(view)).toEqual([2, 3]);
    view.destroy();
});

test('deleted lines follow a hunk whose removed text changed', () => {
    const view = new EditorView({
        state: EditorState.create({
            doc: 'a\nb',
            extensions: hunkEditorExtensions,
        }),
        parent: document.body,
    });
    const hunk: Hunk = {
        id: 'same',
        type: 'deleteLinesFromSegment',
        segmentId: 1,
        startLine: 2,
        endLine: 2,
        text: 'первая',
    };
    show(view, [hunk]);

    show(view, [{ ...hunk, text: 'вторая' }]);

    const deleted = [...view.dom.querySelectorAll('.cm-hunk-deleted-line')];
    expect(deleted.map((line) => line.textContent)).toEqual(['вторая']);
    view.destroy();
});

const replaceWholeDocument = (view: EditorView, doc: string) =>
    view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: doc },
    });

test('highlight appears when a delete turns into a replace under the same id', () => {
    const view = new EditorView({
        state: EditorState.create({
            doc: 'a\nb',
            extensions: hunkEditorExtensions,
        }),
        parent: document.body,
    });
    const hunk: Hunk = {
        id: 'same',
        type: 'deleteLinesFromSegment',
        segmentId: 1,
        startLine: 2,
        endLine: 2,
        text: 'X',
    };
    show(view, [hunk]);

    // агент вставил строку на место удалённой, сервер слил обе правки в замену под id удаления
    replaceWholeDocument(view, 'a\nY\nb');
    show(view, [{ ...hunk, type: 'replaceTextInSegment' }]);

    expect(highlightedLines(view)).toEqual([2]);
    const deleted = [...view.dom.querySelectorAll('.cm-hunk-deleted-line')];
    expect(deleted.map((line) => line.textContent)).toEqual(['X']);
    view.destroy();
});

test('highlight leaves the line when a replace turns into a delete under the same id', () => {
    const view = new EditorView({
        state: EditorState.create({
            doc: 'a\nY\nb',
            extensions: hunkEditorExtensions,
        }),
        parent: document.body,
    });
    const hunk: Hunk = {
        id: 'same',
        type: 'replaceTextInSegment',
        segmentId: 1,
        startLine: 2,
        endLine: 2,
        text: 'X',
    };
    show(view, [hunk]);
    expect(highlightedLines(view)).toEqual([2]);

    // агент удалил новую строку замены, и от hunk осталось удаление старой
    replaceWholeDocument(view, 'a\nb');
    show(view, [{ ...hunk, type: 'deleteLinesFromSegment' }]);

    expect(highlightedLines(view)).toEqual([]);
    const deleted = [...view.dom.querySelectorAll('.cm-hunk-deleted-line')];
    expect(deleted.map((line) => line.textContent)).toEqual(['X']);
    view.destroy();
});

/** Строки редактора сверху вниз: « » обычная, «+» зелёная, «-» призрак старой, [..] кнопки */
const renderedRows = (view: EditorView) =>
    [...view.contentDOM.children].flatMap((node) => {
        if (node.classList.contains('cm-line')) {
            const mark = node.classList.contains('cm-hunk-added-line')
                ? '+'
                : ' ';
            return [`${mark}${node.textContent}`];
        }
        if (node.classList.contains('cm-hunk-deleted-wrap')) {
            // пустая старая строка рисуется пробелом, иначе у неё не было бы высоты
            return [...node.querySelectorAll('.cm-hunk-deleted-line')].map(
                (line) => `-${line.textContent === ' ' ? '' : line.textContent}`
            );
        }
        if (node.classList.contains('cm-hunk-controls-host')) {
            const buttons = [...node.querySelectorAll('button')].map(
                (button) => button.textContent
            );
            return [`[${buttons.join('|')}]`];
        }
        return [];
    });

const replaceEditor = (doc: string) =>
    new EditorView({
        state: EditorState.create({ doc, extensions: hunkEditorExtensions }),
        parent: document.body,
    });

test('replaced lines stand above the new ones with one pair of buttons after them', () => {
    const view = replaceEditor('intro\nRow one.\n\nRow three.\nomega');

    show(view, [
        {
            id: 'replace',
            type: 'replaceTextInSegment',
            segmentId: 1,
            startLine: 2,
            endLine: 4,
            text: 'Second paragraph line.\nThird paragraph line.',
        },
    ]);

    expect(renderedRows(view)).toEqual([
        ' intro',
        '-Second paragraph line.',
        '-Third paragraph line.',
        '+Row one.',
        '+',
        '+Row three.',
        '[Accept|Reject]',
        ' omega',
    ]);
    view.destroy();
});

test('replaced blank line after the last line break is shown with the others', () => {
    // файл потерял завершающий перевод строки: старых строк на одну больше, и последняя пустая
    const view = replaceEditor('one\nNEW A\nNEW B');

    show(view, [
        {
            id: 'replace',
            type: 'replaceTextInFile',
            fileName: 'notes.txt',
            startLine: 2,
            endLine: 3,
            text: 'old A\nold B\n',
        },
    ]);

    expect(renderedRows(view)).toEqual([
        ' one',
        '-old A',
        '-old B',
        '-',
        '+NEW A',
        '+NEW B',
        '[Accept|Reject]',
    ]);
    view.destroy();
});

test('replaced blank line is shown as an empty old line', () => {
    const view = replaceEditor('intro\nFilled line.\nomega');

    show(view, [
        {
            id: 'replace',
            type: 'replaceTextInSegment',
            segmentId: 1,
            startLine: 2,
            endLine: 2,
            text: '',
        },
    ]);

    expect(renderedRows(view)).toEqual([
        ' intro',
        '-',
        '+Filled line.',
        '[Accept|Reject]',
        ' omega',
    ]);
    view.destroy();
});
