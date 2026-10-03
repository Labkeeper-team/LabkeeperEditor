import { Hunk } from '../../model/domain.ts';
import { projectFilePathsMatch } from './projectFilePath.ts';

export type HunkGroupTarget =
    { kind: 'segment'; segmentId: number } | { kind: 'file'; fileName: string };

export interface HunkGroup {
    /** Stable key for React / CodeMirror widget identity */
    key: string;
    hunks: Hunk[];
    target: HunkGroupTarget;
    /** 1-based line where deleted-line ghosts are anchored */
    anchorLine: number;
    /** 1-based line after which accept/reject buttons are placed */
    controlsAfterLine: number;
    /** Deleted lines shown as ghost widgets above anchorLine */
    deletedLines: string[];
    /** 1-based inclusive line range of added lines in the current document */
    addedLineRange: { startLine: number; endLine: number } | null;
    /** addSegment / addFile group — highlight whole target */
    isCreation: boolean;
    isWholeSegment: boolean;
    isNewFile: boolean;
    isNewSegment: boolean;
}

/** Строки текста hunk: сервер склеивает строки без завершающего перевода, поэтому \n в конце обычно значит пустую последнюю строку */
export function hunkTextLines(
    hunk: Pick<Hunk, 'text' | 'startLine' | 'endLine'>
): string[] {
    const parts = (hunk.text ?? '').replace(/\r\n/g, '\n').split('\n');
    // \n в конце лишний, только если частей на одну больше, чем строк в startLine..endLine; без диапазона сверить не с чем, и остаётся формат сервера
    const endsWithLineBreak =
        parts.length > 1 &&
        parts[parts.length - 1] === '' &&
        hunk.startLine != null &&
        hunk.endLine != null &&
        parts.length === hunk.endLine - hunk.startLine + 2;
    return endsWithLineBreak ? parts.slice(0, -1) : parts;
}

/** Заменённые строки: text относится к старым строкам, а диапазон к новым, поэтому сверять с ним и срезать \n в конце нельзя */
function replacedTextLines(text: string): string[] {
    return text.replace(/\r\n/g, '\n').split('\n');
}

const isLineAdd = (t: Hunk['type']) =>
    t === 'addLinesToFile' || t === 'addLinesToSegment';
const isLineDelete = (t: Hunk['type']) =>
    t === 'deleteLinesFromFile' || t === 'deleteLinesFromSegment';
const isReplace = (t: Hunk['type']) =>
    t === 'replaceTextInFile' || t === 'replaceTextInSegment';
const isCreation = (t: Hunk['type']) => t === 'addFile' || t === 'addSegment';

function targetKey(hunk: Hunk): string | null {
    if (hunk.segmentId != null) {
        return `segment:${hunk.segmentId}`;
    }
    if (hunk.fileName != null) {
        return `file:${hunk.fileName}`;
    }
    return null;
}

function hunkTarget(hunk: Hunk): HunkGroupTarget | null {
    if (hunk.segmentId != null) {
        return { kind: 'segment', segmentId: hunk.segmentId };
    }
    if (hunk.fileName != null) {
        return { kind: 'file', fileName: hunk.fileName };
    }
    return null;
}

function canPairReplace(deleteHunk: Hunk, addHunk: Hunk): boolean {
    if (!isLineDelete(deleteHunk.type) || !isLineAdd(addHunk.type)) {
        return false;
    }
    if (targetKey(deleteHunk) !== targetKey(addHunk)) {
        return false;
    }
    return (
        deleteHunk.startLine != null &&
        addHunk.startLine != null &&
        deleteHunk.startLine === addHunk.startLine
    );
}

function canPairCreation(creation: Hunk, addition: Hunk): boolean {
    if (
        creation.type === 'addFile' &&
        (addition.type === 'addLinesToFile' ||
            addition.type === 'replaceTextInFile')
    ) {
        return creation.fileName === addition.fileName;
    }
    if (
        creation.type === 'addSegment' &&
        (addition.type === 'addLinesToSegment' ||
            addition.type === 'replaceTextInSegment')
    ) {
        return creation.segmentId === addition.segmentId;
    }
    return false;
}

