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
