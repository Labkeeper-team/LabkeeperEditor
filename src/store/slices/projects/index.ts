import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProjectShort } from '../../../shared/models/project';
import { LOGOUT_TYPE } from '../../actions';

export interface ProjectsState {
    projects: ProjectShort[];
}

const initialState: ProjectsState = {
    projects: [],
};

export const projectsSlice = createSlice({
    name: 'projectsSlice',
    initialState,
    reducers: {
        setProjects: (state, { payload }: PayloadAction<ProjectShort[]>) => {
            state.projects = payload;
        },
        clearProjects: (state) => {
            state = initialState;
            return state;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = initialState;
            return state;
        });
    },
});
export const { setProjects, clearProjects } = projectsSlice.actions;