function buildGroup(hunks: Hunk[]): HunkGroup | null {
    if (hunks.length === 0) {
        return null;
    }
    const target = hunkTarget(hunks[0]);
    if (!target) {
        return null;
    }

    const deletedLines: string[] = [];
    let addedStart: number | null = null;
    let addedEnd: number | null = null;
    let anchorLine = 1;
    let creation = false;
    let isWholeSegment = false;
    let isNewFile = false;
    let isNewSegment = false;
    const inCreation = hunks.some((hunk) => isCreation(hunk.type));

    for (const hunk of hunks) {
        if (isCreation(hunk.type)) {
            creation = true;
            anchorLine = 1;
            if (hunk.type === 'addSegment') {
                isWholeSegment = true;
                isNewSegment = true;
            }
            if (hunk.type === 'addFile') {
                isWholeSegment = true;
                isNewFile = true;
            }
            continue;
        }
        if (isLineDelete(hunk.type)) {
            // "" это удалённая пустая строка, поэтому != null: на проверке
            // истинности она терялась, призрак строки не рисовался, а кнопки
            // правки уезжали на строку ниже. Так же сделано у замены
            if (hunk.text != null) {
                deletedLines.push(...hunkTextLines(hunk));
            }
            if (hunk.startLine != null) {
                anchorLine = hunk.startLine;
            }
            continue;
        }
        if (isReplace(hunk.type)) {
            // "" это одна пустая строка, поэтому != null; в новом файле или сегменте старых строк не было
            if (hunk.text != null && !inCreation) {
                deletedLines.push(...replacedTextLines(hunk.text));
            }
        }
        if (isLineAdd(hunk.type) || isReplace(hunk.type)) {
            if (hunk.startLine != null) {
                anchorLine = hunk.startLine;
                addedStart =
                    addedStart == null
                        ? hunk.startLine
                        : Math.min(addedStart, hunk.startLine);
                addedEnd =
                    addedEnd == null
                        ? (hunk.endLine ?? hunk.startLine)
                        : Math.max(addedEnd, hunk.endLine ?? hunk.startLine);
            }
        }
    }

    if (addedStart == null && deletedLines.length > 0) {
        anchorLine = hunks.find((h) => isLineDelete(h.type))?.startLine ?? 1;
    }

    const key = `${targetKey(hunks[0])}:${hunks.map((h) => h.id).join(',')}`;

    let controlsAfterLine = anchorLine;
    if (isWholeSegment) {
        controlsAfterLine = 0;
    } else if (addedEnd != null) {
        controlsAfterLine = addedEnd;
    } else if (addedStart != null) {
        controlsAfterLine = addedStart;
    } else if (deletedLines.length > 0) {
        controlsAfterLine = anchorLine;
    }

    return {
        key,
        hunks,
        target,
        anchorLine,
        controlsAfterLine,
        deletedLines,
        addedLineRange:
            addedStart != null
                ? {
                      startLine: addedStart,
                      endLine: addedEnd ?? addedStart,
                  }
                : null,
        isCreation: creation,
        isWholeSegment,
        isNewFile,
        isNewSegment,
    };
}

/**
 * Groups server hunks for display. Server guarantees non-overlapping ranges.
 */
export function groupHunks(hunks: Hunk[]): HunkGroup[] {
    // Process addFile/addSegment before line hunks so creation pairs stay in one group.
    const remaining = [...hunks].sort((a, b) => {
        const priority = (hunk: Hunk) => (isCreation(hunk.type) ? 0 : 1);
        return priority(a) - priority(b);
    });
    const groups: HunkGroup[] = [];

    while (remaining.length > 0) {
        const seed = remaining.shift()!;
        const group: Hunk[] = [seed];

        if (isCreation(seed.type)) {
            for (let i = remaining.length - 1; i >= 0; i--) {
                if (canPairCreation(seed, remaining[i])) {
                    group.push(remaining[i]);
                    remaining.splice(i, 1);
                }
            }
        } else if (isLineDelete(seed.type)) {
            for (let i = remaining.length - 1; i >= 0; i--) {
                if (canPairReplace(seed, remaining[i])) {
                    group.push(remaining[i]);
                    remaining.splice(i, 1);
                    break;
                }
            }
        } else if (isLineAdd(seed.type)) {
            for (let i = remaining.length - 1; i >= 0; i--) {
                if (canPairReplace(remaining[i], seed)) {
                    group.unshift(remaining[i]);
                    remaining.splice(i, 1);
                    break;
                }
            }
        }

        const built = buildGroup(group);
        if (built) {
            groups.push(built);
        }
    }

    return groups;
}

