import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProjectShort, ProjectTemplate } from '../../../../model/domain.ts';
import { TemplatesRequestState } from '../../../../viewModel/repository';
import { projectsInitialState } from '../index.ts';

export const projectsSlice = createSlice({
    name: 'projectsSlice',
    initialState: projectsInitialState,
    reducers: {
        setProjects: (state, { payload }: PayloadAction<ProjectShort[]>) => {
            state.projects = payload;
        },
        setTemplates: (
            state,
            { payload }: PayloadAction<ProjectTemplate[]>
        ) => {
            state.templates = payload;
        },
        setTemplatesRequestState: (
            state,
            { payload }: PayloadAction<TemplatesRequestState>
        ) => {
            state.templatesRequestState = payload;
        },
    },
});
export const { setProjects, setTemplates, setTemplatesRequestState } =
    projectsSlice.actions;
