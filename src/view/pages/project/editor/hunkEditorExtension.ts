import {
    Decoration,
    EditorView,
    WidgetType,
    type DecorationSet,
} from '@codemirror/view';
import {
    EditorState,
    StateEffect,
    StateField,
    type Extension,
} from '@codemirror/state';
import type { HunkGroup } from '../../../../viewModel/utils/hunkGrouping.ts';
import { resolveControlsLine } from '../../../../viewModel/utils/hunkGrouping.ts';
import { colors } from '../../../styles/colors';

export type HunkEditorAction = 'accept' | 'revert';

export type HunkActionPayload = {
    action: HunkEditorAction;
    hunkIds: string[];
};

export type HunkGroupView = HunkGroup & {
    acceptLabel: string;
};

let hunkActionHandler: ((payload: HunkActionPayload) => void) | null = null;

export function setHunkActionHandler(
    handler: ((payload: HunkActionPayload) => void) | null
): void {
    hunkActionHandler = handler;
}

export const setHunkGroupsEffect = StateEffect.define<{
    groups: HunkGroupView[];
    pendingHunkIds: Set<string>;
    canRevert: boolean;
    revertLabel: string;
}>();

function createHunkSpinner(className: string): HTMLSpanElement {
    const spinner = document.createElement('span');
    spinner.className = className;
    spinner.setAttribute('aria-hidden', 'true');
    return spinner;
}

function createHunkButton(
    className: string,
    label: string,
    disabled: boolean,
    loading: boolean,
    spinnerClassName: string,
    onClick: () => void
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.disabled = disabled;
    if (loading) {
        button.classList.add('cm-hunk-btn--loading');
        button.appendChild(createHunkSpinner(spinnerClassName));
    } else {
        button.textContent = label;
        button.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            onClick();
        });
    }
    return button;
}

class HunkControlsWidget extends WidgetType {
    constructor(
        private readonly hunkIds: string[],
        private readonly pending: boolean,
        private readonly canRevert: boolean,
        private readonly acceptLabel: string,
        private readonly revertLabel: string
    ) {
        super();
    }

    eq(other: WidgetType): boolean {
        if (!(other instanceof HunkControlsWidget)) {
            return false;
        }
        return (
            other.pending === this.pending &&
            other.canRevert === this.canRevert &&
            other.acceptLabel === this.acceptLabel &&
            other.revertLabel === this.revertLabel &&
            other.hunkIds.join(',') === this.hunkIds.join(',')
        );
    }

