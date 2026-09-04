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
    type Range,
    type Transaction,
} from '@codemirror/state';
import type { HunkGroup } from '../../../../viewModel/utils/hunkGrouping.ts';
import {
    deletedLinesAnchorAtEnd,
    resolveControlsLine,
} from '../../../../viewModel/utils/hunkGrouping.ts';
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

function setHunkButtonLoading(
    button: HTMLButtonElement,
    label: string,
    loading: boolean,
    spinnerClassName: string
): void {
    button.disabled = loading;
    button.classList.toggle('cm-hunk-btn--loading', loading);
    button.replaceChildren();
    if (loading) {
        button.appendChild(createHunkSpinner(spinnerClassName));
        return;
    }
    button.textContent = label;
}

function appendHunkControls(
    parent: HTMLElement,
    hunkIds: string[],
    pending: boolean,
    canRevert: boolean,
    acceptLabel: string,
    revertLabel: string
): void {
    const wrap = document.createElement('div');
    wrap.className = 'cm-hunk-controls';
    wrap.contentEditable = 'false';
    wrap.appendChild(
        createHunkButton(
            'cm-hunk-btn cm-hunk-btn--accept',
            acceptLabel,
            pending,
            'cm-hunk-btn__spinner cm-hunk-btn__spinner--accept',
            () =>
                hunkActionHandler?.({
                    action: 'accept',
                    hunkIds,
                })
        )
    );
    if (canRevert) {
        wrap.appendChild(
            createHunkButton(
                'cm-hunk-btn cm-hunk-btn--revert',
                revertLabel,
                pending,
                'cm-hunk-btn__spinner cm-hunk-btn__spinner--revert',
                () =>
                    hunkActionHandler?.({
                        action: 'revert',
                        hunkIds,
                    })
            )
        );
    }
    parent.appendChild(wrap);
}

function syncHunkControls(
    dom: HTMLElement,
    pending: boolean,
    canRevert: boolean,
    acceptLabel: string,
    revertLabel: string
): boolean {
    const acceptBtn = dom.querySelector(
        '.cm-hunk-btn--accept'
    ) as HTMLButtonElement | null;
    if (!acceptBtn) {
        return false;
    }
    setHunkButtonLoading(
        acceptBtn,
        acceptLabel,
        pending,
        'cm-hunk-btn__spinner cm-hunk-btn__spinner--accept'
    );
    const revertBtn = dom.querySelector(
        '.cm-hunk-btn--revert'
    ) as HTMLButtonElement | null;
    if (canRevert) {
        if (!revertBtn) {
            return false;
        }
        setHunkButtonLoading(
            revertBtn,
            revertLabel,
            pending,
            'cm-hunk-btn__spinner cm-hunk-btn__spinner--revert'
        );
    } else if (revertBtn) {
        return false;
    }
    return true;
}

function createHunkButton(
    className: string,
    label: string,
    loading: boolean,
    spinnerClassName: string,
    onClick: () => void
): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) {
            return;
        }
        onClick();
    });
    setHunkButtonLoading(button, label, loading, spinnerClassName);
    return button;
}

const HUNK_TRAILING_LINE_LAST_PX = 32;
const HUNK_TRAILING_LINE_SECOND_LAST_PX = 16;

/** Trailing delete sits after EOF. Second-to-last delete shifts the next line up, so `controlsLine === docLines` in both cases. */
function hunkTrailingSpacePx(
    controlsLine: number,
    docLines: number,
    deletedBlockAtEnd: boolean,
    deleteOnly: boolean
): number {
    if (deletedBlockAtEnd) {
        return HUNK_TRAILING_LINE_LAST_PX;
    }
    if (controlsLine >= docLines) {
        return deleteOnly
            ? HUNK_TRAILING_LINE_SECOND_LAST_PX
            : HUNK_TRAILING_LINE_LAST_PX;
    }
    if (controlsLine === docLines - 1) {
        return HUNK_TRAILING_LINE_SECOND_LAST_PX;
    }
    return 0;
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

    updateDOM(dom: HTMLElement): boolean {
        return syncHunkControls(
            dom,
            this.pending,
            this.canRevert,
            this.acceptLabel,
            this.revertLabel
        );
    }

    toDOM(): HTMLElement {
        const wrap = document.createElement('div');
        wrap.className = 'cm-hunk-controls-host';
        wrap.contentEditable = 'false';
        appendHunkControls(
            wrap,
            this.hunkIds,
            this.pending,
            this.canRevert,
            this.acceptLabel,
            this.revertLabel
        );
        return wrap;
    }

    get estimatedHeight(): number {
        return 0;
    }

    ignoreEvent(): boolean {
        return true;
    }
}

/**
 * Empty line after EOF so trailing hunks layout like mid-document:
 * deleted/added lines, then the next line that absolute buttons sit on.
 */
class HunkTrailingLineWidget extends WidgetType {
    constructor(readonly height: number) {
        super();
    }

    eq(other: WidgetType): boolean {
        return (
            other instanceof HunkTrailingLineWidget &&
            other.height === this.height
        );
    }