function isReplacePair(hunks: Hunk[]): boolean {
    return (
        hunks.length === 2 &&
        hunks.some((h) => isLineDelete(h.type)) &&
        hunks.some((h) => isLineAdd(h.type))
    );
}

/** One accept/reject control block per disjoint change region. */
export function expandGroupsForDisplay(groups: HunkGroup[]): HunkGroup[] {
    const expanded: HunkGroup[] = [];

    for (const group of groups) {
        if (
            group.isWholeSegment ||
            group.isCreation ||
            group.hunks.some((hunk) => isCreation(hunk.type)) ||
            group.hunks.length <= 1 ||
            isReplacePair(group.hunks)
        ) {
            expanded.push(group);
            continue;
        }

        const used = new Set<string>();
        for (const hunk of group.hunks) {
            if (used.has(hunk.id)) {
                continue;
            }
            if (isLineDelete(hunk.type)) {
                const add = group.hunks.find(
                    (candidate) =>
                        !used.has(candidate.id) &&
                        canPairReplace(hunk, candidate)
                );
                const bundle = add ? [hunk, add] : [hunk];
                bundle.forEach((item) => used.add(item.id));
                const built = buildGroup(bundle);
                if (built) {
                    expanded.push(built);
                }
                continue;
            }
            if (isLineAdd(hunk.type) || isCreation(hunk.type)) {
                used.add(hunk.id);
                const built = buildGroup([hunk]);
                if (built) {
                    expanded.push(built);
                }
            }
        }
    }

    return expanded.length > 0 ? expanded : groups;
}

function hunkLineCount(hunk: Hunk): number {
    if (hunk.text != null) {
        return hunkTextLines(hunk).length;
    }
    if (hunk.startLine == null) {
        return 0;
    }
    return Math.max((hunk.endLine ?? hunk.startLine) - hunk.startLine + 1, 0);
}

/** Maps a 1-based line from the pre-hunk document to the displayed document. */
export function mapBaseLineToDisplayLine(
    hunks: Hunk[],
    baseLine: number
): number {
    let shift = 0;
    for (const hunk of hunks) {
        if (hunk.startLine == null) {
            continue;
        }
        if (isLineAdd(hunk.type) && hunk.startLine < baseLine) {
            shift += hunkLineCount(hunk);
        } else if (isLineDelete(hunk.type)) {
            const endLine = hunk.endLine ?? hunk.startLine;
            if (endLine < baseLine) {
                shift -= hunkLineCount(hunk);
            }
        }
    }
    return Math.max(baseLine + shift, 1);
}

export function resolveControlsLine(
    group: HunkGroup,
    docLines: number,
    targetHunks: Hunk[] = group.hunks
): number {
    void targetHunks;
    if (group.isWholeSegment) {
        return docLines;
    }

    const lineAdd = group.hunks.find(
        (h) => h.type === 'addLinesToSegment' || h.type === 'addLinesToFile'
    );

    if (group.addedLineRange) {
        const start = Math.min(
            Math.max(group.addedLineRange.startLine, 1),
            docLines
        );
        if (lineAdd?.text) {
            const textLineCount = hunkTextLines(lineAdd).length;
            return Math.min(start + textLineCount - 1, docLines);
        }
        const end = Math.min(
            Math.max(group.addedLineRange.endLine, start),
            docLines
        );
        return end;
    }
    if (group.deletedLines.length > 0) {
        return Math.min(Math.max(group.anchorLine, 1), docLines);
    }
    return Math.min(Math.max(group.controlsAfterLine, 1), docLines);
}

/**
 * Deleted ghosts sit before the line that shifted into `anchorLine`.
 * After a trailing delete that line is gone, so the block belongs after EOF.
 */
export function deletedLinesAnchorAtEnd(
    anchorLine: number,
    docLines: number
): boolean {
    return docLines > 0 && anchorLine > docLines;
}

export function getNewSegmentHunkGroup(
    hunks: Hunk[],
    segmentId: number
): HunkGroup | undefined {
    return findNewSegmentHunkGroup(groupHunks(hunks), segmentId);
}

export function findNewSegmentHunkGroup(
    groups: HunkGroup[],
    segmentId: number
): HunkGroup | undefined {
    return groups.find(
        (group) =>
            group.isNewSegment &&
            group.target.kind === 'segment' &&
            group.target.segmentId === segmentId
    );
}

