import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '../index.ts';
import {
    expandGroupsForDisplay,
    groupHunks,
} from '../../../viewModel/utils/hunkGrouping.ts';

const selectHunks = (state: StorageState) => state.ide.hunks;

export const selectExpandedHunkGroups = createSelector([selectHunks], (hunks) =>
    expandGroupsForDisplay(groupHunks(hunks))
);
