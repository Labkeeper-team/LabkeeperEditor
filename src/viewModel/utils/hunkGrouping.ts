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

const isLineAdd = (t: Hunk['type']) =>
    t === 'addLinesToFile' || t === 'addLinesToSegment';
const isLineDelete = (t: Hunk['type']) =>
    t === 'deleteLinesFromFile' || t === 'deleteLinesFromSegment';
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
    if (creation.type === 'addFile' && addition.type === 'addLinesToFile') {
        return creation.fileName === addition.fileName;
    }
    if (
        creation.type === 'addSegment' &&
        addition.type === 'addLinesToSegment'
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
            if (hunk.text) {
                deletedLines.push(...hunk.text.split('\n'));
            }
            if (hunk.startLine != null) {
                anchorLine = hunk.startLine;
            }
            continue;
        }
        if (isLineAdd(hunk.type)) {
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
    const remaining = [...hunks];
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

export function resolveControlsLine(
    group: HunkGroup,
    docLines: number
): number {
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
            const textLineCount = lineAdd.text.split('\n').length;
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

export function getNewSegmentHunkGroup(
    hunks: Hunk[],
    segmentId: number
): HunkGroup | undefined {
    return groupHunks(hunks).find(
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
    return groupHunks(hunks)
        .filter((group) => group.target.kind === 'file')
        .map((group) => {
            const hasAddFile = group.hunks.some((h) => h.type === 'addFile');
            const hasLineAdd = group.hunks.some(
                (h) => h.type === 'addLinesToFile'
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
    const existing = [...existingFileNames];
    const phantoms = new Set<string>();
    for (const entry of getFileHunkEntries(hunks)) {
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

/** Global accept/reject bar: several groups, or both file and segment hunks. */
export function shouldShowGlobalHunkBar(hunks: Hunk[]): boolean {
    if (hunks.length === 0) {
        return false;
    }
    const groups = groupHunks(hunks);
    if (groups.length > 1) {
        return true;
    }
    const hasFileHunks = hunks.some((h) => h.fileName != null);
    const hasSegmentHunks = hunks.some((h) => h.segmentId != null);
    return hasFileHunks && hasSegmentHunks;
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

export function hunksForSegment(hunks: Hunk[], segmentId: number): Hunk[] {
    return hunks.filter((h) => h.segmentId === segmentId);
}

export function hunksForFile(hunks: Hunk[], fileName: string): Hunk[] {
    return hunks.filter((h) => h.fileName === fileName);
}