    toDOM(): HTMLElement {
        const el = document.createElement('div');
        el.className = 'cm-hunk-trailing-line';
        el.style.height = `${this.height}px`;
        el.setAttribute('aria-hidden', 'true');
        return el;
    }

    get estimatedHeight(): number {
        return this.height;
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

    toDOM(): HTMLElement {
        const wrap = document.createElement('div');
        wrap.className = 'cm-hunk-deleted-wrap';
        wrap.contentEditable = 'false';
        const block = document.createElement('div');
        block.className = 'cm-hunk-deleted-block';
        for (const line of this.lines) {
            const row = document.createElement('div');
            row.className = 'cm-hunk-deleted-line';
            row.textContent = line.length > 0 ? line : ' ';
            block.appendChild(row);
        }
        wrap.appendChild(block);
        return wrap;
    }

    ignoreEvent(): boolean {
        return true;
    }
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

function reserveSide(
    sideByPos: Map<number, number>,
    pos: number,
    side: number
): void {
    sideByPos.set(pos, Math.max(sideByPos.get(pos) ?? 1, side + 1));
}

function buildHunkDecorations(
    state: EditorState,
    groups: HunkGroupView[],
    pendingHunkIds: Set<string>,
    canRevert: boolean,
    revertLabel: string
): DecorationSet {
    const decorations: Range<Decoration>[] = [];
    const widgets: Range<Decoration>[] = [];
    const docLines = state.doc.lines;
    const sideByPos = new Map<number, number>();
    const sortedGroups = [...groups].sort(compareHunkGroupsForDisplay);
    const targetHunks = [
        ...new Map(
            sortedGroups
                .flatMap((group) => group.hunks)
                .map((hunk) => [hunk.id, hunk])
        ).values(),
    ];
    let trailingSpacePx = 0;

    for (const group of sortedGroups) {
        const ids = group.hunks.map((h) => h.id);
        const pending = ids.some((id) => pendingHunkIds.has(id));
        const addedClass = group.isNewFile
            ? 'cm-hunk-added-file-line'
            : 'cm-hunk-added-line';

        let controlsPos: number | null = null;
        let controlsLine: number | null = null;
        let controlsSide: number;
        const deleteOnly = isDeleteOnlyGroup(group);
        let deletedBlockAtEnd = false;

        if (group.deletedLines.length > 0) {
            deletedBlockAtEnd = deletedLinesAnchorAtEnd(
                group.anchorLine,
                docLines
            );
            const anchor = Math.min(Math.max(group.anchorLine, 1), docLines);
            const deletePos = deletedBlockAtEnd
                ? state.doc.line(anchor).to
                : state.doc.line(anchor).from;
            const deleteSide = deletedBlockAtEnd ? 1 : -2;
            widgets.push(
                Decoration.widget({
                    widget: new DeletedLinesWidget(group.deletedLines),
                    block: true,
                    side: deleteSide,
                }).range(deletePos)
            );
            reserveSide(sideByPos, deletePos, deleteSide);
            if (deleteOnly) {
                controlsPos = deletePos;
                controlsLine = anchor;
            }
        }

        const addedStart = group.addedLineRange
            ? Math.min(Math.max(group.addedLineRange.startLine, 1), docLines)
            : null;

        if ((group.isWholeSegment || group.isCreation) && !group.isNewSegment) {
            if (docLines > 0) {
                decorations.push(
                    Decoration.line({
                        class: group.isNewFile
                            ? 'cm-hunk-whole-doc cm-hunk-whole-doc--file'
                            : 'cm-hunk-whole-doc',
                    }).range(state.doc.line(1).from)
                );
            }
        } else if (group.addedLineRange) {
            const start = addedStart ?? 1;
            const end = resolveControlsLine(group, docLines, targetHunks);
            for (let lineNo = start; lineNo <= end; lineNo++) {
                decorations.push(
                    Decoration.line({ class: addedClass }).range(
                        state.doc.line(lineNo).from
                    )
                );
            }
            controlsPos = state.doc.line(end).to;
            controlsLine = end;
        }

        if (!group.isNewSegment) {
            if (deleteOnly && controlsPos != null) {
                // Mid-doc: same slot as the deleted block (line.from), side -1
                // keeps the 0-height host under the red lines and above the
                // remaining line. Trailing delete: both widgets sit after EOF.
                controlsSide = deletedBlockAtEnd ? 2 : -1;
                reserveSide(sideByPos, controlsPos, controlsSide);
            } else if (controlsPos == null) {
                controlsLine = resolveControlsLine(
                    group,
                    docLines,
                    targetHunks
                );
                controlsPos = state.doc.line(controlsLine).to;
                controlsSide = takeNextSide(sideByPos, controlsPos);
            } else {
                controlsSide = takeNextSide(sideByPos, controlsPos);
            }

            trailingSpacePx = Math.max(
                trailingSpacePx,
                hunkTrailingSpacePx(
                    controlsLine ?? 0,
                    docLines,
                    deletedBlockAtEnd,
                    deleteOnly
                )
            );

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

    if (trailingSpacePx > 0 && docLines > 0) {
        const eof = state.doc.line(docLines).to;
        widgets.push(
            Decoration.widget({
                widget: new HunkTrailingLineWidget(trailingSpacePx),
                block: true,
                side: takeNextSide(sideByPos, eof),
            }).range(eof)
        );
    }

    return Decoration.set([...decorations, ...widgets], true);
}

type HunkGroupsPayload = {
    groups: HunkGroupView[];
    pendingHunkIds: Set<string>;
    canRevert: boolean;
    revertLabel: string;
};

function isWholeDocumentReplace(tr: Transaction): boolean {
    if (!tr.docChanged) {
        return false;
    }
    const oldLength = tr.startState.doc.length;
    let whole = false;
    tr.changes.iterChanges((fromA, toA) => {
        if (fromA === 0 && toA === oldLength) {
            whole = true;
        }
    });
    return whole;
}

function decorationsFromPayload(
    state: EditorState,
    payload: HunkGroupsPayload
): DecorationSet {
    return buildHunkDecorations(
        state,
        payload.groups,
        payload.pendingHunkIds,
        payload.canRevert,
        payload.revertLabel
    );
}

const hunkGroupsPayloadField = StateField.define<HunkGroupsPayload | null>({
    create: () => null,
    update(value, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setHunkGroupsEffect)) {
                return effect.value;
            }
        }
        return value;
    },
});

export const hunkDecorationsField = StateField.define<DecorationSet>({
    create() {
        return Decoration.none;
    },
    update(value, tr) {
        let payloadFromEffect: HunkGroupsPayload | null = null;
        for (const effect of tr.effects) {
            if (effect.is(setHunkGroupsEffect)) {
                payloadFromEffect = effect.value;
            }
        }
        if (payloadFromEffect) {
            return decorationsFromPayload(tr.state, payloadFromEffect);
        }
        const stored = tr.startState.field(hunkGroupsPayloadField, false);
        if (stored && isWholeDocumentReplace(tr)) {
            return decorationsFromPayload(tr.state, stored);
        }
        return value.map(tr.changes);
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
    const signature = serializeHunkDispatchPayload(
        groups,
        pendingHunkIds,
        canRevert,
        revertLabel
    );
    if (lastHunkDispatchByView.get(view) === signature) {
        return;
    }
    lastHunkDispatchByView.set(view, signature);

    view.dispatch({
        effects: setHunkGroupsEffect.of({
            groups,
            pendingHunkIds: new Set(pendingHunkIds),
            canRevert,
            revertLabel,
        }),
    });
}

const lastHunkDispatchByView = new WeakMap<EditorView, string>();

function serializeHunkDispatchPayload(
    groups: HunkGroupView[],
    pendingHunkIds: string[],
    canRevert: boolean,
    revertLabel: string
): string {
    const groupKey = groups
        .map(
            (group) =>
                `${group.key}:${group.hunks.map((hunk) => hunk.id).join(',')}:${group.acceptLabel}`
        )
        .join('|');
    const pendingKey = [...pendingHunkIds].sort().join(',');
    return `${groupKey}#${pendingKey}#${canRevert}#${revertLabel}`;
}

export const hunkEditorTheme = EditorView.theme({
    '.cm-hunk-added-line': {
        backgroundColor: `${colors.green}2E`,
    },
    '.cm-hunk-added-file-line': {
        backgroundColor: `${colors.green}2E`,
    },
    '.cm-content:has(.cm-hunk-whole-doc) > .cm-line': {
        backgroundColor: `${colors.green}2E`,
    },
    '.cm-content:has(.cm-hunk-whole-doc--file) > .cm-line': {
        backgroundColor: `${colors.green}2E`,
    },
    '.cm-hunk-deleted-wrap': {
        margin: '0',
        padding: '0',
        background: 'transparent',
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
    '.cm-hunk-controls-host': {
        position: 'relative',
        display: 'block',
        height: '0',
        maxHeight: '0',
        margin: '0',
        padding: '0',
        border: 'none',
        width: '100%',
        // Clip so abs buttons do not inflate cm-content/scroller height;
        // clip-margin keeps them visible over the next line.
        overflow: 'clip',
        overflowClipMargin: '36px',
        pointerEvents: 'none',
        lineHeight: '0',
    },
    '.cm-hunk-trailing-line': {
        display: 'block',
        width: '100%',
        margin: '0',
        padding: '0',
        border: 'none',
        pointerEvents: 'none',
        lineHeight: '0',
    },
    '.cm-hunk-controls-host .cm-hunk-controls': {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: '0',
        margin: '0',
        padding: '0',
        position: 'absolute',
        right: '8px',
        top: '4px',
        zIndex: '2',
        userSelect: 'none',
        pointerEvents: 'auto',
    },
    '.cm-hunk-btn': {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        minHeight: '28px',
        minWidth: '72px',
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
        pointerEvents: 'none',
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
    hunkGroupsPayloadField,
    hunkDecorationsField,
    hunkEditorTheme,
];
