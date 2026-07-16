import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { ProjectShort } from '../../../model/domain';
import {
    useAllAvailableTagKeys,
    useSelectedFilterTagKeys,
} from '../../store/selectors/projectTags';
import { setSelectedFilterTagKeys } from '../../store/slices/projects';
import { AppDispatch } from '../../store';

export type SortMode = 'time' | 'title';
export type SortDirection = 'asc' | 'desc';

const toTimestamp = (value?: string) => {
    if (!value) {
        return 0;
    }
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? 0 : timestamp;
};

const titleCollator = new Intl.Collator(['en', 'ru'], {
    sensitivity: 'base',
    numeric: true,
});

export const sortProjects = (
    projects: ProjectShort[],
    sortMode: SortMode,
    sortDirection: SortDirection
): ProjectShort[] => {
    const byTimeDesc = (a: ProjectShort, b: ProjectShort) =>
        toTimestamp(b.lastModified) - toTimestamp(a.lastModified);
    const byTimeAsc = (a: ProjectShort, b: ProjectShort) =>
        toTimestamp(a.lastModified) - toTimestamp(b.lastModified);
    const byTitleAsc = (a: ProjectShort, b: ProjectShort) =>
        titleCollator.compare(a.title ?? '', b.title ?? '');
    const byTitleDesc = (a: ProjectShort, b: ProjectShort) =>
        titleCollator.compare(b.title ?? '', a.title ?? '');

    const projectsCopy = [...projects];
    if (sortMode === 'title') {
        return projectsCopy.sort(
            sortDirection === 'asc' ? byTitleAsc : byTitleDesc
        );
    }
    return projectsCopy.sort(sortDirection === 'asc' ? byTimeAsc : byTimeDesc);
};

export const filterProjectsByTags = (
    projects: ProjectShort[],
    selectedFilterTagKeys: string[],
    projectTagKeysByProject: Record<string, string[]>
): ProjectShort[] => {
    if (!selectedFilterTagKeys.length) {
        return projects;
    }
    const selectedSet = new Set(selectedFilterTagKeys);
    return projects.filter((project) => {
        const projectTagSet = new Set(
            projectTagKeysByProject[project.projectId] ?? []
        );
        return Array.from(selectedSet).every((tagKey) =>
            projectTagSet.has(tagKey)
        );
    });
};

type UseSortedFilteredProjectsParams = {
    projects: ProjectShort[];
    sortMode: SortMode;
    sortDirection: SortDirection;
    selectedFilterTagKeys: string[];
    projectTagKeysByProject: Record<string, string[]>;
};

export const useSortedFilteredProjects = ({
    projects,
    sortMode,
    sortDirection,
    selectedFilterTagKeys,
    projectTagKeysByProject,
}: UseSortedFilteredProjectsParams): ProjectShort[] => {
    return useMemo(() => {
        const sorted = sortProjects(projects, sortMode, sortDirection);
        return filterProjectsByTags(
            sorted,
            selectedFilterTagKeys,
            projectTagKeysByProject
        );
    }, [
        projects,
        sortMode,
        sortDirection,
        selectedFilterTagKeys,
        projectTagKeysByProject,
    ]);
};

// Убирает из фильтра теги, которых больше нет в списке доступных.
export const usePruneSelectedFilterTags = () => {
    const dispatch = useDispatch<AppDispatch>();
    const allAvailableTagKeys = useSelector(useAllAvailableTagKeys);
    const selectedFilterTagKeys = useSelector(useSelectedFilterTagKeys);

    useEffect(() => {
        const availableSet = new Set(allAvailableTagKeys);
        const nextSelectedFilterTagKeys = selectedFilterTagKeys.filter(
            (tagKey) => availableSet.has(tagKey)
        );
        const isChanged =
            nextSelectedFilterTagKeys.length !== selectedFilterTagKeys.length ||
            nextSelectedFilterTagKeys.some(
                (tagKey, index) => tagKey !== selectedFilterTagKeys[index]
            );
        if (isChanged) {
            dispatch(setSelectedFilterTagKeys(nextSelectedFilterTagKeys));
        }
    }, [allAvailableTagKeys, dispatch, selectedFilterTagKeys]);
};
