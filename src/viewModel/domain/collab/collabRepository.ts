import { CollabParticipant } from '../../../model/rpi/collabSocket.ts';

/**
 * Session status as the UI sees it.
 * `off` - collaboration is disabled or not started for this project;
 * `connecting` - first connection, no `welcome` yet;
 * `live` - welcomed, documents are synchronized;
 * `reconnecting` - the socket dropped after it was live; edits are kept and pushed later;
 * `failed` - the first connection failed; the editor works as without collaboration
 *   while the adapter keeps retrying;
 * `denied` - closed with 1008 (private project of another user, unknown project).
 */
export type CollabStatus =
    'off' | 'connecting' | 'live' | 'reconnecting' | 'failed' | 'denied';

export interface CollabViewState {
    status: CollabStatus;
    canWrite: boolean;
    locked: boolean;
    selfUserId: number | null;
    selfConnectionId: string | null;
    participants: CollabParticipant[];
    /** By segment index: the collaborative document of the segment is open */
    readySegments: boolean[];
    /** By segment index: stable key of the segment (React key and view binding) */
    segmentKeys: string[];
    /** welcome.limits.maxParticipants, when known */
    maxParticipants: number | null;
    /**
     * Shown to the user: the project already has the maximum number of people
     * (collabError participantLimit before close 1008). The editor works without collaboration.
     */
    participantLimit: number | null;
}

export const collabInitialState: CollabViewState = {
    status: 'off',
    canWrite: false,
    locked: false,
    selfUserId: null,
    selfConnectionId: null,
    participants: [],
    readySegments: [],
    segmentKeys: [],
    maxParticipants: null,
    participantLimit: null,
};

/** Redux side of the collaboration session (participants, status, lock) */
export interface CollabViewModelRepository {
    state: () => CollabViewState;
    setStatus: (status: CollabStatus) => void;
    setWelcome: (welcome: {
        selfUserId: number;
        selfConnectionId: string;
        canWrite: boolean;
        locked: boolean;
    }) => void;
    setLocked: (locked: boolean) => void;
    setParticipants: (participants: CollabParticipant[]) => void;
    setReadySegments: (ready: boolean[]) => void;
    setSegmentKeys: (keys: string[]) => void;
    setMaxParticipants: (max: number | null) => void;
    setParticipantLimit: (limit: number | null) => void;
    reset: () => void;
}

export function inMemoryCollabRepository(): CollabViewModelRepository & {
    current: CollabViewState;
} {
    const repo = {
        current: structuredClone(collabInitialState),
        state: () => repo.current,
        setStatus: (status: CollabViewState['status']) => {
            repo.current = { ...repo.current, status };
        },
        setWelcome: (welcome: {
            selfUserId: number;
            selfConnectionId: string;
            canWrite: boolean;
            locked: boolean;
        }) => {
            repo.current = { ...repo.current, ...welcome };
        },
        setLocked: (locked: boolean) => {
            repo.current = { ...repo.current, locked };
        },
        setParticipants: (participants: CollabParticipant[]) => {
            repo.current = { ...repo.current, participants };
        },
        setReadySegments: (readySegments: boolean[]) => {
            repo.current = { ...repo.current, readySegments };
        },
        setSegmentKeys: (segmentKeys: string[]) => {
            repo.current = { ...repo.current, segmentKeys };
        },
        setMaxParticipants: (maxParticipants: number | null) => {
            repo.current = { ...repo.current, maxParticipants };
        },
        setParticipantLimit: (participantLimit: number | null) => {
            repo.current = { ...repo.current, participantLimit };
        },
        reset: () => {
            repo.current = structuredClone(collabInitialState);
        },
    };
    return repo;
}