    compare(other: WidgetType): number {
        if (other instanceof HunkControlsWidget) {
            return this.hunkIds.join(',').localeCompare(other.hunkIds.join(','));
        }
        if (other instanceof DeletedLinesWidget) {
            return 1;
        }
        if (other instanceof AddedLinesWidget) {
            return 1;
        }
        return 0;
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement('div');
        wrap.className = 'cm-hunk-controls';
        wrap.contentEditable = 'false';

        wrap.appendChild(
            createHunkButton(
                'cm-hunk-btn cm-hunk-btn--accept',
                this.acceptLabel,
                this.pending,
                this.pending,
                'cm-hunk-btn__spinner cm-hunk-btn__spinner--accept',
                () =>
                    hunkActionHandler?.({
                        action: 'accept',
                        hunkIds: this.hunkIds,
                    })
            )
        );

        if (this.canRevert) {
            wrap.appendChild(
                createHunkButton(
                    'cm-hunk-btn cm-hunk-btn--revert',
                    this.revertLabel,
                    this.pending,
                    this.pending,
                    'cm-hunk-btn__spinner cm-hunk-btn__spinner--revert',
                    () =>
                        hunkActionHandler?.({
                            action: 'revert',
                            hunkIds: this.hunkIds,
                        })
                )
            );
        }

        return wrap;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

class DeletedLinesWidget extends WidgetType {
    constructor(private readonly lines: string[]) {
        super();
    }

    eq(other: WidgetType): boolean {
        if (!(other instanceof DeletedLinesWidget)) {
            return false;
        }
        return other.lines.join('\n') === this.lines.join('\n');
    }

    compare(other: WidgetType): number {
        if (other instanceof DeletedLinesWidget) {
            return this.lines.join('\n').localeCompare(other.lines.join('\n'));
        }
        return -1;
    }

    toDOM(): HTMLElement {
        const block = document.createElement('div');
        block.className = 'cm-hunk-deleted-block';
        block.contentEditable = 'false';
        for (const line of this.lines) {
            const row = document.createElement('div');
            row.className = 'cm-hunk-deleted-line';
            row.textContent = line.length > 0 ? line : ' ';
            block.appendChild(row);
        }
        return block;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

class AddedLinesWidget extends WidgetType {
    constructor(private readonly lines: string[]) {
        super();
    }

    eq(other: WidgetType): boolean {
        if (!(other instanceof AddedLinesWidget)) {
            return false;
        }
        return other.lines.join('\n') === this.lines.join('\n');
    }

    compare(other: WidgetType): number {
        if (other instanceof AddedLinesWidget) {
            return this.lines.join('\n').localeCompare(other.lines.join('\n'));
        }
        if (other instanceof DeletedLinesWidget) {
            return 1;
        }
        if (other instanceof HunkControlsWidget) {
            return -1;
        }
        return 0;
    }

    toDOM(): HTMLElement {
        const block = document.createElement('div');
        block.className = 'cm-hunk-added-block';
        block.contentEditable = 'false';
        for (const line of this.lines) {
            const row = document.createElement('div');
            row.className = 'cm-hunk-added-line-ghost';
            row.textContent = line.length > 0 ? line : ' ';
            block.appendChild(row);
        }
        return block;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

function documentLinesMatchHunkText(
    state: EditorState,
    range: { startLine: number; endLine: number },
    text: string | undefined
): boolean {
    if (!text) {
        return true;
    }
    const expected = text.split('\n');
    const actual: string[] = [];
    for (
        let lineNo = range.startLine;
        lineNo <= range.endLine && lineNo <= state.doc.lines;
        lineNo++
    ) {
        actual.push(state.doc.line(lineNo).text);
    }
    if (expected.length !== actual.length) {
        return false;
    }
    return expected.every((line, index) => line === actual[index]);
}

function clampDocLine(line: number, docLines: number): number {
    return Math.min(Math.max(line, 1), docLines);
}

function deleteAnchorDocLine(group: HunkGroupView, docLines: number): number {
    return clampDocLine(group.anchorLine, docLines);
}

function addGroupSharesDeleteStack(
    groups: HunkGroupView[],
    addGroup: HunkGroupView,
    docLines: number
): boolean {
    if (addGroup.deletedLines.length > 0) {
        return true;
    }
    if (!addGroup.addedLineRange) {
        return false;
    }
    const addStart = clampDocLine(addGroup.addedLineRange.startLine, docLines);
    const addEnd = clampDocLine(
        resolveControlsLine(addGroup, docLines),
        docLines
    );
    for (const group of groups) {
        if (!isDeleteOnlyGroup(group)) {
            continue;
        }
        const deleteLine = deleteAnchorDocLine(group, docLines);
        if (deleteLine >= addStart && deleteLine <= addEnd) {
            return true;
        }
    }
    return false;
}

function isDeleteOnlyGroup(group: HunkGroupView): boolean {
    return group.deletedLines.length > 0 && group.addedLineRange == null;
}

function groupSortStartLine(group: HunkGroupView): number {
    return group.addedLineRange?.startLine ?? group.anchorLine;
}

function compareHunkGroupsForDisplay(
    a: HunkGroupView,
    b: HunkGroupView
): number {
    const aDeleteOnly = isDeleteOnlyGroup(a);
    const bDeleteOnly = isDeleteOnlyGroup(b);
    if (aDeleteOnly !== bDeleteOnly) {
        return aDeleteOnly ? -1 : 1;
    }
    return groupSortStartLine(a) - groupSortStartLine(b);
}

function takeNextSide(sideByPos: Map<number, number>, pos: number): number {
    const side = sideByPos.get(pos) ?? 1;
    sideByPos.set(pos, side + 1);
    return side;
}

function reserveSide(sideByPos: Map<number, number>, pos: number, side: number): void {
    sideByPos.set(pos, Math.max(sideByPos.get(pos) ?? 1, side + 1));
}

function buildHunkDecorations(
    state: EditorState,
    groups: HunkGroupView[],
    pendingHunkIds: Set<string>,
    canRevert: boolean,
    revertLabel: string
): DecorationSet {
    const decorations: ReturnType<typeof Decoration.line>[] = [];
    const widgets: ReturnType<typeof Decoration.widget>[] = [];
    const docLines = state.doc.lines;
    const sideByPos = new Map<number, number>();
    const sortedGroups = [...groups].sort(compareHunkGroupsForDisplay);

    for (const group of sortedGroups) {
        const ids = group.hunks.map((h) => h.id);
        const pending = ids.some((id) => pendingHunkIds.has(id));
        const addedClass = group.isNewFile
            ? 'cm-hunk-added-file-line'
            : 'cm-hunk-added-line';

        let controlsPos: number | null = null;
        let controlsSide = 1;
        let deleteOnlyControlsPos: number | null = null;

        if (group.deletedLines.length > 0) {
            const anchor = Math.min(Math.max(group.anchorLine, 1), docLines);
            const deletePos = state.doc.line(anchor).from;
            widgets.push(
                Decoration.widget({
                    widget: new DeletedLinesWidget(group.deletedLines),
                    block: true,
                    side: -1,
                }).range(deletePos)
            );
            reserveSide(sideByPos, deletePos, -1);
            if (isDeleteOnlyGroup(group)) {
                deleteOnlyControlsPos = deletePos;
            }
        }

        const lineAddHunk = group.hunks.find(
            (h) =>
                h.type === 'addLinesToSegment' || h.type === 'addLinesToFile'
        );
        const sharesDeleteStack = addGroupSharesDeleteStack(
            sortedGroups,
            group,
            docLines
        );
        const addedTextMatchesDoc =
            group.addedLineRange != null &&
            lineAddHunk?.text != null &&
            documentLinesMatchHunkText(
                state,
                group.addedLineRange,
                lineAddHunk.text
            );
        const showAddedBlock =
            group.addedLineRange != null &&
            lineAddHunk?.text != null &&
            (!addedTextMatchesDoc || sharesDeleteStack);

        if (showAddedBlock && group.addedLineRange) {
            const start = clampDocLine(group.addedLineRange.startLine, docLines);
            const pos = sharesDeleteStack
                ? state.doc.line(start).from
                : (() => {
                      const insertAfter = Math.min(
                          Math.max(group.addedLineRange!.startLine - 1, 0),
                          docLines
                      );
                      return insertAfter === 0
                          ? 0
                          : state.doc.line(insertAfter).to;
                  })();
            widgets.push(
                Decoration.widget({
                    widget: new AddedLinesWidget(
                        lineAddHunk!.text!.split('\n')
                    ),
                    block: true,
                    side: takeNextSide(sideByPos, pos),
                }).range(pos)
            );
            controlsPos = pos;

            if (addedTextMatchesDoc) {
                const end = clampDocLine(
                    resolveControlsLine(group, docLines),
                    docLines
                );
                for (let lineNo = start; lineNo <= end; lineNo++) {
                    decorations.push(
                        Decoration.line({
                            class: 'cm-hunk-added-source-line',
                        }).range(state.doc.line(lineNo).from)
                    );
                }
            }
        } else if ((group.isWholeSegment || group.isCreation) && !group.isNewSegment) {
            for (let lineNo = 1; lineNo <= docLines; lineNo++) {
                decorations.push(
                    Decoration.line({ class: addedClass }).range(
                        state.doc.line(lineNo).from
                    )
                );
            }
        } else if (group.addedLineRange) {
            const start = Math.min(
                Math.max(group.addedLineRange.startLine, 1),
                docLines
            );
            const end = Math.min(
                Math.max(group.addedLineRange.endLine, start),
                docLines
            );
            for (let lineNo = start; lineNo <= end; lineNo++) {
                decorations.push(
                    Decoration.line({ class: addedClass }).range(
                        state.doc.line(lineNo).from
                    )
                );
            }
            controlsPos = state.doc.line(
                resolveControlsLine(group, docLines)
            ).to;
        }

        if (!group.isNewSegment) {
            if (deleteOnlyControlsPos != null) {
                controlsPos = deleteOnlyControlsPos;
                controlsSide = 1;
                reserveSide(sideByPos, controlsPos, controlsSide);
            } else if (controlsPos == null) {
                controlsPos = state.doc.line(
                    resolveControlsLine(group, docLines)
                ).to;
                controlsSide = takeNextSide(sideByPos, controlsPos);
            } else {
                controlsSide = takeNextSide(sideByPos, controlsPos);
            }

            widgets.push(
                Decoration.widget({
                    widget: new HunkControlsWidget(
                        ids,
                        pending,
                        canRevert,
                        group.acceptLabel,
                        revertLabel
                    ),
                    block: true,
                    side: controlsSide,
                }).range(controlsPos)
            );
        }
    }

    return Decoration.set([...decorations, ...widgets], true);
}

export const hunkDecorationsField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(value, tr) {
        let next = value.map(tr.changes);
        for (const effect of tr.effects) {
            if (effect.is(setHunkGroupsEffect)) {
                next = buildHunkDecorations(
                    tr.state,
                    effect.value.groups,
                    effect.value.pendingHunkIds,
                    effect.value.canRevert,
                    effect.value.revertLabel
                );
            }
        }
        return next;
    },
    provide: (field) => EditorView.decorations.from(field),
});

export function dispatchHunkGroups(
    view: EditorView,
    groups: HunkGroupView[],
    pendingHunkIds: string[],
    canRevert: boolean,
    revertLabel: string
): void {
    view.dispatch({
        effects: setHunkGroupsEffect.of({
            groups,
            pendingHunkIds: new Set(pendingHunkIds),
            canRevert,
            revertLabel,
        }),
    });
}

export const hunkEditorTheme = EditorView.theme({
    '.cm-hunk-added-line': {
        backgroundColor: `${colors.green}2E`,
    },
    '.cm-hunk-added-file-line': {
        backgroundColor: `${colors.green}2E`,
    },
    '.cm-hunk-added-block': {
        backgroundColor: `${colors.green}2E`,
        borderLeft: `3px solid ${colors.green}`,
        margin: '0',
        padding: '2px 8px',
        fontFamily: 'inherit',
        whiteSpace: 'pre-wrap',
    },
    '.cm-hunk-added-line-ghost': {
        color: colors.gray10,
        minHeight: '1.2em',
    },
    '.cm-hunk-added-source-line': {
        height: '0 !important',
        overflow: 'hidden',
        lineHeight: '0 !important',
        paddingTop: '0 !important',
        paddingBottom: '0 !important',
        margin: '0 !important',
        visibility: 'hidden',
    },
    '.cm-hunk-deleted-block': {
        backgroundColor: colors.red20,
        borderLeft: `3px solid ${colors.red10}`,
        margin: '0',
        padding: '2px 8px',
        fontFamily: 'inherit',
        whiteSpace: 'pre-wrap',
    },
    '.cm-hunk-deleted-line': {
        color: colors.red10,
        textDecoration: 'line-through',
        minHeight: '1.2em',
    },
    '.cm-hunk-controls': {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '0',
        marginTop: '4px',
        marginBottom: '6px',
        paddingRight: '8px',
        userSelect: 'none',
    },
    '.cm-hunk-btn': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '28px',
        padding: '4px 12px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '12px',
        lineHeight: '1.2',
        fontFamily: 'inherit',
        touchAction: 'manipulation',
        whiteSpace: 'nowrap',
    },
    '.cm-hunk-btn--accept': {
        background: colors.blue10,
        color: colors.white,
    },
    '.cm-hunk-btn--revert': {
        background: colors.blue20,
        color: colors.gray10,
    },
    '.cm-hunk-btn:disabled': {
        opacity: 0.6,
        cursor: 'default',
    },
    '.cm-hunk-btn--loading': {
        minWidth: '72px',
    },
    '.cm-hunk-btn__spinner': {
        width: '14px',
        height: '14px',
        borderRadius: '50%',
        animation: 'cm-hunk-spin 0.8s linear infinite',
    },
    '.cm-hunk-btn__spinner--accept': {
        border: '2px solid rgba(255,255,255,0.35)',
        borderTopColor: colors.white,
    },
    '.cm-hunk-btn__spinner--revert': {
        border: '2px solid rgba(14,22,33,0.15)',
        borderTopColor: colors.gray10,
    },
    '@keyframes cm-hunk-spin': {
        to: { transform: 'rotate(360deg)' },
    },
});

export const hunkEditorExtensions: Extension[] = [
    hunkDecorationsField,
    hunkEditorTheme,
];
