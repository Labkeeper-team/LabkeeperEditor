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
    },
});
export const { setProjects } = projectsSlice.actions;
