import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProjectShort } from '../../../../model/domain.ts';
import { projectsInitialState } from '../index.ts';

export const projectsSlice = createSlice({
    name: 'projectsSlice',
    initialState: projectsInitialState,
    reducers: {
        setProjects: (state, { payload }: PayloadAction<ProjectShort[]>) => {
            state.projects = payload;
        },
        setProjectTagsByProject: (
            state,
            { payload }: PayloadAction<Record<string, Record<string, string>>>
        ) => {
            state.byProject = payload;
        },
        setProjectTagsForProject: (
            state,
            {
                payload,
            }: PayloadAction<{
                projectId: string;
                tags: Record<string, string>;
            }>
        ) => {
            state.byProject[payload.projectId] = payload.tags;
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
    setProjectTagsByProject,
    setProjectTagsForProject,
    setNextTagColor,
    setNextTagColorInput,
    setSelectedFilterTagKeys,
} = projectsSlice.actions;
