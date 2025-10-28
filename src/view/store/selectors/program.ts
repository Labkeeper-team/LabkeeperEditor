import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '../index.ts';

export const useProjects = createSelector(
    (state: StorageState) => state.projects,
    (p) => p.projects
);
export const useCurrentProject = createSelector(
    (state: StorageState) => state.project,
    (p) => p.project
);
export const useCompiledSuccesInfo = createSelector(
    (state: StorageState) => state.project,
    (s) => s.compileSuccessResult
);
export const useCompiledSegments = createSelector(
    (state: StorageState) => state.project,
    (s) => s.compileSuccessResult?.segments
);
export const useCompiledSegmentsSize = createSelector(
    (state: StorageState) => state.project,
    (s) => s.compileSuccessResult?.segments?.length
);
export const useCompiledErrors = createSelector(
    (state: StorageState) => state.project,
    (e) => e.compileErrorResult?.errors
);
export const useInputSegmentsSize = createSelector(
    (state: StorageState) => state.project.currentProgram,
    (p) => p?.segments?.length
);
export const useCurrentProgram = createSelector(
    (state: StorageState) => state.project,
    (state) => state.currentProgram
);
export const useUser = createSelector(
    (state: StorageState) => state,
    (state) => state.user
);
export const useActiveElement = createSelector(
    (state: StorageState) => state.ide,
    (index) => index.activeSegmentIndex
);
export const useSearch = createSelector(
    (state: StorageState) => state.ide,
    (s) => s.search
);
export const useIsSegmentIsActive = (id: number) =>
    createSelector(
        (state: StorageState) => state.ide.activeSegmentIndex,
        (index) => index === id
    );

export const useSegment = (id: number) =>
    createSelector(
        [
            (state: StorageState) => state.project.compileSuccessResult?.segments,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            (_: StorageState) => id
        ],
        (segments, id) => segments?.find((_, i) => i === id)
    );
export const useShowTour = createSelector(
    (state: StorageState) => state.settings,
    (s) => s.showTour
);

export const useShowFileManager = createSelector(
    (state: StorageState) => state.settings,
    (settings) => settings.showFileManager
);

export const useInstructionsExpanded = createSelector(
    (state: StorageState) => state.persistence.instructionExpanded,
    (s) => s
);
export const useIsDraggedToFileManager = createSelector(
    (state: StorageState) => state.settings.isFileDraggedToManager,
    (s) => s
);
export const useIsProjectReadonly = createSelector(
    (state: StorageState) => state.project.projectIsReadonly,
    (s) => s
);

export const useFileInFileManager = createSelector(
    (state: StorageState) => state.project.files,
    (files) => files
);
