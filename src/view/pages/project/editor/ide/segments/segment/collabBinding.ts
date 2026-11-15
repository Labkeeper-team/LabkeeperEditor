import {
    Annotation,
    ChangeSet,
    EditorState,
    type Extension,
    type Range,
    StateEffect,
    StateField,
    Text,
    Transaction,
} from '@codemirror/state';
import {
    Decoration,
    type DecorationSet,
    EditorView,
    ViewPlugin,
    type ViewUpdate,
    WidgetType,
} from '@codemirror/view';
import { ExternalChange } from '@uiw/react-codemirror';
import type {
    CollabDocChange,
    RemoteCursor,
} from '../../../../../../../viewModel/domain/collab/CollabDocumentClient.ts';
import type {
    CollabForwardResult,
    CollabViewSink,
} from '../../../../../../../viewModel/domain/collab/CollabService.ts';
import type { CollabSelection } from '../../../../../../../model/rpi/collabSocket.ts';

/** What the binding needs from CollabService */
export interface CollabBindingService {
    attachView: (sink: CollabViewSink) => () => void;
    forwardViewChanges: (
        key: string,
        index: number,
        changes: ChangeSet,
        startDoc: Text
    ) => CollabForwardResult;
    reportSelection: (key: string, selection: CollabSelection | null) => void;
    cursorsForKey: (key: string) => RemoteCursor[];
    docForKey: (key: string) => Text | null;
}

/** Marks transactions that carry changes from the collaboration session */
export const collabRemote = Annotation.define<boolean>();

const setRemoteCursors = StateEffect.define<RemoteCursor[]>();

/** Hex `#rrggbb` with alpha for the selection highlight */
function withAlpha(color: string, alpha: string): string {
    return /^#[0-9a-fA-F]{6}$/.test(color) ? `${color}${alpha}` : color;
}

class RemoteCaretWidget extends WidgetType {
    constructor(
        private color: string,
        private name: string,
        private below: boolean
    ) {
        super();
    }

    eq(other: RemoteCaretWidget): boolean {
        return (
            other.color === this.color &&
            other.name === this.name &&
            other.below === this.below
        );
    }

    toDOM(): HTMLElement {
        const caret = document.createElement('span');
        caret.className = 'cm-collab-caret';
        caret.style.borderLeftColor = this.color;
        caret.setAttribute('aria-hidden', 'true');
        caret.setAttribute('data-collab-name', this.name);
        const label = document.createElement('span');
        label.className = this.below
            ? 'cm-collab-caret-label cm-collab-caret-label--below'
            : 'cm-collab-caret-label';
        label.style.backgroundColor = this.color;
        label.textContent = this.name;
        caret.appendChild(label);
        return caret;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

interface RemoteCursorsValue {
    cursors: RemoteCursor[];
    decorations: DecorationSet;
}

function buildDecorations(cursors: RemoteCursor[], doc: Text): DecorationSet {
    if (!cursors.length) {
        return Decoration.none;
    }
    const length = doc.length;
    const ranges: Range<Decoration>[] = [];
    for (const cursor of cursors) {
        const anchor = Math.max(0, Math.min(cursor.anchor, length));
        const head = Math.max(0, Math.min(cursor.head, length));
        const from = Math.min(anchor, head);
        const to = Math.max(anchor, head);
        if (from < to) {
            ranges.push(
                Decoration.mark({
                    class: 'cm-collab-selection',
                    attributes: {
                        style: `background-color: ${withAlpha(cursor.color, '33')}`,
                    },
                }).range(from, to)
            );
        }
        // on the first line the name goes under the caret, above it would be cut off
        const below = doc.lineAt(head).number === 1;
        ranges.push(
            Decoration.widget({
                widget: new RemoteCaretWidget(
                    cursor.color,
                    cursor.displayName,
                    below
                ),
                side: 1,
            }).range(head)
        );
    }
    return Decoration.set(ranges, true);
}

const remoteCursorsField = StateField.define<RemoteCursorsValue>({
    create: () => ({ cursors: [], decorations: Decoration.none }),
    update(value, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setRemoteCursors)) {
                return {
                    cursors: effect.value,
                    decorations: buildDecorations(effect.value, tr.state.doc),
                };
            }
        }
        if (!tr.docChanged || !value.cursors.length) {
            return value;
        }
        // until the session sends fresh positions the carets stay at the same text
        const cursors = value.cursors.map((cursor) => ({
            ...cursor,
            anchor: tr.changes.mapPos(cursor.anchor, -1),
            head: tr.changes.mapPos(cursor.head, -1),
        }));
        return {
            cursors,
            decorations: buildDecorations(cursors, tr.state.doc),
        };
    },
    provide: (field) =>
        EditorView.decorations.from(field, (value) => value.decorations),
});

const remoteCursorsTheme = EditorView.baseTheme({
    '.cm-collab-caret': {
        position: 'relative',
        display: 'inline',
        borderLeft: '2px solid',
        marginLeft: '-1px',
        marginRight: '-1px',
        pointerEvents: 'none',
        wordBreak: 'normal',
    },
    '.cm-collab-caret-label': {
        position: 'absolute',
        left: '-2px',
        bottom: '100%',
        padding: '0 4px',
        borderRadius: '3px 3px 3px 0',
        color: '#ffffff',
        fontSize: '10px',
        lineHeight: '14px',
        fontFamily: 'sans-serif',
        fontWeight: '600',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        userSelect: 'none',
        zIndex: '5',
        opacity: '0.92',
    },
    '.cm-collab-caret-label--below': {
        bottom: 'auto',
        top: '100%',
        borderRadius: '0 3px 3px 3px',
    },
});

