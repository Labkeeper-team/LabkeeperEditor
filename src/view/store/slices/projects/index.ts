import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ProjectShort } from '../../../../model/domain.ts';
import { LOGOUT_TYPE } from '../../actions';
import { projectsInitialState } from '../index.ts';

export const projectsSlice = createSlice({
    name: 'projectsSlice',
    initialState: projectsInitialState,
    reducers: {
        setProjects: (state, { payload }: PayloadAction<ProjectShort[]>) => {
            state.projects = payload;
        },
        clearProjects: (state) => {
            state = projectsInitialState;
            return state;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = projectsInitialState;
            return state;
        });
    },
});
export const { setProjects, clearProjects } = projectsSlice.actions;
