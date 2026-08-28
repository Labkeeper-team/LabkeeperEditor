import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '../index.ts';
import {
    buildFileHunkEntries,
    expandGroupsForDisplay,
    fileNamesWithHunks,
    findNewSegmentHunkGroup,
    groupHunks,
    hasHunksForFile,
    hasHunksForSegment,
    hunksForSegment,
    shouldShowGlobalHunkBarFromGroups,
    getPhantomFileNamesFromEntries,
    type HunkGroup,
} from '../../../viewModel/utils/hunkGrouping.ts';

const selectHunks = (state: StorageState) => state.ide.hunks;
const selectPendingHunkIds = (state: StorageState) => state.ide.pendingHunkIds;

export const selectGroupedHunks = createSelector([selectHunks], (hunks) =>
    groupHunks(hunks)
);

export const selectExpandedHunkGroups = createSelector(
    [selectGroupedHunks],
    (groups) => expandGroupsForDisplay(groups)
);

export const selectGroupedHunkCount = createSelector(
    [selectGroupedHunks],
    (groups) => groups.length
);

export const selectShouldShowGlobalHunkBar = createSelector(
    [selectHunks, selectGroupedHunks],
    (hunks, groups) => shouldShowGlobalHunkBarFromGroups(hunks, groups)
);

export const selectFileHunkEntries = createSelector(
    [selectGroupedHunks],
    (groups) => buildFileHunkEntries(groups)
);

export const selectFilesWithHunks = createSelector([selectHunks], (hunks) =>
    fileNamesWithHunks(hunks)
);

const selectExistingFileNames = (
    _state: StorageState,
    existingFileNames: string[]
) => existingFileNames;

export const selectPhantomFileNames = createSelector(
    [selectFileHunkEntries, selectExistingFileNames],
    (entries, existingFileNames) =>
        getPhantomFileNamesFromEntries(entries, existingFileNames)
);

const selectSegmentId = (_state: StorageState, segmentId: number) => segmentId;
const selectFileName = (_state: StorageState, fileName: string) => fileName;

export const selectHasHunksForSegment = createSelector(
    [selectHunks, selectSegmentId],
    (hunks, segmentId) => hasHunksForSegment(hunks, segmentId)
);

export const selectHasHunksForFile = createSelector(
    [selectHunks, selectFileName],
    (hunks, fileName) => hasHunksForFile(hunks, fileName)
);

export const selectSegmentHasNewSegmentHunk = createSelector(
    [selectHunks, selectSegmentId],
    (hunks, segmentId) =>
        hunks.some(
            (hunk) => hunk.type === 'addSegment' && hunk.segmentId === segmentId
        )
);

const EMPTY_SEGMENT_HUNK_IDS: string[] = [];

export type SegmentHunkUiState = {
    newSegmentHunkGroup: HunkGroup | undefined;
    segmentHunkIds: string[];
    hasHunks: boolean;
    hasNewSegmentHunk: boolean;
    isPending: boolean;
};

const EMPTY_SEGMENT_HUNK_UI: SegmentHunkUiState = {
    newSegmentHunkGroup: undefined,
    segmentHunkIds: EMPTY_SEGMENT_HUNK_IDS,
    hasHunks: false,
    hasNewSegmentHunk: false,
    isPending: false,
};

export const selectSegmentHunkUiState = createSelector(
    [selectHunks, selectGroupedHunks, selectPendingHunkIds, selectSegmentId],
    (hunks, groups, pendingHunkIds, segmentId): SegmentHunkUiState => {
        const segmentHunks = hunksForSegment(hunks, segmentId);
        if (segmentHunks.length === 0) {
            return EMPTY_SEGMENT_HUNK_UI;
        }

        const segmentHunkIds = segmentHunks.map((hunk) => hunk.id);
        return {
            newSegmentHunkGroup: findNewSegmentHunkGroup(groups, segmentId),
            segmentHunkIds,
            hasHunks: true,
            hasNewSegmentHunk: segmentHunks.some(
                (hunk) => hunk.type === 'addSegment'
            ),
            isPending: segmentHunkIds.some((id) => pendingHunkIds.includes(id)),
        };
    }
);
