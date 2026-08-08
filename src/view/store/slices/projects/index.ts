import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProjectShort, ProjectTag } from '../../../../model/domain.ts';
import { projectsInitialState } from '../index.ts';

export const projectsSlice = createSlice({
    name: 'projectsSlice',
    initialState: projectsInitialState,
    reducers: {
        setProjects: (state, { payload }: PayloadAction<ProjectShort[]>) => {
            state.projects = payload;
        },
        setProjectTagsForProject: (
            state,
            {
                payload,
            }: PayloadAction<{
                projectId: string;
                tags: ProjectTag[];
            }>
        ) => {
            const project = state.projects.find(
                (item) => item.projectId === payload.projectId
            );
            if (project) {
                project.tags = payload.tags;
            }
        },
        setNextTagColor: (state, { payload }: PayloadAction<string>) => {
            state.nextTagColor = payload;
        },
        setNextTagColorInput: (state, { payload }: PayloadAction<string>) => {
            state.nextTagColorInput = payload;
        },
        setSelectedFilterTagKeys: (
            state,
            { payload }: PayloadAction<string[]>
        ) => {
            state.selectedFilterTagKeys = payload;
        },
    },
});
export const {
    setProjects,
    setProjectTagsForProject,
    setNextTagColor,
    setNextTagColorInput,
    setSelectedFilterTagKeys,
} = projectsSlice.actions;