const remoteAnnotations = [
    collabRemote.of(true),
    // the editor's onChange skips external changes: remote text is already in Redux
    ExternalChange.of(true),
    Transaction.addToHistory.of(false),
    Transaction.remote.of(true),
];

function dispatchSafely(run: () => void): void {
    try {
        run();
    } catch {
        // the view is in the middle of an update: apply right after it
        queueMicrotask(() => {
            try {
                run();
            } catch {
                /* the view is gone */
            }
        });
    }
}

/**
 * Binds a segment editor view to the collaboration session: local transactions go to
 * the headless document of the segment, remote changes and remote carets come back as
 * transactions annotated with `collabRemote` (and `ExternalChange`, so the editor's
 * onChange does not send them to Redux a second time).
 *
 * `getKey` is the stable key of the segment the view shows; undefined while the session
 * is off, then the binding does nothing.
 */
export function collabBinding(
    service: CollabBindingService,
    getKey: () => string | undefined,
    getIndex: () => number
): Extension {
    const plugin = ViewPlugin.fromClass(
        class {
            private detach: () => void;

            constructor(private view: EditorView) {
                this.detach = service.attachView({
                    key: () => getKey() ?? '',
                    applyRemote: (change, cursors) =>
                        this.applyRemote(change, cursors),
                    setCursors: (cursors, doc) => this.setCursors(cursors, doc),
                    selection: () => {
                        if (!this.view.hasFocus) {
                            return null;
                        }
                        const main = this.view.state.selection.main;
                        return { anchor: main.anchor, head: main.head };
                    },
                });
            }

            update(update: ViewUpdate): void {
                const key = getKey();
                if (!key) {
                    return;
                }
                let externalReplace = false;
                for (const tr of update.transactions) {
                    if (!tr.docChanged || tr.annotation(collabRemote)) {
                        continue;
                    }
                    if (tr.annotation(ExternalChange)) {
                        // the controlled value replaced the text: it came from Redux, and
                        // Redux texts reach the session through ProgramEditorService
                        externalReplace = true;
                        continue;
                    }
                    const result = service.forwardViewChanges(
                        key,
                        getIndex(),
                        tr.changes,
                        tr.startState.doc
                    );
                    if (result === 'stale') {
                        // the edit was dropped: show the document as it is, or the view
                        // would keep a text nobody else has and drop every next keystroke
                        queueMicrotask(() => this.resyncWithDocument(key));
                    }
                }
                if (externalReplace) {
                    // carets were mapped through a whole-text replacement: take fresh ones
                    queueMicrotask(() => {
                        const doc = service.docForKey(key);
                        if (doc) {
                            this.setCursors(service.cursorsForKey(key), doc);
                        }
                    });
                }
                if (
                    update.selectionSet ||
                    update.focusChanged ||
                    update.docChanged
                ) {
                    if (this.view.hasFocus) {
                        const main = update.state.selection.main;
                        service.reportSelection(key, {
                            anchor: main.anchor,
                            head: main.head,
                        });
                    } else if (update.focusChanged) {
                        service.reportSelection(key, null);
                    }
                }
            }

            destroy(): void {
                this.detach();
            }

            private applyRemote(
                change: CollabDocChange,
                cursors: RemoteCursor[]
            ): void {
                const view = this.view;
                dispatchSafely(() => {
                    const doc = view.state.doc;
                    if (doc.eq(change.before)) {
                        view.dispatch({
                            changes: change.changes,
                            effects: setRemoteCursors.of(cursors),
                            annotations: remoteAnnotations,
                        });
                    } else if (!doc.eq(change.after)) {
                        // the view showed something else: show the document as it is now
                        view.dispatch({
                            changes: {
                                from: 0,
                                to: doc.length,
                                insert: change.after,
                            },
                            effects: setRemoteCursors.of(cursors),
                            annotations: remoteAnnotations,
                        });
                    } else {
                        view.dispatch({
                            effects: setRemoteCursors.of(cursors),
                        });
                    }
                });
            }

            private resyncWithDocument(key: string): void {
                const doc = service.docForKey(key);
                const view = this.view;
                if (!doc || view.state.doc.eq(doc)) {
                    return;
                }
                dispatchSafely(() =>
                    view.dispatch({
                        changes: {
                            from: 0,
                            to: view.state.doc.length,
                            insert: doc,
                        },
                        effects: setRemoteCursors.of(
                            service.cursorsForKey(key)
                        ),
                        annotations: remoteAnnotations,
                    })
                );
            }

            private setCursors(cursors: RemoteCursor[], doc: Text): void {
                const view = this.view;
                if (!view.state.doc.eq(doc)) {
                    return;
                }
                const current = view.state.field(remoteCursorsField, false);
                if (current && !current.cursors.length && !cursors.length) {
                    return;
                }
                dispatchSafely(() =>
                    view.dispatch({ effects: setRemoteCursors.of(cursors) })
                );
            }
        }
    );
    return [remoteCursorsField, remoteCursorsTheme, plugin];
}

/** Remote carets the view shows now (tests and debugging) */
export function remoteCursorsOf(state: EditorState): RemoteCursor[] {
    return state.field(remoteCursorsField, false)?.cursors ?? [];
}
