import { ChangeSet, Text } from '@codemirror/state';
import {
    CollabClientFrame,
    CollabCloseReason,
    CollabCommandRejectedFrame,
    CollabConnection,
    CollabDocumentOpenedFrame,
    CollabErrorFrame,
    CollabLimits,
    CollabParticipant,
    CollabParticipantsChangedFrame,
    CollabPresenceChangedFrame,
    CollabReloadRequiredFrame,
    CollabSegmentRef,
    CollabSegmentsChangedFrame,
    CollabSegmentType,
    CollabSelection,
    CollabServerFrame,
    CollabSocket,
    CollabWelcomeFrame,
    COLLAB_PROTOCOL_VERSION,
    COLLAB_SEGMENT_TYPES,
} from '../../../model/rpi/collabSocket.ts';
import { Rpi } from '../../../model/rpi';
import { Segment, SegmentType } from '../../../model/domain.ts';
import { ProgramService } from '../../../model/service/ProgramService.ts';
import { ViewModelRepository } from '../../repository';
import { IdeCollabHooks, IdeService } from '../IdeService.ts';
import { CollabSaveDecision, LoaderService } from '../LoaderService.ts';
import { logBreadcrumb } from '../../utils/logBreadcrumb.ts';
import {
    CollabDocChange,
    CollabDocProblem,
    CollabDocTransport,
    CollabDocumentClient,
    RemoteCursor,
    toCollabText,
} from './CollabDocumentClient.ts';
import { CollabStatus, CollabViewModelRepository } from './collabRepository.ts';

/** Throttle of `updatePresence` (asyncapi CollabUpdatePresenceSpec): trailing edge */
export const COLLAB_PRESENCE_THROTTLE_MS = 100;
/** Fallback before `welcome.limits` arrives */
const DEFAULT_MAX_UPDATES_PER_PUSH = 100;
const DEFAULT_MAX_OPEN_DOCUMENTS = 200;
/** After a program with another segment count, wait this long for `segmentsChanged` */
const STRUCTURE_MISMATCH_RESET_MS = 3000;
/** Retries of a REST reload whose segment count does not match the session yet */
const RESET_RELOAD_ATTEMPTS = 3;
const RESET_RELOAD_DELAY_MS = 1000;
/** Without welcome for this long the first connection counts as failed */
const FIRST_WELCOME_TIMEOUT_MS = 8000;
/** Attempts of a segment command rejected with structureConflict */
const COMMAND_CONFLICT_RETRIES = 2;

/**
 * A mounted segment editor bound to the session. Bound by the stable segment key, not
 * by index: a segment keeps its key when other segments are added, deleted or moved.
 */
export interface CollabViewSink {
    key: () => string;
    /** Remote change of the document; `change.before` is the text it applies to */
    applyRemote: (change: CollabDocChange, cursors: RemoteCursor[]) => void;
    /** Remote carets; ignored by the view unless it shows exactly `doc` */
    setCursors: (cursors: RemoteCursor[], doc: Text) => void;
    /** Main selection when the editor has focus, else null */
    selection: () => CollabSelection | null;
}

/** Result of forwarding a local view transaction */
export type CollabForwardResult = 'applied' | 'stale' | 'none';

interface Slot {
    /** Stable key of the segment for React and view bindings */
    key: string;
    docId?: string;
    /** requestId of an `openDocument` in flight */
    opening?: string;
}

type PendingCommand =
    | {
          kind: 'add';
          /** Key of the segment the new one goes after; null means at the start */
          afterKey: string | null;
          /** Append after the last segment, whatever it is at send time */
          append: boolean;
          segmentType: CollabSegmentType;
          text?: string;
          retries: number;
          scrollToBottom: boolean;
      }
    | { kind: 'delete'; key: string; retries: number }
    | {
          kind: 'move';
          key: string;
          direction: 'up' | 'down';
          retries: number;
      };

export interface CollabServiceDeps {
    socket: CollabSocket;
    repository: ViewModelRepository;
    collabRepository: CollabViewModelRepository;
    programService: ProgramService;
    ideService: IdeService;
    loaderService: LoaderService;
    rpi: Rpi;
}

function isCollabSegmentType(type: string): type is CollabSegmentType {
    return (COLLAB_SEGMENT_TYPES as readonly string[]).includes(type);
}

/** Default of the server setting io.labkeeper.collab.max-participants */
export const COLLAB_DEFAULT_MAX_PARTICIPANTS = 5;

/** The limit named in the participantLimit message, else the server default */
export function participantLimitOf(message: string | undefined): number {
    const match = message?.match(/[0-9]+/);
    const limit = match ? Number(match[0]) : NaN;
    return Number.isInteger(limit) && limit > 0
        ? limit
        : COLLAB_DEFAULT_MAX_PARTICIPANTS;
}

const isNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
const isString = (value: unknown): value is string => typeof value === 'string';

/**
 * Collaborative editing session of the open project: one connection, one headless
 * document client per segment, the segment list as the server decides it, presence.
 *
 * Remote text is written to ProgramService and Redux before it reaches the editor
 * view, so the controlled `value` of the segment editor already matches the view when
 * React renders and the stale-value guard has nothing to restore. Local edits reach the
 * documents in two ways: precise changes from the editor view (collab view binding) and,
 * for everything else that changes texts (paste of files, undo, replace in all segments),
 * a minimal diff when the program is published.
 */
