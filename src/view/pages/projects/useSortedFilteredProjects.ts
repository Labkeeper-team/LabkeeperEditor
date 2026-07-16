import { useMemo } from 'react';
import { ProjectShort } from '../../../model/domain';

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
