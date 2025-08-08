import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    OutputSegment,
    Program,
    Project,
} from '../../../../model/domain';
import { LOGOUT_TYPE } from '../../actions';
import { projectInitialState } from '../index.ts';

export interface ProjectState {
    project?: Project;
    compileSuccessResult: CompileSuccessResult;
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
        setCompileResultSegmentsSize: (
            state,
            { payload }: PayloadAction<number>
        ) => {
            state.compileSuccessResult.segments.length = payload;
        },
        setCompileResultForSegment: (
            state,
            {
                payload,
            }: PayloadAction<{ index: number; segment: OutputSegment }>
        ) => {
            if (state.compileSuccessResult.segments.length > payload.index) {
                state.compileSuccessResult.segments[payload.index] =
                    payload.segment;
            }
        },
        setCurrentProgram: (state, { payload }: PayloadAction<Program>) => {
            if (
                state.currentProgram.segments.length === payload.segments.length
            ) {
                for (let i = 0; i < payload.segments.length; i++) {
                    state.currentProgram.segments[i].text =
                        payload.segments[i].text;
                    state.currentProgram.segments[i].type =
                        payload.segments[i].type;
                    state.currentProgram.segments[i].parameters =
                        structuredClone(payload.segments[i].parameters);
                }
            } else {
                state.currentProgram = structuredClone(payload);
            }
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
    setCompileResultForSegment,
    setCompileResultSegmentsSize,
} = projectSlice.actions;
