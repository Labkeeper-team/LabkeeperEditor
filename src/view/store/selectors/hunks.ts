import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '../index.ts';
import type { ProjectParameters } from '../../../model/domain.ts';
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
    deletedSegmentsByPosition,
    projectParameterChanges,
    projectParameterHunks,
    withoutStaleFileDeletions,
    type HunkGroup,
} from '../../../viewModel/utils/hunkGrouping.ts';

const selectStoredHunks = (state: StorageState) => state.ide.hunks;
const selectProjectFiles = (state: StorageState) => state.project.files;

/**
 * Ханки, которые видит человек. GH-188: удаление файла, созданного заново под
 * тем же именем, решать уже не о чем, и кнопок у него нет нигде. Считается на
 * лету: во время прогона ханки приходят раньше списка файлов
 */
export const selectShownHunks = createSelector(
    [selectStoredHunks, selectProjectFiles],
    (hunks, files) =>
        withoutStaleFileDeletions(
            hunks,
            files.map((file) => file.fileName)
        )
);
const selectHunks = selectShownHunks;
const selectPendingHunkIds = (state: StorageState) => state.ide.pendingHunkIds;

export const selectGroupedHunks = createSelector([selectHunks], (hunks) =>
    groupHunks(hunks)
);

export const selectExpandedHunkGroups = createSelector(
    [selectGroupedHunks],
    (groups) => expandGroupsForDisplay(groups)
);

/** GH-284: смена параметров проекта в группы не входит, у неё нет места в документе, но это тоже правка */
export const selectGroupedHunkCount = createSelector(
    [selectHunks, selectGroupedHunks],
    (hunks, groups) => groups.length + projectParameterHunks(hunks).length
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

const selectSegmentCount = (state: StorageState) =>
    state.project.currentProgram?.segments.length ?? 0;

export const selectDeletedSegmentsByPosition = createSelector(
    [selectHunks, selectSegmentCount],
    (hunks, segmentCount) => deletedSegmentsByPosition(hunks, segmentCount)
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

/** GH-284: параметры проекта сейчас, с ними сверяются ханки параметров проекта */
export const selectProjectParameters = createSelector(
    [
        (state: StorageState) => state.project.mode,
        (state: StorageState) =>
            state.project.currentProgram?.parameters?.roundStrategy,
        (state: StorageState) =>
            state.project.currentProgram?.parameters?.latexCompiler,
    ],
    (projectType, roundStrategy, latexCompiler): ProjectParameters => ({
        projectType,
        roundStrategy: roundStrategy ?? 'noRound',
        // у программ до выбора движка поля нет: сервер собирает их pdflatex
        latexCompiler: latexCompiler ?? 'pdflatex',
    })
);

/** GH-284: на кнопке настроек проекта точка, пока правка параметров проекта ждёт решения */
export const selectHasProjectParameterChanges = createSelector(
    [selectHunks, selectProjectParameters],
    (hunks, current) =>
        projectParameterHunks(hunks).some(
            (hunk) =>
                projectParameterChanges(hunk.previousParameters, current)
                    .length > 0
        )
);
