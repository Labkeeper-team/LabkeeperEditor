/**
 * Collaborative editing port: one WebSocket per project, channel `projectCollab`
 * (`/api/v4/ws/project/{id}/collab`). The types below are written by hand and mirror
 * the asyncapi schemas `Collab*Spec` of the server contract; field names and enums
 * must stay identical to the contract.
 */

/** CollabSegmentTypeSpec: InputProgramSegmentSpec types except `empty` */
export type CollabSegmentType =
    | 'computational'
    | 'md'
    | 'latex'
    | 'asciimath'
    | 'mermaid'
    | 'plantuml'
    | 'drawio';

export const COLLAB_SEGMENT_TYPES: readonly CollabSegmentType[] = [
    'computational',
    'md',
    'latex',
    'asciimath',
    'mermaid',
    'plantuml',
    'drawio',
];

/** Reserved clientID of updates produced by the server itself (CollabUpdateSpec) */
export const COLLAB_SERVER_CLIENT_ID = 'server';

/** Protocol version this client understands (CollabWelcomeSpec.protocolVersion) */
export const COLLAB_PROTOCOL_VERSION = 1;

/** CollabChangeSetSpec: `ChangeSet.toJSON()` of @codemirror/state */
export type CollabChangeSetJson = unknown[];

/** CollabUpdateSpec */
export interface CollabUpdate {
    clientID: string;
    changes: CollabChangeSetJson;
}

/** CollabSelectionSpec */
export interface CollabSelection {
    anchor: number;
    head: number;
}

/** CollabSegmentRefSpec */
export interface CollabSegmentRef {
    segmentId: number;
    segmentType: CollabSegmentType;
    docId?: string;
}

/** CollabLimitsSpec */
export interface CollabLimits {
    maxMessageBytes: number;
    maxUpdatesPerPush: number;
    maxDocumentLength: number;
    maxChangeSetEntries: number;
    maxOpenDocuments: number;
    /** Distinct users connected to the project at once (see participantLimit) */
    maxParticipants: number;
}

/** CollabParticipantSpec */
export interface CollabParticipant {
    userId: number;
    displayName: string;
    color: string;
    connectionIds: string[];
}

export type CollabLockReason = 'agent' | 'externalWrite';
export type CollabParticipantsChangeKind = 'snapshot' | 'joined' | 'left';
export type CollabSegmentChangeKind = 'add' | 'delete' | 'move' | 'reset';

export type CollabPushRejectionCode =
    | 'versionConflict'
    | 'locked'
    | 'readOnly'
    | 'invalidChanges'
    | 'tooLarge'
    | 'unknownDocument';

export type CollabCommandRejectionCode =
    | 'structureConflict'
    | 'readOnly'
    | 'locked'
    | 'segmentNotFound'
    | 'invalidPosition'
    | 'quotaExceeded';

export type CollabReloadReason =
    'historyTrimmed' | 'unknownVersion' | 'documentReset' | 'unknownDocument';

export type CollabErrorCode =
    | 'forbidden'
    | 'participantLimit'
    | 'projectNotFound'
    | 'malformedMessage'
    | 'unknownMessageType'
    | 'segmentNotFound'
    | 'unknownDocument'
    | 'documentLimit'
    | 'internalError';

/** InputProgramSegmentSpec as carried by `segmentsChanged.segment` */
export interface CollabProgramSegment {
    id?: number;
    type: string;
    parameters?: Record<string, boolean>;
    text?: string;
}

/*
 * Client frames (asyncapi `receive` operations of projectCollab)
 */

export interface CollabOpenDocumentFrame {
    type: 'openDocument';
    requestId: string;
    segmentId: number;
}

export interface CollabResumeDocumentFrame {
    type: 'resumeDocument';
    requestId: string;
    docId: string;
    version: number;
}

export interface CollabCloseDocumentFrame {
    type: 'closeDocument';
    docId: string;
}

export interface CollabPushUpdatesFrame {
    type: 'pushUpdates';
    requestId: string;
    docId: string;
    version: number;
    updates: CollabUpdate[];
}

export interface CollabPullUpdatesFrame {
    type: 'pullUpdates';
    requestId: string;
    docId: string;
    version: number;
}

export interface CollabAddSegmentFrame {
    type: 'addSegment';
    requestId: string;
    structureVersion: number;
    position: number;
    segmentType: CollabSegmentType;
    text?: string;
}

export interface CollabDeleteSegmentFrame {
    type: 'deleteSegment';
    requestId: string;
    structureVersion: number;
    segmentId: number;
}

export interface CollabMoveSegmentFrame {
    type: 'moveSegment';
    requestId: string;
    structureVersion: number;
    segmentId: number;
    toSegmentId: number;
}

export interface CollabUpdatePresenceFrame {
    type: 'updatePresence';
    docId: string;
    version: number;
    selection?: CollabSelection;
}

export interface CollabPingFrame {
    type: 'ping';
    requestId: string;
}

export type CollabClientFrame =
    | CollabOpenDocumentFrame
    | CollabResumeDocumentFrame
    | CollabCloseDocumentFrame
    | CollabPushUpdatesFrame
    | CollabPullUpdatesFrame
    | CollabAddSegmentFrame
    | CollabDeleteSegmentFrame
    | CollabMoveSegmentFrame
    | CollabUpdatePresenceFrame
    | CollabPingFrame;

