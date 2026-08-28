import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { EditorView } from '@codemirror/view';
import { AppDispatch, StorageState } from '../store';
import { useDictionary } from '../store/selectors/translations';
import { useIsProjectReadonly } from '../store/selectors/program.ts';
import {
    selectExpandedHunkGroups,
    selectHasHunksForFile,
    selectHasHunksForSegment,
    selectSegmentHasNewSegmentHunk,
} from '../store/selectors/hunks.ts';
import { controller } from '../../main.tsx';
import {
    dispatchHunkGroups,
    setHunkActionHandler,
} from '../pages/project/editor/hunkEditorExtension.ts';
import {
    filterHunkGroupsForFile,
    filterHunkGroupsForSegment,
} from '../../viewModel/utils/hunkGrouping.ts';

export function useHunkActionHandler(): void {
    const dispatch = useDispatch<AppDispatch>();

    useEffect(() => {
        setHunkActionHandler(({ action, hunkIds }) => {
            if (action === 'accept') {
                dispatch(controller.onHunkAcceptRequest({ hunkIds }));
            } else {
                dispatch(controller.onHunkRevertRequest({ hunkIds }));
            }
        });
        return () => setHunkActionHandler(null);
    }, [dispatch]);
}

export function useSyncHunksToEditorView(
    getView: () => EditorView | null | undefined,
    segmentId?: number,
    fileName?: string | null,
    viewEpoch = 0
): void {
    const dictionary = useSelector(useDictionary);
    const isReadonly = useSelector(useIsProjectReadonly);
    const isAuthenticated = useSelector(
        (state: StorageState) => state.user.isAuthenticated
    );
    const expandedGroups = useSelector(selectExpandedHunkGroups);
    const pendingHunkIds = useSelector(
        (state: StorageState) => state.ide.pendingHunkIds
    );
    const hasTargetHunks = useSelector((state: StorageState) =>
        fileName != null
            ? selectHasHunksForFile(state, fileName)
            : segmentId != null && selectHasHunksForSegment(state, segmentId)
    );
    const hasNewSegmentHunk = useSelector((state: StorageState) =>
        segmentId != null && fileName == null
            ? selectSegmentHasNewSegmentHunk(state, segmentId)
            : false
    );

    const sync = useCallback(() => {
        const view = getView();
        if (!view || isReadonly) {
            return;
        }

        if (!hasTargetHunks) {
            dispatchHunkGroups(
                view,
                [],
                pendingHunkIds,
                isAuthenticated,
                dictionary.hunks.revert
            );
            return;
        }

        const filtered = hasNewSegmentHunk
            ? []
            : fileName != null
              ? filterHunkGroupsForFile(expandedGroups, fileName)
              : filterHunkGroupsForSegment(expandedGroups, segmentId);
        const viewGroups = filtered.map((group) => ({
            ...group,
            acceptLabel: dictionary.hunks.accept,
        }));
        dispatchHunkGroups(
            view,
            viewGroups,
            pendingHunkIds,
            isAuthenticated,
            dictionary.hunks.revert
        );
    }, [
        getView,
        isReadonly,
        hasTargetHunks,
        hasNewSegmentHunk,
        expandedGroups,
        pendingHunkIds,
        isAuthenticated,
        segmentId,
        fileName,
        dictionary.hunks.accept,
        dictionary.hunks.revert,
    ]);

    useEffect(() => {
        sync();
    }, [sync, viewEpoch]);
}
