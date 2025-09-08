import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
    CompileErrorResultList,
    CompileSuccessResult,
    LabkeeperFile,
    OutputSegment,
    Program,
    Project,
    Segment,
} from '../../../../model/domain.ts';
import { projectInitialState } from '../index.ts';

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
            while (
                state.compileSuccessResult.segments.length <
                payload.segments.length
            ) {
                state.compileSuccessResult.segments.push({} as Segment);
            }
            while (
                state.compileSuccessResult.segments.length >
                payload.segments.length
            ) {
                state.compileSuccessResult.segments.pop();
            }
            if (
                state.compileSuccessResult.segments.length ===
                payload.segments.length
            ) {
                for (let i = 0; i < payload.segments.length; i++) {
                    if (
                        JSON.stringify(
                            state.compileSuccessResult.segments[i]
                        ) !== JSON.stringify(payload.segments[i])
                    ) {
                        state.compileSuccessResult.segments[i] =
                            structuredClone(payload.segments[i]);
                    }
                }
            } else {
                state.compileSuccessResult = structuredClone(payload);
            }
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
            while (
                state.currentProgram.segments.length < payload.segments.length
            ) {
                state.currentProgram.segments.push({} as Segment);
            }
            while (
                state.currentProgram.segments.length > payload.segments.length
            ) {
                state.currentProgram.segments.pop();
            }
            if (
                state.currentProgram.segments.length === payload.segments.length
            ) {
                for (let i = 0; i < payload.segments.length; i++) {
                    if (
                        JSON.stringify(state.currentProgram.segments[i]) !==
                        JSON.stringify(payload.segments[i])
                    ) {
                        state.currentProgram.segments[i] = structuredClone(
                            payload.segments[i]
                        );
                    }
                }
                state.currentProgram.parameters = structuredClone(
                    payload.parameters
                );
            } else {
                state.currentProgram = structuredClone(payload);
            }
        },
        setFiles: (state, { payload }: PayloadAction<LabkeeperFile[]>) => {
            state.files = payload;
        },
        setProject: (
            state,
            { payload }: PayloadAction<Project | undefined>
        ) => {
            state.project = payload;
        },
    },
});

export const {
    setProject,
    setFiles,
    setReadOnly,
    setCompileResult,
    setCompileError,
    setCurrentProgram,
    setCompileResultForSegment,
    setCompileResultSegmentsSize,
} = projectSlice.actions;