export class CollabService {
    private projectId: string | null = null;
    private connection: CollabConnection | null = null;
    private welcomed = false;
    private everLive = false;
    private denied = false;
    private connectionId: string | null = null;
    private canWrite = false;
    private locked = false;
    private limits: CollabLimits | null = null;
    private structureVersion = 0;
    private serverSegments: CollabSegmentRef[] = [];
    private slots: Slot[] = [];
    private docs = new Map<string, CollabDocumentClient>();
    private docUnsubscribers = new Map<string, () => void>();
    private commands = new Map<string, PendingCommand>();
    private outbox: PendingCommand[] = [];
    private sinks = new Set<CollabViewSink>();
    private requestCounter = 0;
    private keyCounter = 0;
    private sessionToken = 0;
    private resetting = false;
    private structureMismatch = false;
    private mismatchTimer: ReturnType<typeof setTimeout> | undefined;
    /** Set by the view binding right before the editor's onChange of the same update */
    private pendingViewEdit: {
        key: string;
        index: number;
        result: CollabForwardResult;
    } | null = null;
    private presencePending: {
        docId: string;
        selection: CollabSelection | null;
    } | null = null;
    private presenceTimer: ReturnType<typeof setTimeout> | undefined;
    private presenceSentAt = 0;
    private lastPresenceDocId: string | null = null;
    private cursorFlushQueued = new Set<string>();
    private welcomeTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private deps: CollabServiceDeps) {
        deps.ideService.setCollabHooks(this.programHooks);
        deps.loaderService.setCollabSaveGate(this.saveGate);
    }

    /*
     * Session lifecycle
     */

    /** Opens the session of the project. Idempotent */
    start = (projectId: string): void => {
        if (this.projectId === projectId && this.connection) {
            return;
        }
        this.stop();
        if (!this.deps.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }
        this.projectId = projectId;
        this.sessionToken += 1;
        this.rebuildSlots();
        this.setStatus('connecting');
        this.log('session start', { projectId });
        const token = this.sessionToken;
        // the editor waits for the documents only so long; then it works without collaboration
        this.welcomeTimer = setTimeout(() => {
            if (token === this.sessionToken && !this.everLive && !this.denied) {
                this.log('no welcome in time', undefined, 'warning');
                this.setStatus('failed');
            }
        }, FIRST_WELCOME_TIMEOUT_MS);
        this.connection = this.deps.socket.connect(projectId, {
            onOpen: () => {
                if (token === this.sessionToken) {
                    this.log('socket open');
                }
            },
            onFrame: (frame) => {
                if (token === this.sessionToken) {
                    this.onFrame(frame);
                }
            },
            onClose: (reason, willRetry) => {
                if (token === this.sessionToken) {
                    this.onClose(reason, willRetry);
                }
            },
        });
    };

    /** Closes the session; editor texts stay as they are */
    stop = (projectId?: string): void => {
        if (projectId !== undefined && projectId !== this.projectId) {
            return;
        }
        if (!this.projectId && !this.connection) {
            return;
        }
        this.log('session stop', { projectId: this.projectId });
        this.sessionToken += 1;
        this.connection?.close();
        this.connection = null;
        for (const docId of [...this.docs.keys()]) {
            this.disposeDoc(docId);
        }
        this.projectId = null;
        this.welcomed = false;
        this.everLive = false;
        this.denied = false;
        this.connectionId = null;
        this.canWrite = false;
        this.locked = false;
        this.limits = null;
        this.serverSegments = [];
        this.slots = [];
        this.commands.clear();
        this.outbox = [];
        this.resetting = false;
        this.structureMismatch = false;
        clearTimeout(this.mismatchTimer);
        clearTimeout(this.presenceTimer);
        clearTimeout(this.welcomeTimer);
        this.presenceTimer = undefined;
        this.presencePending = null;
        this.lastPresenceDocId = null;
        this.pendingViewEdit = null;
        this.deps.collabRepository.reset();
    };

    /** Collaboration decides texts and the segment list (it has been live in this session) */
    isActive = (): boolean =>
        this.projectId !== null && this.everLive && !this.denied;

    isLive = (): boolean => this.isActive() && this.welcomed;

    /** The user may change texts and the segment list through the session */
    canEdit = (): boolean => this.isActive() && this.canWrite;

    /*
     * Hooks for IdeService and LoaderService
     */

    readonly programHooks: IdeCollabHooks = {
        reconcileLocalProgram: () => this.reconcileLocalProgram(),
        adoptCollabTexts: () => this.adoptCollabTexts(),
    };

    saveGate = (): CollabSaveDecision | null => {
        if (!this.isActive() || !this.isCurrentProject()) {
            return null;
        }
        if (!this.welcomed || this.resetting || this.structureMismatch) {
            // texts are pushed after the reconnect; a save now could store them twice
            return { skip: true };
        }
        const ide = this.deps.repository.ideViewModelRepository;
        if (ide.programChangeRevision() === ide.savedProgramRevision()) {
            // remote edits are stored by the collaboration server itself
            return { skip: true };
        }
        return { skip: false, structureVersion: this.structureVersion };
    };

    /*
     * View binding API
     */

    attachView = (sink: CollabViewSink): (() => void) => {
        this.sinks.add(sink);
        this.queueCursorFlush(sink.key());
        return () => {
            this.sinks.delete(sink);
        };
    };

    /** Stable key of the segment at index, while the session is active */
    keyAt = (index: number): string | undefined => this.slots[index]?.key;

    /**
     * A transaction of the editor view changed the text. Called from a view plugin,
     * before the editor's onChange of the same update reaches ProgramEditorService.
     */
    forwardViewChanges = (
        key: string,
        index: number,
        changes: ChangeSet,
        startDoc: Text
    ): CollabForwardResult => {
        const client = this.clientForKey(key);
        let result: CollabForwardResult = 'none';
        if (client && this.canEdit()) {
            result = client.applyLocalChanges(changes, startDoc)
                ? 'applied'
                : 'stale';
            if (result === 'stale') {
                this.log(
                    'view edit against another text dropped',
                    { docId: client.docId },
                    'warning'
                );
            }
        } else if (this.isActive() && this.slotIndex(key) < 0) {
            result = 'stale';
        }
        const viewEdit = { key, index, result };
        this.pendingViewEdit = viewEdit;
        // the onChange of the same update comes synchronously; never let it linger longer
        queueMicrotask(() => {
            if (this.pendingViewEdit === viewEdit) {
                this.pendingViewEdit = null;
            }
        });
        return result;
    };

    /**
     * ProgramEditorService asks before it stores a local text. false: drop the edit
     * (it was made in a view that shows another segment, or the segment is not editable).
     */
    acceptLocalText = (index: number, text: string): boolean => {
        if (!this.isActive()) {
            return true;
        }
        const viewEdit = this.pendingViewEdit;
        this.pendingViewEdit = null;
        if (viewEdit && viewEdit.index === index) {
            if (viewEdit.result === 'stale') {
                return false;
            }
            if (this.slotIndex(viewEdit.key) !== index) {
                return false;
            }
        }
        const slot = this.slots[index];
        const client = slot?.docId ? this.docs.get(slot.docId) : undefined;
        if (!client) {
            // without an open document a collaborative edit would reach nobody
            return !this.canEdit();
        }
        if (!this.canEdit()) {
            return false;
        }
        client.setLocalText(text);
        return true;
    };

    /** Selection of the focused editor (null on blur); sent throttled */
    reportSelection = (
        key: string,
        selection: CollabSelection | null
    ): void => {
        const docId = this.slotByKey(key)?.docId;
        if (!docId || !this.isActive()) {
            return;
        }
        if (!selection && this.lastPresenceDocId !== docId) {
            if (this.presencePending?.docId !== docId) {
                return;
            }
        }
        this.presencePending = { docId, selection };
        this.schedulePresence();
    };

    cursorsForKey = (key: string): RemoteCursor[] =>
        this.clientForKey(key)?.remoteCursors() ?? [];

    docForKey = (key: string): Text | null =>
        this.clientForKey(key)?.doc ?? null;

    /*
     * Segment list commands
     */

    /** position: 0-based index the new segment gets */
    addSegment = (
        index: number,
        segmentType: SegmentType,
        options: { text?: string; scrollToBottom?: boolean } = {}
    ): boolean => {
        if (!this.isActive()) {
            return false;
        }
        if (!this.canWrite) {
            return true;
        }
        if (!isCollabSegmentType(segmentType)) {
            this.log('segment type not supported', { segmentType }, 'warning');
            return true;
        }
        const append = index >= this.slots.length;
        this.issueCommand({
            kind: 'add',
            afterKey: index > 0 ? (this.slots[index - 1]?.key ?? null) : null,
            append,
            segmentType,
            text: options.text,
            retries: 0,
            scrollToBottom: options.scrollToBottom ?? false,
        });
        return true;
    };

    deleteSegment = (index: number): boolean => {
        if (!this.isActive()) {
            return false;
        }
        const key = this.slots[index]?.key;
        if (key && this.canWrite) {
            this.issueCommand({ kind: 'delete', key, retries: 0 });
        }
        return true;
    };

    moveSegment = (index: number, direction: 'up' | 'down'): boolean => {
        if (!this.isActive()) {
            return false;
        }
        const key = this.slots[index]?.key;
        if (key && this.canWrite) {
            this.issueCommand({ kind: 'move', key, direction, retries: 0 });
        }
        return true;
    };

    /*
     * Frames
     */

    private onFrame = (frame: CollabServerFrame): void => {
        try {
            this.handleFrame(frame);
        } catch (error) {
            this.log(
                'frame handling failed',
                { type: frame.type, error: String(error) },
                'error'
            );
        }
    };

    private handleFrame(frame: CollabServerFrame): void {
        switch (frame.type) {
            case 'welcome':
                this.onWelcome(frame);
                return;
            case 'documentOpened':
                this.onDocumentOpened(frame);
                return;
            case 'documentResumed':
                this.docs
                    .get(frame.docId)
                    ?.receiveResumed(
                        frame.requestId,
                        frame.fromVersion,
                        Array.isArray(frame.updates) ? frame.updates : []
                    );
                return;
            case 'documentUpdates':
                if (
                    !Array.isArray(frame.updates) ||
                    !isNumber(frame.fromVersion)
                ) {
                    return;
                }
                this.docs
                    .get(frame.docId)
                    ?.receiveDocumentUpdates(
                        frame.fromVersion,
                        frame.updates,
                        frame.requestId
                    );
                return;
            case 'pushAccepted':
                this.docs
                    .get(frame.docId)
                    ?.onPushAccepted(frame.requestId, Number(frame.version));
                return;
            case 'pushRejected':
                this.docs.get(frame.docId)?.onPushRejected(frame);
                return;
            case 'reloadRequired':
                this.onReloadRequired(frame);
                return;
            case 'segmentsChanged':
                this.onSegmentsChanged(frame);
                return;
            case 'commandAccepted':
                this.commands.delete(frame.requestId);
                if (isNumber(frame.structureVersion)) {
                    this.structureVersion = frame.structureVersion;
                }
                return;
            case 'commandRejected':
                this.onCommandRejected(frame);
                return;
            case 'projectLockChanged':
                this.setLocked(Boolean(frame.locked));
                return;
            case 'presenceChanged':
                this.onPresenceChanged(frame);
                return;
            case 'participantsChanged':
                this.onParticipantsChanged(frame);
                return;
            case 'collabError':
                this.onCollabError(frame);
                return;
            case 'pong':
                return;
        }
    }

    private onWelcome(frame: CollabWelcomeFrame): void {
        if (!isString(frame.connectionId) || !Array.isArray(frame.segments)) {
            this.log('malformed welcome', undefined, 'error');
            return;
        }
        const knownProtocol = frame.protocolVersion === COLLAB_PROTOCOL_VERSION;
        if (!knownProtocol) {
            this.log(
                'unknown protocol version, read-only',
                { protocolVersion: frame.protocolVersion },
                'warning'
            );
        }
        const reconnect = this.everLive;
        clearTimeout(this.welcomeTimer);
        this.welcomed = true;
        this.everLive = true;
        this.connectionId = frame.connectionId;
        this.canWrite = Boolean(frame.canWrite) && knownProtocol;
        this.limits = frame.limits ?? null;
        this.deps.collabRepository.setMaxParticipants(
            isNumber(this.limits?.maxParticipants)
                ? this.limits.maxParticipants
                : null
        );
        this.deps.collabRepository.setParticipantLimit(null);
        this.structureVersion = Number(frame.structureVersion) || 0;
        this.serverSegments = frame.segments;
        this.locked = Boolean(frame.locked);
        this.deps.collabRepository.setWelcome({
            selfUserId: Number(frame.userId),
            selfConnectionId: frame.connectionId,
            canWrite: this.canWrite,
            locked: this.locked,
        });
        this.setStatus('live');
        this.log('welcome', {
            reconnect,
            structureVersion: this.structureVersion,
            segments: frame.segments.length,
            canWrite: this.canWrite,
        });

        const program = this.deps.programService.getCurrentProgram();
        if (
            program.segments.length !== frame.segments.length ||
            this.slots.length !== frame.segments.length ||
            this.docIdsConflict(frame.segments)
        ) {
            void this.resetAll('segment list differs from the server');
            return;
        }
        for (const client of this.docs.values()) {
            client.setLocked(this.locked);
            client.resume();
        }
        this.ensureDocsOpen();
        this.publishSlots();
        if (reconnect) {
            this.sendOutbox();
            this.refreshPresence();
            // a save skipped while offline goes now
            void this.deps.loaderService.segmentEditorSaveProgram();
        }
    }

    private onClose(reason: CollabCloseReason, willRetry: boolean): void {
        this.welcomed = false;
        this.log('socket closed', { reason, willRetry });
        for (const client of this.docs.values()) {
            client.onDisconnected();
        }
        if (reason === 'denied') {
            this.denied = true;
            for (const docId of [...this.docs.keys()]) {
                this.disposeDoc(docId);
            }
            this.setStatus('denied');
            this.deps.collabRepository.setParticipants([]);
        } else {
            // the adapter retries; a first connection that failed leaves the editor as it is without collaboration
            this.setStatus(this.everLive ? 'reconnecting' : 'failed');
        }
        // the next welcome brings a fresh snapshot
        this.deps.collabRepository.setParticipants([]);
        this.publishSlots();
    }

    private onDocumentOpened(frame: CollabDocumentOpenedFrame): void {
        if (
            !isString(frame.docId) ||
            !isNumber(frame.segmentId) ||
            !isNumber(frame.version) ||
            !isString(frame.text)
        ) {
            this.log('malformed documentOpened', undefined, 'error');
            return;
        }
        for (const slot of this.slots) {
            if (slot.opening === frame.requestId) {
                slot.opening = undefined;
            }
        }
        const index = frame.segmentId - 1;
        const slot = this.slots[index];
        if (!slot) {
            this.log(
                'document of an unknown segment',
                { segmentId: frame.segmentId },
                'warning'
            );
            return;
        }
        // a fresh state replaces any previous state of this document or this segment
        this.disposeDoc(frame.docId);
        if (slot.docId && slot.docId !== frame.docId) {
            this.disposeDoc(slot.docId);
        }
        const client = new CollabDocumentClient(
            {
                docId: frame.docId,
                segmentId: frame.segmentId,
                version: frame.version,
                text: frame.text,
            },
            this.transport,
            (problem) => this.onDocProblem(frame.docId, problem)
        );
        client.setLocked(this.locked);
        slot.docId = frame.docId;
        this.docs.set(frame.docId, client);
        const unsubscribe = [
            client.onChange((change) => this.onDocChange(client, change)),
            client.onCursorsChanged(() => this.queueCursorFlush(slot.key)),
            client.onDrained(() => this.refreshPresence(client.docId)),
        ];
        this.docUnsubscribers.set(frame.docId, () =>
            unsubscribe.forEach((fn) => fn())
        );
        const programText =
            this.deps.programService.getCurrentProgram().segments[index]?.text;
        if (
            programText === undefined ||
            toCollabText(programText).toString() !== client.text
        ) {
            const before = toCollabText(programText ?? '');
            this.writeSegmentText(index, client.text, {
                changes: ChangeSet.of(
                    { from: 0, to: before.length, insert: client.doc },
                    before.length
                ),
                before,
                after: client.doc,
                remote: true,
            });
        }
        this.publishSlots();
        this.queueCursorFlush(slot.key);
    }

    private onReloadRequired(frame: CollabReloadRequiredFrame): void {
        const client = this.docs.get(frame.docId);
        if (!client) {
            return;
        }
        this.reopenDocument(client, `reloadRequired: ${frame.reason}`);
    }

    private onDocProblem(docId: string, problem: CollabDocProblem): void {
        const client = this.docs.get(docId);
        if (!client) {
            return;
        }
        if (problem.kind === 'readOnly') {
            this.canWrite = false;
            this.deps.collabRepository.setWelcome({
                selfUserId: this.deps.collabRepository.state().selfUserId ?? 0,
                selfConnectionId: this.connectionId ?? '',
                canWrite: false,
                locked: this.locked,
            });
            return;
        }
        this.reopenDocument(
            client,
            problem.kind === 'reload' ? problem.reason : 'unknownDocument'
        );
    }

    /** Drops the state of the document and opens it again from the server text */
    private reopenDocument(client: CollabDocumentClient, reason: string): void {
        const lost = client.unconfirmedCount;
        this.log(
            'document reload',
            { docId: client.docId, reason, lostUnconfirmedUpdates: lost },
            lost ? 'warning' : 'info'
        );
        const index = this.slots.findIndex(
            (slot) => slot.docId === client.docId
        );
        this.disposeDoc(client.docId);
        if (index >= 0) {
            this.slots[index].docId = undefined;
        }
        this.ensureDocsOpen();
        this.publishSlots();
    }

    private onSegmentsChanged(frame: CollabSegmentsChangedFrame): void {
        if (
            !Array.isArray(frame.segments) ||
            !isNumber(frame.structureVersion)
        ) {
            this.log('malformed segmentsChanged', undefined, 'error');
            return;
        }
        this.structureVersion = frame.structureVersion;
        if (
            frame.kind === 'reset' ||
            this.structureMismatch ||
            this.resetting
        ) {
            void this.resetAll(`segmentsChanged ${frame.kind}`, frame.segments);
            return;
        }
        const activeIndex =
            this.deps.repository.ideViewModelRepository.activeSegmentIndex();
        const activeKey =
            activeIndex >= 0 ? this.slots[activeIndex]?.key : null;
        const segmentId = Number(frame.segmentId);
        const ok = this.applySegmentListChange(frame, segmentId);
        if (!ok) {
            void this.resetAll(
                'segment list change does not apply',
                frame.segments
            );
            return;
        }
        this.serverSegments = frame.segments;
        // positions from the server win: docIds are stable, ids are renumbered
        for (const ref of frame.segments) {
            if (!ref.docId) {
                continue;
            }
            const client = this.docs.get(ref.docId);
            if (client) {
                client.segmentId = ref.segmentId;
            }
        }
        this.slots.forEach((slot, index) => {
            const client = slot.docId ? this.docs.get(slot.docId) : undefined;
            if (client) {
                client.segmentId = index + 1;
            }
        });
        this.pendingViewEdit = null;
        this.deps.ideService.onProgramUpdated();
        this.publishSlots();

        const ide = this.deps.repository.ideViewModelRepository;
        const command = frame.requestId
            ? this.commands.get(frame.requestId)
            : undefined;
        if (command?.kind === 'add' && frame.kind === 'add') {
            const newIndex = segmentId - 1;
            this.deps.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
                newIndex
            );
            ide.setEditorNavigationTarget({ segmentIndex: newIndex, line: 1 });
            if (command.scrollToBottom) {
                this.deps.repository.scrollEditorToBottom();
            }
        } else if (activeKey !== null && activeKey !== undefined) {
            // the focused segment keeps the focus where it went
            const nextActive = this.slotIndex(activeKey);
            if (nextActive !== activeIndex) {
                ide.setActiveSegmentIndex(nextActive);
            }
        }
        this.ensureDocsOpen();
        for (const slot of this.slots) {
            this.queueCursorFlush(slot.key);
        }
    }

    /** Applies add/delete/move to the program and the slots in the same way */
    private applySegmentListChange(
        frame: CollabSegmentsChangedFrame,
        segmentId: number
    ): boolean {
        const program = this.deps.programService.getCurrentProgram();
        const count = program.segments.length;
        if (this.slots.length !== count || !isNumber(segmentId)) {
            return false;
        }
        const from = segmentId - 1;
        switch (frame.kind) {
            case 'add': {
                if (from < 0 || from > count) {
                    return false;
                }
                const ref = frame.segments[from];
                const segment = this.toProgramSegment(frame, ref);
                this.deps.programService.applyExternalSegmentsChange(
                    (segments) => segments.splice(from, 0, segment)
                );
                this.slots.splice(from, 0, { key: this.newKey() });
                break;
            }
            case 'delete': {
                if (from < 0 || from >= count) {
                    return false;
                }
                const removed = this.slots[from];
                if (removed.docId) {
                    this.disposeDoc(removed.docId);
                }
                this.deps.programService.applyExternalSegmentsChange(
                    (segments) => segments.splice(from, 1)
                );
                this.slots.splice(from, 1);
                break;
            }
            case 'move': {
                const to = Number(frame.toSegmentId) - 1;
                if (from < 0 || from >= count || to < 0 || to >= count) {
                    return false;
                }
                this.deps.programService.applyExternalSegmentsChange(
                    (segments) => {
                        const [moved] = segments.splice(from, 1);
                        segments.splice(to, 0, moved);
                    }
                );
                const [slot] = this.slots.splice(from, 1);
                this.slots.splice(to, 0, slot);
                break;
            }
            default:
                return false;
        }
        return (
            this.deps.programService.getCurrentProgram().segments.length ===
            frame.segments.length
        );
    }

    private toProgramSegment(
        frame: CollabSegmentsChangedFrame,
        ref: CollabSegmentRef | undefined
    ): Segment {
        const type = (frame.segment?.type ??
            ref?.segmentType ??
            'md') as SegmentType;
        return {
            type,
            parameters: frame.segment?.parameters ?? { visible: true },
            text: toCollabText(frame.segment?.text ?? '').toString(),
        };
    }

    private onCommandRejected(frame: CollabCommandRejectedFrame): void {
        const command = this.commands.get(frame.requestId);
        this.commands.delete(frame.requestId);
        if (isNumber(frame.structureVersion)) {
            this.structureVersion = frame.structureVersion;
        }
        this.log(
            'command rejected',
            { code: frame.code, message: frame.message },
            'warning'
        );
        if (!command) {
            return;
        }
        if (
            frame.code === 'structureConflict' &&
            command.retries < COMMAND_CONFLICT_RETRIES
        ) {
            // targets are resolved again by key against the list we have now
            this.issueCommand({ ...command, retries: command.retries + 1 });
            return;
        }
        if (frame.code === 'locked') {
            this.deps.repository.toast(
                this.deps.repository.dictionary.agent_chat.editing_locked,
                'info'
            );
        }
    }

    private onPresenceChanged(frame: CollabPresenceChangedFrame): void {
        if (frame.connectionId === this.connectionId) {
            return;
        }
        for (const client of this.docs.values()) {
            if (client.docId !== frame.docId) {
                // a connection has one cursor per project
                client.removeCursor(frame.connectionId);
            }
        }
        this.docs.get(frame.docId)?.setRemotePresence(frame);
    }

    private onParticipantsChanged(frame: CollabParticipantsChangedFrame): void {
        if (!Array.isArray(frame.participants)) {
            return;
        }
        const participants: CollabParticipant[] = frame.participants
            .filter(
                (p) =>
                    p &&
                    isNumber(p.userId) &&
                    isString(p.displayName) &&
                    isString(p.color)
            )
            .map((p) => ({
                userId: p.userId,
                displayName: p.displayName,
                color: p.color,
                connectionIds: Array.isArray(p.connectionIds)
                    ? p.connectionIds.filter(isString)
                    : [],
            }));
        this.deps.collabRepository.setParticipants(participants);
        const connections = new Set(
            participants.flatMap((p) => p.connectionIds)
        );
        for (const client of this.docs.values()) {
            client.retainConnections(connections);
        }
    }

    private onCollabError(frame: CollabErrorFrame): void {
        const refused =
            frame.code === 'forbidden' ||
            frame.code === 'projectNotFound' ||
            frame.code === 'participantLimit';
        // the refusals come before close 1008 and are expected: a breadcrumb, not an error
        this.log(
            'collab error',
            { code: frame.code, message: frame.message },
            refused ? 'info' : 'error'
        );
        if (refused && !this.everLive) {
            this.denied = true;
            clearTimeout(this.welcomeTimer);
            this.setStatus('denied');
            this.publishSlots();
        }
        if (frame.code === 'participantLimit') {
            this.deps.collabRepository.setParticipantLimit(
                participantLimitOf(frame.message)
            );
        }
        if (frame.code === 'segmentNotFound' && frame.requestId) {
            for (const slot of this.slots) {
                if (slot.opening === frame.requestId) {
                    slot.opening = undefined;
                }
            }
            this.publishSlots();
        }
    }

    /*
     * Texts
     */

    private onDocChange(client: CollabDocumentClient, change: CollabDocChange) {
        if (!change.remote) {
            return;
        }
        const index = this.slots.findIndex(
            (slot) => slot.docId === client.docId
        );
        if (index < 0) {
            return;
        }
        this.writeSegmentText(index, change.after.toString(), change);
    }

    /**
     * Remote text into ProgramService and Redux first, then into the mounted view, so
     * that the controlled value and the view agree before React renders.
     */
    private writeSegmentText(
        index: number,
        text: string,
        change: CollabDocChange
    ): void {
        const program = this.deps.programService.getCurrentProgram();
        const segment = program.segments[index];
        if (!segment) {
            return;
        }
        this.deps.programService.setSegmentTextExternally(index, text);
        this.deps.programService.dropHistory();
        this.deps.repository.projectViewModelRepository.setInputSegmentText(
            index,
            text
        );
        this.deps.ideService.onSegmentUpdate(index, text);
        const key = this.slots[index]?.key;
        const client = this.clientForKey(key);
        const cursors = client?.remoteCursors() ?? [];
        for (const sink of this.sinks) {
            if (sink.key() === key) {
                sink.applyRemote(change, cursors);
            }
        }
    }

    /** IdeService.onProgramUpdated: local text changes become collaborative edits */
    private reconcileLocalProgram(): void {
        if (!this.isActive() || !this.isCurrentProject()) {
            if (this.projectId && !this.everLive) {
                this.alignSlotsWithProgram();
            }
            return;
        }
        if (this.resetting) {
            return;
        }
        const program = this.deps.programService.getCurrentProgram();
        if (program.segments.length !== this.slots.length) {
            this.onStructureMismatch();
            return;
        }
        if (!this.canEdit()) {
            return;
        }
        this.slots.forEach((slot, index) => {
            const client = slot.docId ? this.docs.get(slot.docId) : undefined;
            const text = program.segments[index]?.text;
            if (client && text !== undefined) {
                client.setLocalText(text);
            }
        });
    }

    /** IdeService.setNewProgram: the program came over REST, the documents are newer */
    private adoptCollabTexts(): void {
        if (!this.isActive() || !this.isCurrentProject() || this.resetting) {
            return;
        }
        const program = this.deps.programService.getCurrentProgram();
        if (program.segments.length !== this.slots.length) {
            this.onStructureMismatch();
            return;
        }
        this.slots.forEach((slot, index) => {
            const client = slot.docId ? this.docs.get(slot.docId) : undefined;
            if (client) {
                this.deps.programService.setSegmentTextExternally(
                    index,
                    client.text
                );
            }
        });
    }

    /**
     * The program has another segment count than the session: something replaced it
     * over REST (the agent, a hunk revert). The server follows with segmentsChanged
     * `reset`; without it the project is reloaded anyway.
     */
    private onStructureMismatch(): void {
        if (this.structureMismatch) {
            return;
        }
        this.structureMismatch = true;
        this.log(
            'program and session segment lists differ',
            undefined,
            'warning'
        );
        this.publishSlots();
        clearTimeout(this.mismatchTimer);
        this.mismatchTimer = setTimeout(() => {
            if (this.structureMismatch) {
                void this.resetAll('segment list mismatch timeout');
            }
        }, STRUCTURE_MISMATCH_RESET_MS);
    }

    /** Drops every document, reloads the project over REST and opens them again */
    private async resetAll(
        reason: string,
        segments?: CollabSegmentRef[]
    ): Promise<void> {
        const projectId = this.projectId;
        if (!projectId) {
            return;
        }
        const token = this.sessionToken;
        this.log('reset', { reason });
        this.resetting = true;
        this.structureMismatch = false;
        clearTimeout(this.mismatchTimer);
        for (const docId of [...this.docs.keys()]) {
            const lost = this.docs.get(docId)?.unconfirmedCount ?? 0;
            if (lost) {
                this.log(
                    'unconfirmed updates lost on reset',
                    { docId, lost },
                    'warning'
                );
            }
            this.disposeDoc(docId);
        }
        this.slots = [];
        this.publishSlots();
        if (segments) {
            this.serverSegments = segments;
        }
        for (let attempt = 1; attempt <= RESET_RELOAD_ATTEMPTS; attempt++) {
            const result = await this.deps.rpi.getProjectRequest(projectId);
            if (token !== this.sessionToken) {
                return;
            }
            if (result.isOk && result.body?.program) {
                this.resetting = true;
                this.deps.ideService.setNewProgram(
                    result.body.program,
                    result.body.lastProgramResult
                );
                const count =
                    this.deps.programService.getCurrentProgram().segments
                        .length;
                if (count === this.serverSegments.length || !this.welcomed) {
                    break;
                }
                this.log(
                    'reloaded program does not match the session yet',
                    { count, server: this.serverSegments.length, attempt },
                    'warning'
                );
            }
            await new Promise((resolve) =>
                setTimeout(resolve, RESET_RELOAD_DELAY_MS)
            );
            if (token !== this.sessionToken) {
                return;
            }
        }
        this.resetting = false;
        this.rebuildSlots();
        this.ensureDocsOpen();
        this.publishSlots();
    }

    /*
     * Documents
     */

    private readonly transport: CollabDocTransport = {
        send: (frame: CollabClientFrame) =>
            this.welcomed ? (this.connection?.send(frame) ?? false) : false,
        nextRequestId: (prefix: string) => this.nextRequestId(prefix),
        isLive: () => this.welcomed && (this.connection?.isOpen() ?? false),
        maxUpdatesPerPush: () =>
            this.limits?.maxUpdatesPerPush ?? DEFAULT_MAX_UPDATES_PER_PUSH,
        log: (message, data, level) => this.log(message, data, level),
    };

    private ensureDocsOpen(): void {
        if (!this.welcomed || this.resetting || this.structureMismatch) {
            return;
        }
        const limit =
            this.limits?.maxOpenDocuments ?? DEFAULT_MAX_OPEN_DOCUMENTS;
        let open =
            this.docs.size + this.slots.filter((slot) => slot.opening).length;
        this.slots.forEach((slot, index) => {
            if (slot.docId || slot.opening) {
                return;
            }
            if (open >= limit) {
                return;
            }
            const requestId = this.nextRequestId('o');
            if (
                this.connection?.send({
                    type: 'openDocument',
                    requestId,
                    segmentId: index + 1,
                })
            ) {
                slot.opening = requestId;
                open += 1;
            }
        });
        if (
            open >= limit &&
            this.slots.some((slot) => !slot.docId && !slot.opening)
        ) {
            this.log('open document limit reached', { limit }, 'warning');
        }
    }

    private disposeDoc(docId: string): void {
        const client = this.docs.get(docId);
        if (!client) {
            return;
        }
        this.docUnsubscribers.get(docId)?.();
        this.docUnsubscribers.delete(docId);
        client.dispose();
        this.docs.delete(docId);
        for (const slot of this.slots) {
            if (slot.docId === docId) {
                slot.docId = undefined;
            }
        }
    }

    private setLocked(locked: boolean): void {
        this.locked = locked;
        this.deps.collabRepository.setLocked(locked);
        for (const client of this.docs.values()) {
            client.setLocked(locked);
        }
        if (!locked) {
            this.sendOutbox();
        }
    }

    private docIdsConflict(segments: CollabSegmentRef[]): boolean {
        for (const ref of segments) {
            if (!ref.docId) {
                continue;
            }
            const index = this.slots.findIndex(
                (slot) => slot.docId === ref.docId
            );
            if (index >= 0 && index !== ref.segmentId - 1) {
                return true;
            }
        }
        return false;
    }

    /*
     * Commands
     */

    private issueCommand(command: PendingCommand): void {
        if (!this.welcomed || this.locked) {
            // sent after the reconnect or the agent; targets are resolved then
            this.outbox.push(command);
            if (this.locked) {
                this.deps.repository.toast(
                    this.deps.repository.dictionary.agent_chat.editing_locked,
                    'info'
                );
            }
            return;
        }
        const requestId = this.nextRequestId('c');
        let frame: CollabClientFrame | null = null;
        switch (command.kind) {
            case 'add': {
                const afterIndex =
                    command.afterKey === null
                        ? -1
                        : this.slotIndex(command.afterKey);
                const position = command.append
                    ? this.slots.length + 1
                    : afterIndex < 0 && command.afterKey !== null
                      ? this.slots.length + 1
                      : afterIndex + 2;
                frame = {
                    type: 'addSegment',
                    requestId,
                    structureVersion: this.structureVersion,
                    position,
                    segmentType: command.segmentType,
                    ...(command.text ? { text: command.text } : {}),
                };
                break;
            }
            case 'delete': {
                const index = this.slotIndex(command.key);
                if (index < 0) {
                    return;
                }
                frame = {
                    type: 'deleteSegment',
                    requestId,
                    structureVersion: this.structureVersion,
                    segmentId: index + 1,
                };
                break;
            }
            case 'move': {
                const index = this.slotIndex(command.key);
                const to = command.direction === 'up' ? index - 1 : index + 1;
                if (index < 0 || to < 0 || to >= this.slots.length) {
                    return;
                }
                frame = {
                    type: 'moveSegment',
                    requestId,
                    structureVersion: this.structureVersion,
                    segmentId: index + 1,
                    toSegmentId: to + 1,
                };
                break;
            }
        }
        if (frame && this.connection?.send(frame)) {
            this.commands.set(requestId, command);
            this.log('command', { type: frame.type, requestId });
        } else if (frame) {
            this.outbox.push(command);
        }
    }

    private sendOutbox(): void {
        if (!this.welcomed || this.locked || !this.outbox.length) {
            return;
        }
        const queued = this.outbox;
        this.outbox = [];
        for (const command of queued) {
            this.issueCommand(command);
        }
    }

    /*
     * Presence
     */

    private schedulePresence(): void {
        if (this.presenceTimer !== undefined) {
            return;
        }
        const wait = Math.max(
            0,
            COLLAB_PRESENCE_THROTTLE_MS - (Date.now() - this.presenceSentAt)
        );
        if (wait === 0) {
            this.sendPresence();
            return;
        }
        this.presenceTimer = setTimeout(() => {
            this.presenceTimer = undefined;
            this.sendPresence();
        }, wait);
    }

    private sendPresence(): void {
        const pending = this.presencePending;
        if (!pending || !this.welcomed) {
            return;
        }
        const client = this.docs.get(pending.docId);
        if (!client) {
            this.presencePending = null;
            return;
        }
        const length = client.doc.length;
        const selection = pending.selection
            ? {
                  anchor: Math.min(pending.selection.anchor, length),
                  head: Math.min(pending.selection.head, length),
              }
            : undefined;
        const sent = this.connection?.send({
            type: 'updatePresence',
            docId: pending.docId,
            version: client.version,
            ...(selection ? { selection } : {}),
        });
        if (sent) {
            this.presencePending = null;
            this.presenceSentAt = Date.now();
            this.lastPresenceDocId = selection ? pending.docId : null;
        }
    }

    /**
     * Sends the presence again with the current selection: after a reconnect, and when
     * our own updates got confirmed (receivers then map it against the same text).
     */
    private refreshPresence(docId?: string): void {
        for (const sink of this.sinks) {
            const slot = this.slotByKey(sink.key());
            if (!slot?.docId || (docId && slot.docId !== docId)) {
                continue;
            }
            const selection = sink.selection();
            if (selection) {
                this.presencePending = { docId: slot.docId, selection };
                this.schedulePresence();
            }
        }
    }

    /** Remote carets go to views in a microtask: a view may be in the middle of an update */
    private queueCursorFlush(key: string | undefined): void {
        if (!key || this.cursorFlushQueued.has(key)) {
            return;
        }
        this.cursorFlushQueued.add(key);
        queueMicrotask(() => {
            this.cursorFlushQueued.delete(key);
            const client = this.clientForKey(key);
            const cursors = client?.remoteCursors() ?? [];
            const doc = client?.doc;
            for (const sink of this.sinks) {
                if (sink.key() === key) {
                    sink.setCursors(cursors, doc ?? Text.empty);
                }
            }
        });
    }

    /*
     * Slots
     */

    private newKey(): string {
        this.keyCounter += 1;
        return `cs-${this.keyCounter}`;
    }

    private rebuildSlots(): void {
        this.slots = this.deps.programService
            .getCurrentProgram()
            .segments.map(() => ({ key: this.newKey() }));
        this.publishSlots();
    }

    /** Before the first welcome the program may still change locally */
    private alignSlotsWithProgram(): void {
        const count =
            this.deps.programService.getCurrentProgram().segments.length;
        if (this.slots.length !== count) {
            this.rebuildSlots();
        }
    }

    private slotIndex(key: string): number {
        return this.slots.findIndex((slot) => slot.key === key);
    }

    private slotByKey(key: string): Slot | undefined {
        return this.slots.find((slot) => slot.key === key);
    }

    private clientForKey(
        key: string | undefined
    ): CollabDocumentClient | undefined {
        if (!key) {
            return undefined;
        }
        const docId = this.slotByKey(key)?.docId;
        return docId ? this.docs.get(docId) : undefined;
    }

    private publishSlots(): void {
        const blocked = this.resetting || this.structureMismatch;
        this.deps.collabRepository.setReadySegments(
            this.slots.map(
                (slot) =>
                    !blocked && Boolean(slot.docId && this.docs.has(slot.docId))
            )
        );
        this.deps.collabRepository.setSegmentKeys(
            this.slots.map((slot) => slot.key)
        );
    }

    private setStatus(status: CollabStatus): void {
        this.deps.collabRepository.setStatus(status);
    }

    private isCurrentProject(): boolean {
        return (
            this.deps.repository.projectViewModelRepository.project()
                ?.projectId === this.projectId
        );
    }

    private nextRequestId(prefix: string): string {
        this.requestCounter += 1;
        return `${prefix}-${this.requestCounter}`;
    }

    private log(
        message: string,
        data?: Record<string, unknown>,
        level: 'debug' | 'info' | 'warning' | 'error' = 'info'
    ): void {
        logBreadcrumb('collab', message, data, level);
    }
}