/*
 * Server frames (asyncapi `send` operations of projectCollab)
 */

export interface CollabWelcomeFrame {
    type: 'welcome';
    protocolVersion: number;
    connectionId: string;
    userId: number;
    displayName: string;
    color: string;
    canWrite: boolean;
    structureVersion: number;
    locked: boolean;
    lockReason?: CollabLockReason;
    segments: CollabSegmentRef[];
    limits: CollabLimits;
    presenceTimeoutSeconds: number;
}

export interface CollabDocumentOpenedFrame {
    type: 'documentOpened';
    requestId: string;
    docId: string;
    segmentId: number;
    version: number;
    text: string;
}

export interface CollabDocumentResumedFrame {
    type: 'documentResumed';
    requestId: string;
    docId: string;
    segmentId: number;
    fromVersion: number;
    version: number;
    updates: CollabUpdate[];
}

export interface CollabDocumentUpdatesFrame {
    type: 'documentUpdates';
    requestId?: string;
    docId: string;
    segmentId: number;
    fromVersion: number;
    updates: CollabUpdate[];
}

export interface CollabPushAcceptedFrame {
    type: 'pushAccepted';
    requestId: string;
    docId: string;
    version: number;
}

export interface CollabPushRejectedFrame {
    type: 'pushRejected';
    requestId: string;
    docId: string;
    code: CollabPushRejectionCode;
    serverVersion?: number;
    message?: string;
}

export interface CollabReloadRequiredFrame {
    type: 'reloadRequired';
    requestId?: string;
    docId: string;
    segmentId?: number;
    reason: CollabReloadReason;
}

export interface CollabSegmentsChangedFrame {
    type: 'segmentsChanged';
    structureVersion: number;
    kind: CollabSegmentChangeKind;
    requestId?: string;
    connectionId?: string;
    segmentId?: number;
    toSegmentId?: number;
    segment?: CollabProgramSegment;
    segments: CollabSegmentRef[];
}

export interface CollabCommandAcceptedFrame {
    type: 'commandAccepted';
    requestId: string;
    structureVersion: number;
}

export interface CollabCommandRejectedFrame {
    type: 'commandRejected';
    requestId: string;
    code: CollabCommandRejectionCode;
    structureVersion: number;
    message?: string;
}

export interface CollabProjectLockChangedFrame {
    type: 'projectLockChanged';
    locked: boolean;
    reason?: CollabLockReason;
}

export interface CollabPresenceChangedFrame {
    type: 'presenceChanged';
    docId: string;
    segmentId: number;
    connectionId: string;
    userId: number;
    displayName: string;
    color: string;
    version?: number;
    selection?: CollabSelection;
}

export interface CollabParticipantsChangedFrame {
    type: 'participantsChanged';
    kind: CollabParticipantsChangeKind;
    connectionId?: string;
    userId?: number;
    participants: CollabParticipant[];
}

export interface CollabErrorFrame {
    type: 'collabError';
    code: CollabErrorCode;
    requestId?: string;
    message?: string;
}

export interface CollabPongFrame {
    type: 'pong';
    requestId: string;
}

export type CollabServerFrame =
    | CollabWelcomeFrame
    | CollabDocumentOpenedFrame
    | CollabDocumentResumedFrame
    | CollabDocumentUpdatesFrame
    | CollabPushAcceptedFrame
    | CollabPushRejectedFrame
    | CollabReloadRequiredFrame
    | CollabSegmentsChangedFrame
    | CollabCommandAcceptedFrame
    | CollabCommandRejectedFrame
    | CollabProjectLockChangedFrame
    | CollabPresenceChangedFrame
    | CollabParticipantsChangedFrame
    | CollabErrorFrame
    | CollabPongFrame;

/**
 * Why the connection is gone. `denied` is close code 1008 (access denied or unknown
 * project): the adapter does not retry it. Every other close is retried by the adapter.
 */
export type CollabCloseReason = 'denied' | 'closed';

export interface CollabConnectionHandlers {
    /** The socket is open; the server sends `welcome` next */
    onOpen: () => void;
    /** A parsed server frame. Unknown or malformed frames never reach this */
    onFrame: (frame: CollabServerFrame) => void;
    /**
     * The socket is gone. With `willRetry` the adapter reconnects by itself (exponential
     * backoff); the caller keeps its document states and waits for the next `onOpen`.
     */
    onClose: (reason: CollabCloseReason, willRetry: boolean) => void;
}

export interface CollabConnection {
    /** false when the socket is not open (the frame is dropped) */
    send: (frame: CollabClientFrame) => boolean;
    isOpen: () => boolean;
    /** Close for good, no reconnect. Idempotent */
    close: () => void;
}

/**
 * Port of the collaboration channel. The implementation lives in web/server; the
 * viewModel knows nothing about WebSocket.
 */
export interface CollabSocket {
    connect(
        projectId: string,
        handlers: CollabConnectionHandlers
    ): CollabConnection;
}