export function filterHunkGroupsForSegment(
    groups: HunkGroup[],
    segmentId: number | undefined
): HunkGroup[] {
    if (segmentId == null) {
        return [];
    }
    return groups.filter(
        (g) => g.target.kind === 'segment' && g.target.segmentId === segmentId
    );
}

export function filterHunkGroupsForFile(
    groups: HunkGroup[],
    fileName: string | null
): HunkGroup[] {
    if (!fileName) {
        return [];
    }
    return groups.filter(
        (g) => g.target.kind === 'file' && g.target.fileName === fileName
    );
}

export type FileHunkVisualState = 'added' | 'modified' | 'deleted';

export interface FileHunkEntry {
    fileName: string;
    state: FileHunkVisualState;
    hunkIds: string[];
}

export function getFileHunkEntries(hunks: Hunk[]): FileHunkEntry[] {
    return buildFileHunkEntries(groupHunks(hunks));
}

export function buildFileHunkEntries(groups: HunkGroup[]): FileHunkEntry[] {
    return groups
        .filter((group) => group.target.kind === 'file')
        .map((group) => {
            const hasAddFile = group.hunks.some((h) => h.type === 'addFile');
            // замена кладёт и старые строки, и новые: это правка файла, а не удаление
            const hasLineAdd = group.hunks.some(
                (h) =>
                    h.type === 'addLinesToFile' ||
                    h.type === 'replaceTextInFile'
            );
            const hasLineDelete = group.deletedLines.length > 0;

            let state: FileHunkVisualState = 'modified';
            if (hasAddFile || group.isNewFile) {
                state = 'added';
            } else if (hasLineDelete && !hasLineAdd) {
                state = 'deleted';
            }

            return {
                fileName: (
                    group.target as Extract<HunkGroupTarget, { kind: 'file' }>
                ).fileName,
                state,
                hunkIds: group.hunks.map((h) => h.id),
            };
        });
}

export function getPhantomFileNamesFromHunks(
    hunks: Hunk[],
    existingFileNames: Iterable<string>
): string[] {
    return getPhantomFileNamesFromEntries(
        getFileHunkEntries(hunks),
        existingFileNames
    );
}

export function getPhantomFileNamesFromEntries(
    entries: FileHunkEntry[],
    existingFileNames: Iterable<string>
): string[] {
    const existing = [...existingFileNames];
    const phantoms = new Set<string>();
    for (const entry of entries) {
        if (entry.state !== 'added') {
            continue;
        }
        const alreadyListed = existing.some((name) =>
            projectFilePathsMatch(name, entry.fileName)
        );
        if (!alreadyListed) {
            phantoms.add(entry.fileName);
        }
    }
    return [...phantoms];
}

export function getFileContentFromHunks(
    hunks: Hunk[],
    fileName: string
): string | null {
    const fileHunks = hunks.filter((h) => h.fileName === fileName);
    if (fileHunks.length === 0) {
        return null;
    }
    const lineAdd = fileHunks.find((h) => h.type === 'addLinesToFile');
    if (lineAdd?.text) {
        return lineAdd.text;
    }
    if (fileHunks.some((h) => h.type === 'addFile')) {
        return '';
    }
    return null;
}

export function fileHunkEntryForPath(
    entries: FileHunkEntry[],
    path: string
): FileHunkEntry | undefined {
    return entries.find((entry) => projectFilePathsMatch(entry.fileName, path));
}

/** Global accept/reject bar: any pending change, including a single hunk. */
export function shouldShowGlobalHunkBar(hunks: Hunk[]): boolean {
    return shouldShowGlobalHunkBarFromGroups(hunks, groupHunks(hunks));
}

export function shouldShowGlobalHunkBarFromGroups(
    hunks: Hunk[],
    groups: HunkGroup[]
): boolean {
    void groups;
    return hunks.length > 0;
}

export function fileNamesWithHunks(hunks: Hunk[]): Set<string> {
    const names = new Set<string>();
    for (const hunk of hunks) {
        if (hunk.fileName) {
            names.add(hunk.fileName);
        }
    }
    return names;
}

export function segmentIdsWithHunks(hunks: Hunk[]): Set<number> {
    const ids = new Set<number>();
    for (const hunk of hunks) {
        if (hunk.segmentId != null) {
            ids.add(hunk.segmentId);
        }
    }
    return ids;
}

