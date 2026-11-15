import { StorageState } from '../index.ts';

// the collab slice is read defensively: hand-made test states and old snapshots lack it

/** The collaboration session decides texts and the segment list */
export const selectCollabActive = (state: StorageState): boolean =>
    state.collab?.status === 'live' || state.collab?.status === 'reconnecting';

/**
 * Segment texts and the segment list can be changed: own project, or a project shared
 * for collaborative editing (welcome.canWrite). Parameters, files and the title stay
 * with the owner: they are saved over REST.
 */
export const selectCanEditSegments = (state: StorageState): boolean =>
    !state.project.projectIsReadonly ||
    (selectCollabActive(state) && Boolean(state.collab?.canWrite));

/**
 * Project files can be changed: own project (REST, or the session when it is live), or a
 * shared project while the session is live with a file list (file commands, collab uploads
 * and text file documents). Without a collaboration server nothing changes for the owner.
 */
export const selectCanEditFiles = (state: StorageState): boolean =>
    !state.project.projectIsReadonly ||
    (state.collab?.status === 'live' &&
        Boolean(state.collab?.canWrite) &&
        Boolean(state.collab?.filesReady));

/**
 * The open text file can be edited: own project, or a participant of a shared project
 * while the file is bound to its collaborative document (other texts would not be saved)
 */
export const selectCanEditTextFile =
    (path: string | null) =>
    (state: StorageState): boolean =>
        !state.project.projectIsReadonly ||
        (selectCanEditFiles(state) &&
            path !== null &&
            state.collab?.textFileDocPath === path);

/** Revision of a file replaced by an upload in this session (0 when never replaced) */
export const selectCollabFileRevision =
    (path: string | null) =>
    (state: StorageState): number =>
        path ? (state.collab?.fileRevisions?.[path] ?? 0) : 0;

/**
 * The editor of this segment waits for the session: the first connection is being
 * made, the collaborative document is not open yet, or the agent holds the project.
 */
export const selectCollabSegmentBlocked =
    (index: number) =>
    (state: StorageState): boolean => {
        const collab = state.collab;
        if (collab?.status === 'connecting') {
            return true;
        }
        if (!selectCollabActive(state)) {
            return false;
        }
        return collab.locked || !collab.readySegments[index];
    };

/** Stable keys by segment index while the session runs, else null */
export const selectCollabSegmentKeys = (
    state: StorageState
): string[] | null => {
    const collab = state.collab;
    if (!collab || collab.status === 'off' || collab.status === 'denied') {
        return null;
    }
    return collab.segmentKeys.length ===
        state.project.currentProgram?.segments.length
        ? collab.segmentKeys
        : null;
};
