jest.mock('@uiw/react-codemirror', () => {
    const { Annotation } = jest.requireActual('@codemirror/state');
    return { ExternalChange: Annotation.define() };
});

import { ChangeSet, EditorState, Text } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { ExternalChange } from '@uiw/react-codemirror';
import {
    collabBinding,
    CollabBindingService,
    remoteCursorsOf,
} from '../../../view/pages/project/editor/ide/segments/segment/collabBinding.ts';
import type { CollabViewSink } from '../../../viewModel/domain/collab/CollabService.ts';
import type { RemoteCursor } from '../../../viewModel/domain/collab/CollabDocumentClient.ts';

const bob: RemoteCursor = {
    connectionId: 'c-2',
    userId: 2,
    displayName: 'bob',
    color: '#1971c2',
    anchor: 2,
    head: 2,
    frozen: false,
};

function setup(text: string) {
    let sink: CollabViewSink | null = null;
    const forwarded: { changes: ChangeSet; start: Text }[] = [];
    const selections: unknown[] = [];
    const service: CollabBindingService = {
        attachView: (s) => {
            sink = s;
            return () => {
                sink = null;
            };
        },
        forwardViewChanges: (_key, _index, changes, start) => {
            forwarded.push({ changes, start });
            return 'applied';
        },
        reportSelection: (_key, selection) => selections.push(selection),
        cursorsForKey: () => [],
        docForKey: () => null,
    };
    const view = new EditorView({
        state: EditorState.create({
            doc: text,
            extensions: [
                collabBinding(
                    service,
                    () => 'cs-1',
                    () => 0
                ),
            ],
        }),
        parent: document.body,
    });
    return { view, forwarded, selections, sink: () => sink! };
}

test('local typing is forwarded with the text it was made against', () => {
    const { view, forwarded } = setup('hello');
    view.dispatch({ changes: { from: 5, insert: '!' } });
    expect(forwarded).toHaveLength(1);
    expect(forwarded[0].start.toString()).toBe('hello');
    expect(forwarded[0].changes.apply(forwarded[0].start).toString()).toBe(
        'hello!'
    );
});

test('controlled-value replacements and remote changes are not forwarded', () => {
    const { view, forwarded, sink } = setup('hello');
    view.dispatch({
        changes: { from: 0, to: 5, insert: 'other' },
        annotations: [ExternalChange.of(true)],
    });
    const before = view.state.doc;
    const changes = ChangeSet.of({ from: 0, insert: '>' }, before.length);
    sink().applyRemote(
        { changes, before, after: changes.apply(before), remote: true },
        [bob]
    );
    expect(view.state.doc.toString()).toBe('>other');
    expect(forwarded).toHaveLength(0);
});

test('remote carets render with the name and map through local edits', () => {
    const { view, sink } = setup('abcdef');
    sink().setCursors([bob], view.state.doc);
    expect(remoteCursorsOf(view.state)).toHaveLength(1);
    const caret = view.dom.querySelector('.cm-collab-caret') as HTMLElement;
    expect(caret).not.toBeNull();
    expect(caret.textContent).toBe('bob');
    view.dispatch({ changes: { from: 0, insert: 'XY' } });
    expect(remoteCursorsOf(view.state)[0].head).toBe(4);
    sink().setCursors([], view.state.doc);
    expect(view.dom.querySelector('.cm-collab-caret')).toBeNull();
});

test('a remote selection is highlighted', () => {
    const { view, sink } = setup('hello world');
    sink().setCursors([{ ...bob, anchor: 6, head: 11 }], view.state.doc);
    const mark = view.dom.querySelector('.cm-collab-selection') as HTMLElement;
    expect(mark?.textContent).toBe('world');
});

test('cursors for another text are ignored', () => {
    const { view, sink } = setup('abc');
    sink().setCursors([bob], Text.of(['something else']));
    expect(remoteCursorsOf(view.state)).toHaveLength(0);
});
