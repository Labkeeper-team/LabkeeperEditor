import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CollabParticipant } from '../../../../model/rpi/collabSocket.ts';
import {
    collabInitialState,
    CollabStatus,
    CollabViewModelRepository,
} from '../../../../viewModel/domain/collab/collabRepository.ts';

/** Collaborative editing session: not persisted, reset when the session stops */
export const collabSlice = createSlice({
    name: 'collabSlice',
    initialState: collabInitialState,
    reducers: {
        setCollabStatus: (state, { payload }: PayloadAction<CollabStatus>) => {
            state.status = payload;
        },
        setCollabWelcome: (
            state,
            {
                payload,
            }: PayloadAction<{
                selfUserId: number;
                selfConnectionId: string;
                canWrite: boolean;
                locked: boolean;
            }>
        ) => {
            state.selfUserId = payload.selfUserId;
            state.selfConnectionId = payload.selfConnectionId;
            state.canWrite = payload.canWrite;
            state.locked = payload.locked;
        },
        setCollabLocked: (state, { payload }: PayloadAction<boolean>) => {
            state.locked = payload;
        },
        setCollabParticipants: (
            state,
            { payload }: PayloadAction<CollabParticipant[]>
        ) => {
            // the server sends the full list every time: replace, never merge
            state.participants = payload;
        },
        setCollabReadySegments: (
            state,
            { payload }: PayloadAction<boolean[]>
        ) => {
            if (
                state.readySegments.length !== payload.length ||
                state.readySegments.some(
                    (ready, index) => ready !== payload[index]
                )
            ) {
                state.readySegments = payload;
            }
        },
        setCollabSegmentKeys: (state, { payload }: PayloadAction<string[]>) => {
            // same keys keep the same array: the segment list does not re-render on every text change
            if (
                state.segmentKeys.length !== payload.length ||
                state.segmentKeys.some((key, index) => key !== payload[index])
            ) {
                state.segmentKeys = payload;
            }
        },
        setCollabMaxParticipants: (
            state,
            { payload }: PayloadAction<number | null>
        ) => {
            state.maxParticipants = payload;
        },
        setCollabParticipantLimit: (
            state,
            { payload }: PayloadAction<number | null>
        ) => {
            state.participantLimit = payload;
        },
        resetCollab: () => collabInitialState,
    },
});

export const {
    setCollabStatus,
    setCollabWelcome,
    setCollabLocked,
    setCollabParticipants,
    setCollabReadySegments,
    setCollabSegmentKeys,
    setCollabMaxParticipants,
    setCollabParticipantLimit,
    resetCollab,
} = collabSlice.actions;

type DispatchingStore = {
    dispatch: (action: unknown) => unknown;
    getState: () => unknown;
};

export function createCollabRepositoryFromStore(
    store: DispatchingStore
): CollabViewModelRepository {
    return {
        state: () =>
            (store.getState() as { collab: typeof collabInitialState }).collab,
        setStatus: (status) => store.dispatch(setCollabStatus(status)),
        setWelcome: (welcome) => store.dispatch(setCollabWelcome(welcome)),
        setLocked: (locked) => store.dispatch(setCollabLocked(locked)),
        setParticipants: (participants) =>
            store.dispatch(setCollabParticipants(participants)),
        setReadySegments: (ready) =>
            store.dispatch(setCollabReadySegments(ready)),
        setSegmentKeys: (keys) => store.dispatch(setCollabSegmentKeys(keys)),
        setMaxParticipants: (max) =>
            store.dispatch(setCollabMaxParticipants(max)),
        setParticipantLimit: (limit) =>
            store.dispatch(setCollabParticipantLimit(limit)),
        reset: () => store.dispatch(resetCollab()),
    };
}
