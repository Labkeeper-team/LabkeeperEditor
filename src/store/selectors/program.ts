import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '..';

//projects
export const useProjects = createSelector(
  (state: StorageState) => state.projects.projects,
  (p) => p
);

// program
export const useCurrentProject = createSelector(
  (state: StorageState) => state.project.project,
  (p) => p
);
export const useCurrentProjectId = createSelector(
  (state: StorageState) => state.project,
  (state) => state.project?.projectId
);
export const useCurrentProgram = createSelector(
  (state: StorageState) => state.project,
  (state) => state.history[state.historyAcitveIndex]
);
export const useProgramHistory = createSelector(
  (state: StorageState) => state.project,
  (state) => state.history
);
export const useProgramHistoryActiveIndex = createSelector(
  (state: StorageState) => state.project,
  (state) => state.historyAcitveIndex
);
export const useSegment = (id: number) =>
  createSelector(
    (state: StorageState) => state.project,
    (state) => state.history[state.historyAcitveIndex]?.segments[id]
  );
export const useActiveSegment = (segmentId: number) =>
  createSelector(
    (state: StorageState) => state.project,
    (project) =>
      project.history[project.historyAcitveIndex]?.segments?.find(s => s.id === segmentId)
  );

export const useCompiledSuccesInfo = createSelector(
  (state: StorageState) => state.project.compileSuccessResult,
  (s) => s
);
export const useCompiledSegments = createSelector(
  (state: StorageState) => state.project.compileSuccessResult?.segments,
  (s) => s
);
export const useCompiledErrors = createSelector(
  (state: StorageState) => state.project.compileErrorResult?.errors,
  (e) => e
);

export const useSegmentErrors = (segmentId: number) => createSelector(
  (state: StorageState) => state.project.compileErrorResult?.errors,
  (e) => (e || []).filter(er => er.payload.segmentId === segmentId) 
);


// Auth
export const useUser = createSelector(
  (state: StorageState) => state.user,
  (state) => state
);
export const useNeedLogin = createSelector(
  (state: StorageState) => state.ide.needLogin,
  (nL) => nL
);

// Ide editor
export const useActiveElement = createSelector(
  (state: StorageState) => state.ide.activeSegmentIndex,
  (index) => index
);
export const useIsAutocompilationEnabeled = createSelector(
  (state: StorageState) => state.ide.isAutocompilation,
  (comp) => comp
);
export const useIsHightlight = createSelector(
  (state: StorageState) => state.ide.isHighlighntingCode,
  (comp) => comp
);
export const useShowHint = createSelector(
  (state: StorageState) => state.ide.showHIntAboutVariables,
  (comp) => comp
);
export const useSearch = createSelector(
  (state: StorageState) => state.ide.search,
  (s) => s
);
export const useIsSegmentIsActive = (id: number) =>
  createSelector(
    (state: StorageState) => state.ide.activeSegmentIndex,
    (index) => index === id
  );
export const useActiveSegmentIndex = () =>
  createSelector(
    (state: StorageState) => state.ide.activeSegmentIndex,
    (index) => index
  );
// settings
export const useShowTour = createSelector(
  (state: StorageState) => state.settings.showTour,
  (s) => s
);
