import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '..';

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
export const useCompiledErrors = createSelector(
    (state: StorageState) => state.project,
    (e) => e.compileErrorResult?.errors
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
export const useShowTour = createSelector(
    (state: StorageState) => state.settings,
    (s) => s.showTour
);
