import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '..';
import { dictionary } from '../shared/dictionaries';

export const useDictionary = createSelector(
    (state: StorageState) => state.persistence.language,
    (state) => dictionary[state]
);

export const useCurrentLanguage = createSelector(
    (state: StorageState) => state.persistence.language,
    (state) => state
);
