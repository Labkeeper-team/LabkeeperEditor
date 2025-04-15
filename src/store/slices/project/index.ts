import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import {
    CompileErrorResult,
    CompileErrorResultList,
    CompileSuccessResult,
    Program,
    ProgramRoundStrategy,
    Project,
    Segment,
} from '../../../shared/models/project';
import { LOGOUT_TYPE } from '../../actions';

export interface ProjectState {
    project?: Project;
    compileSuccessResult?: CompileSuccessResult;
    compileErrorResult?: CompileErrorResultList;
    historyAcitveIndex: number;
    history: Program[];
    projectIsReadonly: boolean;
}

const initialState: ProjectState = {
    compileErrorResult: { errors: [] },
    history: [],
    historyAcitveIndex: -1,
    projectIsReadonly: true,
};

export const projectSlice = createSlice({
    name: 'projectSlice',
    initialState,
    reducers: {
        setReadOnly: (state, { payload }: PayloadAction<boolean>) => {
            state.projectIsReadonly = payload;
        },
        setProject: (state, { payload }: PayloadAction<Project>) => {
            state.project = payload;
            state.projectIsReadonly = false;
        },
        setProjectName: (state, { payload }: PayloadAction<string>) => {
            if (!state.project?.title) {
                return;
            }
            state.project.title = payload;
        },
        setNewProgram: (state, { payload }: PayloadAction<Program>) => {
            state.history.push(payload);
            state.historyAcitveIndex++;
            return state;
        },
        setProgramRoundStrategy: (
            state,
            { payload }: PayloadAction<ProgramRoundStrategy>
        ) => {
            state.history[state.historyAcitveIndex].parameters.roundStrategy =
                payload;
        },
        setCompileResult: (
            state,
            { payload }: PayloadAction<CompileSuccessResult>
        ) => {
            state.compileSuccessResult = payload;
            state.compileErrorResult = { errors: [] };
        },
        changeSegmentText: (
            state,
            { payload }: PayloadAction<{ index: number; text: string }>
        ) => {
            if (!state.history.length) {
                return;
            }
            if (state.historyAcitveIndex < 0) {
                return;
            }
            const oldProgram = JSON.parse(
                JSON.stringify(state.history[state.historyAcitveIndex])
            );
            const newProgram = { ...oldProgram };
            if (newProgram.segments[payload.index].text !== payload.text) {
                newProgram.segments[payload.index].text = payload.text;
                state.history = state.history.filter((_, index) => {
                    return index <= state.historyAcitveIndex;
                });
                state.history.push(newProgram);
                state.historyAcitveIndex = state.history.length - 1;
                return state;
            }
        },
        changeSegmentTextById: (
            state,
            { payload }: PayloadAction<{ id: number; text: string }>
        ) => {
            if (!state.history.length) {
                return;
            }
            if (state.historyAcitveIndex < 0) {
                return;
            }
            const oldProgram = JSON.parse(
                JSON.stringify(state.history[state.historyAcitveIndex])
            );
            const newProgram = { ...oldProgram };
            newProgram.segments = newProgram.segments.map((s) => {
                if (s.id === payload.id && s.text !== payload.text) {
                    s.text = payload.text;
                }
                return s;
            });
            state.history.push(newProgram);
            state.historyAcitveIndex = state.history.length - 1;
        },

        addSegment: (state, { payload }: PayloadAction<Segment>) => {
            const oldProgram: Program = JSON.parse(
                JSON.stringify(state.history[state.historyAcitveIndex])
            );
            const newProgram = { ...oldProgram };
            const segmentIds = newProgram.segments.map((s) => s.id ?? 0);
            const maxSegmentId = segmentIds.length
                ? (Math.max(...segmentIds) ?? 0)
                : 0;
            payload.id = maxSegmentId + 1;
            newProgram.segments.push(payload);
            newProgram.segments.forEach((segment, index) => {
                segment.id = index + 1;
            });
            state.history = state.history.filter((_, index) => {
                return index <= state.historyAcitveIndex;
            });
            state.history.push(newProgram);
            state.historyAcitveIndex = state.history.length - 1;
        },

        addSegmentAfter: (
            state,
            { payload }: PayloadAction<{ segment: Segment; after: number }>
        ) => {
            const oldProgram: Program = JSON.parse(
                JSON.stringify(state.history[state.historyAcitveIndex])
            );
            const newProgram = { ...oldProgram };
            const segmentIds = newProgram.segments.map((s) => s.id ?? 0);
            const maxSegmentId = segmentIds.length
                ? (Math.max(...segmentIds) ?? 0)
                : 0;
            payload.segment.id = maxSegmentId + 1;

            // Вставляем новый сегмент после указанной позиции
            newProgram.segments.splice(payload.after + 1, 0, payload.segment);
            newProgram.segments.forEach((segment, index) => {
                segment.id = index + 1;
            });

            state.history = state.history.filter((_, index) => {
                return index <= state.historyAcitveIndex;
            });
            state.history.push(newProgram);
            state.historyAcitveIndex = state.history.length - 1;
        },

        changeSegmentPosition: (
            state,
            {
                payload,
            }: PayloadAction<{
                currentPosition: number;
                direction: 'up' | 'down';
            }>
        ) => {
            if (!payload.currentPosition && payload.direction === 'up') {
                return;
            }
            const oldProgram: Program = JSON.parse(
                JSON.stringify(state.history[state.historyAcitveIndex])
            );
            const newProgram = { ...oldProgram };
            if (
                payload.direction === 'down' &&
                newProgram.segments.length - 1 === payload.currentPosition
            ) {
                return;
            }
            const currentSegment = {
                ...newProgram.segments[payload.currentPosition],
            };
            const currentSegmentId = currentSegment.id;
            const changePositionIndex =
                payload.direction === 'up'
                    ? payload.currentPosition - 1
                    : payload.currentPosition + 1;
            const changesSegment = {
                ...newProgram.segments[changePositionIndex],
            };
            const changesSegmentId = changesSegment.id;

            changesSegment.id = currentSegmentId;
            currentSegment.id = changesSegmentId;

            newProgram.segments[payload.currentPosition] = changesSegment;
            newProgram.segments[changePositionIndex] = currentSegment;

            newProgram.segments.forEach((segment, index) => {
                segment.id = index + 1;
            });

            state.history = state.history.filter(
                (_, index) => index <= state.historyAcitveIndex
            );
            state.history.push(newProgram);
            state.historyAcitveIndex = state.history.length - 1;
        },
        deleteSegment: (state, { payload }: PayloadAction<number>) => {
            const oldProgram = JSON.parse(
                JSON.stringify(state.history[state.historyAcitveIndex])
            );
            const newProgram = { ...oldProgram };
            newProgram.segments = oldProgram.segments.filter(
                (_: unknown, i: number) => {
                    return i !== payload;
                }
            );
            newProgram.segments.forEach((segment, index) => {
                segment.id = index + 1;
            });
            state.history = state.history.filter((_, index) => {
                return index <= state.historyAcitveIndex;
            });
            state.history.push(newProgram);
            state.historyAcitveIndex = state.history.length - 1;
        },
        setSegmentVisibility: (
            state,
            {
                payload,
            }: PayloadAction<{ index: number; visible: boolean; name: string }>
        ) => {
            const oldProgram = JSON.parse(
                JSON.stringify(state.history[state.historyAcitveIndex])
            );
            const newProgram = { ...oldProgram };
            if (newProgram && newProgram.segments[payload.index]) {
                newProgram.segments[payload.index].parameters[payload.name] =
                    payload.visible;
                state.history = state.history.filter((_, index) => {
                    return index <= state.historyAcitveIndex;
                });
                state.history.push(newProgram);
                state.historyAcitveIndex = state.history.length - 1;
                return state;
            }
        },

        setCompileError: (
            state,
            { payload }: PayloadAction<CompileErrorResultList>
        ) => {
            state.compileErrorResult = payload;
            state.compileSuccessResult = undefined;
        },
        changeCompileErrorForSegment: (
            state,
            {
                payload: { segmentId, newErrors },
            }: PayloadAction<{
                segmentId: number;
                newErrors: CompileErrorResult[];
            }>
        ) => {
            const oddErrors = state.compileErrorResult?.errors?.filter(
                (err) => err.payload.segmentId !== segmentId
            );
            state.compileErrorResult = {
                errors: [...(oddErrors || []), ...newErrors],
            };
            return state;
        },
        setActiveIndex: (state, { payload }: PayloadAction<number>) => {
            let newActiveIndex = payload;
            if (newActiveIndex < 0) {
                newActiveIndex = 0;
            }
            if (newActiveIndex > state.history.length - 1) {
                newActiveIndex = state.history.length - 1;
            }
            state.historyAcitveIndex = newActiveIndex;
        },
        clearProject: (state) => {
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

export const {
    setProject,
    setProjectName,
    setActiveIndex,
    setProgramRoundStrategy,
    deleteSegment,
    setNewProgram,
    addSegment,
    changeSegmentText,
    changeSegmentTextById,
    setCompileResult,
    setCompileError,
    clearProject,
    setSegmentVisibility,
    changeSegmentPosition,
    changeCompileErrorForSegment,
    setReadOnly,
    addSegmentAfter,
} = projectSlice.actions;
