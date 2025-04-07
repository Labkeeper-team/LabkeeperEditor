import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '..';
import { dictionary } from '../shared/dictionaries';

export const useDictionary = createSelector(
    (state: StorageState) => state.persistence.language,
    (state) => dictionary[state]
);

export const useErrorDictionary = createSelector(
    (state: StorageState) => state.persistence.language,
    (state) => dictionary[state].compile_error
);
export const useQuotaDefinitionDictionary = createSelector(
    (state: StorageState) => state.persistence.language,
    (state) => dictionary[state].quota_definition
);

export const useCurrentLanguge = createSelector(
    (state: StorageState) => state.persistence.language,
    (state) => state
);