export function hasHunksForSegment(hunks: Hunk[], segmentId: number): boolean {
    return hunks.some((h) => h.segmentId === segmentId);
}

export function hasHunksForFile(hunks: Hunk[], fileName: string): boolean {
    return hunks.some(
        (h) => h.fileName != null && projectFilePathsMatch(h.fileName, fileName)
    );
}

export function hunksForSegment(hunks: Hunk[], segmentId: number): Hunk[] {
    return hunks.filter((h) => h.segmentId === segmentId);
}

export function hunksForFile(hunks: Hunk[], fileName: string): Hunk[] {
    return hunks.filter(
        (h) => h.fileName != null && projectFilePathsMatch(h.fileName, fileName)
    );
}

type OverlayKind = 'add' | 'delete';

function splitContentLines(content: string): {
    lines: string[];
    endsWithNewline: boolean;
} {
    const normalized = content.replace(/\r\n/g, '\n');
    const endsWithNewline = normalized.endsWith('\n');
    const lines =
        normalized === ''
            ? []
            : (endsWithNewline ? normalized.slice(0, -1) : normalized).split(
                  '\n'
              );
    return { lines, endsWithNewline };
}

function joinContentLines(lines: string[], endsWithNewline: boolean): string {
    if (lines.length === 0) {
        return endsWithNewline ? '\n' : '';
    }
    return lines.join('\n') + (endsWithNewline ? '\n' : '');
}

function rawDeleteInserts(hunks: Hunk[]): { at: number; text: string[] }[] {
    const inserts: { at: number; text: string[] }[] = [];
    for (const hunk of hunks) {
        if (
            !isLineDelete(hunk.type) ||
            hunk.startLine == null ||
            hunk.text == null
        ) {
            continue;
        }
        inserts.push({
            at: Math.max(hunk.startLine - 1, 0),
            text: hunkTextLines(hunk),
        });
    }
    return inserts;
}

/**
 * startLine is against the already-changed document. Insert each delete at
 * that original line; do not shift later hunks because a previous hunk was
 * inserted (apply bottom-to-top).
 */
export function overlayDeleteHunksOnNewContent(
    content: string,
    hunks: Hunk[]
): string {
    const inserts = rawDeleteInserts(hunks);
    if (inserts.length === 0) {
        return content;
    }
    const { lines, endsWithNewline } = splitContentLines(content);
    const ordered = [...inserts].sort((a, b) => b.at - a.at);
    for (const insert of ordered) {
        const at = Math.min(Math.max(insert.at, 0), lines.length);
        if (linesMatchAt(lines, at, insert.text)) {
            continue;
        }
        lines.splice(at, 0, ...insert.text);
    }
    return joinContentLines(lines, endsWithNewline);
}

export function stripDeleteHunksFromContent(
    content: string,
    hunks: Hunk[]
): string {
    const inserts = rawDeleteInserts(hunks);
    if (inserts.length === 0) {
        return content;
    }
    const { lines, endsWithNewline } = splitContentLines(content);
    const ordered = inserts
        .map((insert) => ({
            start:
                insert.at +
                inserts
                    .filter((other) => other.at < insert.at)
                    .reduce((sum, other) => sum + other.text.length, 0),
            text: insert.text,
        }))
        .sort((a, b) => b.start - a.start);
    for (const op of ordered) {
        if (linesMatchAt(lines, op.start, op.text)) {
            lines.splice(op.start, op.text.length);
        }
    }
    return joinContentLines(lines, endsWithNewline);
}

/** Overlayed document line for a hunk startLine (after raw inserts). */
export function mapBaseLineToOverlayLine(
    hunks: Hunk[],
    baseLine: number,
    kind: OverlayKind
): number {
    let shift = 0;
    for (const hunk of hunks) {
        if (
            !isLineDelete(hunk.type) ||
            hunk.startLine == null ||
            hunk.text == null
        ) {
            continue;
        }
        const include =
            kind === 'add'
                ? hunk.startLine <= baseLine
                : hunk.startLine < baseLine;
        if (include) {
            shift += hunkLineCount(hunk);
        }
    }
    return Math.max(baseLine + shift, 1);
}

function linesMatchAt(
    lines: string[],
    start: number,
    expected: string[]
): boolean {
    if (expected.length === 0) {
        return true;
    }
    if (start < 0 || start + expected.length > lines.length) {
        return false;
    }
    return expected.every((line, index) => lines[start + index] === line);
}
