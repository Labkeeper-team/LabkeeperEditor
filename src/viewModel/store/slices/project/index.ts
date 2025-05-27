import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    Program,
    Project,
} from '../../../../model/domain';
import { LOGOUT_TYPE } from '../../actions';
import { projectInitialState } from '../index.ts';

export interface ProjectState {
    project?: Project;
    compileSuccessResult?: CompileSuccessResult;
    compileErrorResult?: CompileErrorResultList;
    currentProgram: Program;
    projectIsReadonly: boolean;
    files: LabkeeperFile[];
}

export const projectSlice = createSlice({
    name: 'projectSlice',
    initialState: projectInitialState,
    reducers: {
        /*
        SETTERS
         */
        setReadOnly: (state, { payload }: PayloadAction<boolean>) => {
            state.projectIsReadonly = payload;
        },
        setCompileResult: (
            state,
            { payload }: PayloadAction<CompileSuccessResult>
        ) => {
            state.compileSuccessResult = payload;
        },
        setCompileError: (
            state,
            { payload }: PayloadAction<CompileErrorResultList>
        ) => {
            state.compileErrorResult = payload;
        },
        setCurrentProgram: (state, { payload }: PayloadAction<Program>) => {
            state.currentProgram = payload;
        },
        setFiles: (state, { payload }: PayloadAction<LabkeeperFile[]>) => {
            state.files = payload;
        },
        setProject: (state, { payload }: PayloadAction<Project>) => {
            state.project = payload;
        },
        clearProject: (state) => {
            state = projectInitialState;
            return state;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = projectInitialState;
            return state;
        });
    },
});

export const {
    setProject,
    clearProject,
    setFiles,
    setReadOnly,
    setCompileResult,
    setCompileError,
    setCurrentProgram,
} = projectSlice.actions;
