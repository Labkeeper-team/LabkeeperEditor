import { createSelector } from '@reduxjs/toolkit';
import { StorageState } from '../index.ts';
import {
    DEFAULT_TAG_COLOR,
    normalizeColorInput,
    normalizeTagLabel,
} from '../../pages/projects/tagColorUtils';

type TagInfo = { label: string; color: string };

const useProjectTagsViewModel = createSelector(
    (state: StorageState) => state.projects.projects,
    (projects) => {
        const tagMap: Record<string, TagInfo> = {};
        const projectTagKeysByProject: Record<string, string[]> = {};

        for (const project of projects) {
            const projectTagKeys = new Set<string>();
            for (const tag of project.tags ?? []) {
                const label = normalizeTagLabel(tag.name);
                const color =
                    normalizeColorInput(tag.color) ?? DEFAULT_TAG_COLOR;
                if (!label) {
                    continue;
                }
                const key = label.toLocaleLowerCase();
                projectTagKeys.add(key);
                if (!tagMap[key]) {
                    tagMap[key] = { label, color };
                }
            }
            projectTagKeysByProject[project.projectId] =
                Array.from(projectTagKeys);
        }

        return { tagMap, projectTagKeysByProject };
    }
);

export const useTagMap = createSelector(
    useProjectTagsViewModel,
    (vm) => vm.tagMap
);

export const useAllAvailableTagKeys = createSelector(useTagMap, (tagMap) => {
    const collator = new Intl.Collator(['en', 'ru'], {
        sensitivity: 'base',
        numeric: true,
    });
    return Object.keys(tagMap).sort((a, b) =>
        collator.compare(tagMap[a]?.label ?? a, tagMap[b]?.label ?? b)
    );
});

export const useProjectTagKeysByProject = createSelector(
    useProjectTagsViewModel,
    (vm) => vm.projectTagKeysByProject
);

export const useNextTagColorInput = createSelector(
    (state: StorageState) => state.projects,
    (p) => p.nextTagColorInput
);

export const useNextTagColor = createSelector(
    (state: StorageState) => state.projects,
    (p) => p.nextTagColor
);

export const useSelectedFilterTagKeys = createSelector(
    (state: StorageState) => state.projects,
    (p) => p.selectedFilterTagKeys
);
