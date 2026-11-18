import { ChangeSet, EditorState, Text } from '@codemirror/state';
import {
    collab,
    getClientID,
    getSyncedVersion,
    receiveUpdates,
    sendableUpdates,
} from '@codemirror/collab';
import {
    CollabClientFrame,
    CollabPresenceChangedFrame,
    CollabPushRejectedFrame,
    CollabUpdate,
    COLLAB_SERVER_CLIENT_ID,
} from '../../../model/rpi/collabSocket.ts';

/** What the document client needs from the session */
export interface CollabDocTransport {
    /** false when the frame could not be sent (socket not open) */
    send: (frame: CollabClientFrame) => boolean;
    nextRequestId: (prefix: string) => string;
    /** Open and welcomed: frames of this document may be sent */
    isLive: () => boolean;
    maxUpdatesPerPush: () => number;
    log: (
        message: string,
        data?: Record<string, unknown>,
        level?: 'debug' | 'info' | 'warning' | 'error'
    ) => void;
}

/** A caret or selection of another connection in this document */
export interface RemoteCursor {
    connectionId: string;
    userId: number;
    displayName: string;
    color: string;
    anchor: number;
    head: number;
    /**
     * The sender was ahead of our synced version: its positions belong to a document we
     * have not seen yet, so they are kept as they are (clamped) until its next presence.
     */
    frozen: boolean;
}

export interface CollabDocChange {
    changes: ChangeSet;
    before: Text;
    after: Text;
    /** true for changes that came from the server (other clients or the server) */
    remote: boolean;
}

/** Problems the document cannot solve by itself; the session reacts to them */
export type CollabDocProblem =
    | { kind: 'reload'; reason: string }
    | { kind: 'unknownDocument' }
    | { kind: 'readOnly' };

/** How long a versionConflict waits for the missing updates before it pulls them */
export const COLLAB_CONFLICT_PULL_MS = 3000;

/** A fresh collab clientID; never the reserved `server` */
function generateClientId(): string {
    let id = '';
    while (!id || id === COLLAB_SERVER_CLIENT_ID) {
        id =
            Math.floor(Math.random() * 2 ** 32).toString(36) +
            Math.floor(Math.random() * 2 ** 32).toString(36);
    }
    return id;
}

/** Splits like CodeMirror does: `\r\n`, `\r` and `\n` are all line breaks */
export function toCollabText(text: string): Text {
    return Text.of(text.split(/\r\n?|\n/));
}

/** Single replaced range between two texts (common prefix and suffix are kept) */
export function diffTexts(
    before: string,
    after: string
): { from: number; to: number; insert: string } | null {
    if (before === after) {
        return null;
    }
    const min = Math.min(before.length, after.length);
    let start = 0;
    while (
        start < min &&
        before.charCodeAt(start) === after.charCodeAt(start)
    ) {
        start++;
    }
    let endBefore = before.length;
    let endAfter = after.length;
    while (
        endBefore > start &&
        endAfter > start &&
        before.charCodeAt(endBefore - 1) === after.charCodeAt(endAfter - 1)
    ) {
        endBefore--;
        endAfter--;
    }
    return {
        from: start,
        to: endBefore,
        insert: after.slice(start, endAfter),
    };
}

/**
 * Headless collaboration state of one document (one segment). It owns an
 * `EditorState` with the `collab()` extension that is the source of truth for the
 * text, independent of any mounted editor view: views come and go (remounts, segment
 * moves) while this state keeps the confirmed version and the unconfirmed updates.
 *
 * Exactly one push is in flight at a time. The server echoes accepted updates to the
 * author as `documentUpdates`; `receiveUpdates` recognizes them by clientID and
 * position and confirms them.
 */
export class CollabDocumentClient {
    readonly docId: string;
    segmentId: number;
    private state: EditorState;
    private inFlight: string | null = null;
    /** versionConflict: push again once the synced version reaches this */
    private waitForVersion: number | null = null;
    private conflictTimer: ReturnType<typeof setTimeout> | undefined;
    private pullRequestId: string | null = null;
    private resumeRequestId: string | null = null;
    private locked = false;
    private readOnly = false;
    private disposed = false;
    private cursors = new Map<string, RemoteCursor>();
    private changeListeners = new Set<(change: CollabDocChange) => void>();
    private cursorListeners = new Set<() => void>();
    private drainListeners = new Set<() => void>();

    constructor(
        params: {
            docId: string;
            segmentId: number;
            version: number;
            text: string;
            clientId?: string;
        },
        private transport: CollabDocTransport,
        private onProblem: (problem: CollabDocProblem) => void = () => {}
    ) {
        this.docId = params.docId;
        this.segmentId = params.segmentId;
        this.state = EditorState.create({
            doc: toCollabText(params.text),
            extensions: [
                collab({
                    startVersion: params.version,
                    clientID: params.clientId ?? generateClientId(),
                }),
            ],
        });
    }

    get doc(): Text {
        return this.state.doc;
    }

    get text(): string {
        return this.state.doc.toString();
    }

    get version(): number {
        return getSyncedVersion(this.state);
    }

    get clientId(): string {
        return getClientID(this.state);
    }

    /** Number of local updates not yet confirmed by the server */
    get unconfirmedCount(): number {
        return sendableUpdates(this.state).length;
    }

    get isResuming(): boolean {
        return this.resumeRequestId !== null;
    }

    onChange(listener: (change: CollabDocChange) => void): () => void {
        this.changeListeners.add(listener);
        return () => this.changeListeners.delete(listener);
    }

    onCursorsChanged(listener: () => void): () => void {
        this.cursorListeners.add(listener);
        return () => this.cursorListeners.delete(listener);
    }

    /** Called when every local update has been confirmed */
    onDrained(listener: () => void): () => void {
        this.drainListeners.add(listener);
        return () => this.drainListeners.delete(listener);
    }

    /**
     * Applies local changes made against `startDoc`. Returns false (and applies nothing)
     * when `startDoc` is not this document's current text: the edit was made against
     * something else, for example a view that still shows the previous segment.
     */
    applyLocalChanges(changes: ChangeSet, startDoc?: Text): boolean {
        if (this.disposed) {
            return false;
        }
        if (startDoc && !startDoc.eq(this.state.doc)) {
            return false;
        }
        if (changes.length !== this.state.doc.length) {
            return false;
        }
        if (changes.empty) {
            return true;
        }
        const before = this.state.doc;
        this.state = this.state.update({ changes }).state;
        this.mapCursors(changes, -1);
        this.emitChange({
            changes,
            before,
            after: this.state.doc,
            remote: false,
        });
        this.flush();
        return true;
    }

    /** Local text replacement, expressed as one minimal change. false if equal */
    setLocalText(text: string): boolean {
        const normalized = toCollabText(text).toString();
        const diff = diffTexts(this.text, normalized);
        if (!diff) {
            return false;
        }
        return this.applyLocalChanges(
            ChangeSet.of(diff, this.state.doc.length)
        );
    }

    /** `documentUpdates` of this document */
    receiveDocumentUpdates(
        fromVersion: number,
        updates: CollabUpdate[],
        requestId?: string
    ): void {
        if (this.disposed || this.resumeRequestId) {
            return;
        }
        if (requestId && requestId === this.pullRequestId) {
            this.pullRequestId = null;
        }
        const synced = this.version;
        if (fromVersion > synced) {
            // frames were lost: ask for the gap
            this.transport.log(
                'gap in document updates',
                { docId: this.docId, fromVersion, synced },
                'warning'
            );
            this.pull();
            return;
        }
        const skip = synced - fromVersion;
        if (skip >= updates.length) {
            this.afterSync();
            return;
        }
        this.applyRemote(updates.slice(skip));
        this.afterSync();
    }

    /** Sends `resumeDocument` after a reconnect. Pushes wait for the answer */
    resume(): void {
        if (this.disposed) {
            return;
        }
        this.clearPushState();
        this.resumeRequestId = this.transport.nextRequestId('r');
        this.transport.send({
            type: 'resumeDocument',
            requestId: this.resumeRequestId,
            docId: this.docId,
            version: this.version,
        });
    }

    /** `documentResumed` */
    receiveResumed(
        requestId: string,
        fromVersion: number,
        updates: CollabUpdate[]
    ): void {
        if (this.disposed || requestId !== this.resumeRequestId) {
            return;
        }
        this.resumeRequestId = null;
        if (fromVersion !== this.version) {
            this.onProblem({ kind: 'reload', reason: 'resumeVersionMismatch' });
            return;
        }
        if (updates.length) {
            this.applyRemote(updates);
        }
        this.afterSync();
    }

    onPushAccepted(requestId: string, version: number): void {
        if (requestId !== this.inFlight) {
            return;
        }
        this.inFlight = null;
        if (version > this.version) {
            // the echo of our updates did not arrive: pushing now would duplicate them
            this.transport.log(
                'push accepted ahead of synced version',
                { docId: this.docId, version, synced: this.version },
                'warning'
            );
            this.waitForVersion = version;
            this.pull();
            return;
        }
        this.flush();
        this.notifyIfDrained();
    }

    onPushRejected(frame: CollabPushRejectedFrame): void {
        if (frame.requestId !== this.inFlight) {
            return;
        }
        this.inFlight = null;
        this.transport.log(
            'push rejected',
            {
                docId: this.docId,
                code: frame.code,
                serverVersion: frame.serverVersion,
            },
            frame.code === 'versionConflict' ? 'info' : 'warning'
        );
        switch (frame.code) {
            case 'versionConflict': {
                const serverVersion = frame.serverVersion;
                if (
                    serverVersion === undefined ||
                    serverVersion <= this.version
                ) {
                    this.flush();
                    return;
                }
                this.waitForVersion = serverVersion;
                clearTimeout(this.conflictTimer);
                this.conflictTimer = setTimeout(() => {
                    if (this.waitForVersion !== null && !this.disposed) {
                        this.pull();
                    }
                }, COLLAB_CONFLICT_PULL_MS);
                return;
            }
            case 'locked':
                // pushed again after projectLockChanged(false)
                this.locked = true;
                return;
            case 'readOnly':
                this.readOnly = true;
                this.onProblem({ kind: 'readOnly' });
                return;
            case 'unknownDocument':
                this.onProblem({ kind: 'unknownDocument' });
                return;
            case 'invalidChanges':
            case 'tooLarge':
            default:
                this.onProblem({ kind: 'reload', reason: frame.code });
        }
    }

    setLocked(locked: boolean): void {
        this.locked = locked;
        if (!locked) {
            this.flush();
        }
    }

    /** The socket is gone; the state with its unconfirmed updates is kept */
    onDisconnected(): void {
        this.clearPushState();
        this.resumeRequestId = null;
        if (this.cursors.size) {
            this.cursors.clear();
            this.emitCursors();
        }
    }

    /** Sends the unconfirmed updates when nothing blocks it */
    flush(): void {
        if (
            this.disposed ||
            this.inFlight ||
            this.locked ||
            this.readOnly ||
            this.resumeRequestId ||
            this.waitForVersion !== null ||
            !this.transport.isLive()
        ) {
            return;
        }
        const pending = sendableUpdates(this.state);
        if (!pending.length) {
            return;
        }
        const limit = Math.max(1, this.transport.maxUpdatesPerPush());
        const requestId = this.transport.nextRequestId('p');
        const sent = this.transport.send({
            type: 'pushUpdates',
            requestId,
            docId: this.docId,
            version: this.version,
            updates: pending.slice(0, limit).map((update) => ({
                clientID: update.clientID,
                changes: update.changes.toJSON(),
            })),
        });
        if (sent) {
            this.inFlight = requestId;
        }
    }

    /*
     * Presence
     */

    setRemotePresence(frame: CollabPresenceChangedFrame): void {
        if (!frame.selection) {
            if (this.cursors.delete(frame.connectionId)) {
                this.emitCursors();
            }
            return;
        }
        const length = this.state.doc.length;
        const clamp = (pos: number) =>
            Math.max(0, Math.min(Number(pos) || 0, length));
        this.cursors.set(frame.connectionId, {
            connectionId: frame.connectionId,
            userId: frame.userId,
            displayName: frame.displayName,
            color: frame.color,
            anchor: clamp(frame.selection.anchor),
            head: clamp(frame.selection.head),
            frozen: (frame.version ?? 0) > this.version,
        });
        this.emitCursors();
    }

    /** Removes cursors of connections that are not in the list any more */
    retainConnections(connectionIds: Set<string>): void {
        let changed = false;
        for (const id of [...this.cursors.keys()]) {
            if (!connectionIds.has(id)) {
                this.cursors.delete(id);
                changed = true;
            }
        }
        if (changed) {
            this.emitCursors();
        }
    }

    removeCursor(connectionId: string): void {
        if (this.cursors.delete(connectionId)) {
            this.emitCursors();
        }
    }

    remoteCursors(): RemoteCursor[] {
        const length = this.state.doc.length;
        return [...this.cursors.values()].map((cursor) => ({
            ...cursor,
            anchor: Math.min(cursor.anchor, length),
            head: Math.min(cursor.head, length),
        }));
    }

    dispose(): void {
        this.disposed = true;
        clearTimeout(this.conflictTimer);
        this.changeListeners.clear();
        this.cursorListeners.clear();
        this.drainListeners.clear();
    }

    /*
     * Internals
     */

    private applyRemote(updates: CollabUpdate[]): void {
        let parsed;
        try {
            parsed = updates.map((update) => ({
                clientID: String(update.clientID),
                changes: ChangeSet.fromJSON(update.changes),
            }));
        } catch (error) {
            this.transport.log(
                'malformed remote updates',
                { docId: this.docId, error: String(error) },
                'error'
            );
            this.onProblem({ kind: 'reload', reason: 'malformedUpdates' });
            return;
        }
        const before = this.state.doc;
        let transaction;
        try {
            transaction = receiveUpdates(this.state, parsed);
        } catch (error) {
            // change set lengths do not match our document: our history is not the server's
            this.transport.log(
                'remote updates do not apply',
                { docId: this.docId, error: String(error) },
                'error'
            );
            this.onProblem({ kind: 'reload', reason: 'updatesDoNotApply' });
            return;
        }
        this.state = transaction.state;
        if (transaction.docChanged) {
            this.mapCursors(transaction.changes, 1);
            this.emitChange({
                changes: transaction.changes,
                before,
                after: this.state.doc,
                remote: true,
            });
        }
    }

    private afterSync(): void {
        if (
            this.waitForVersion !== null &&
            this.version >= this.waitForVersion
        ) {
            this.waitForVersion = null;
            clearTimeout(this.conflictTimer);
        }
        this.flush();
        this.notifyIfDrained();
    }

    private notifyIfDrained(): void {
        if (!this.inFlight && sendableUpdates(this.state).length === 0) {
            for (const listener of [...this.drainListeners]) {
                listener();
            }
        }
    }

    private pull(): void {
        if (this.pullRequestId || !this.transport.isLive()) {
            return;
        }
        this.pullRequestId = this.transport.nextRequestId('u');
        this.transport.send({
            type: 'pullUpdates',
            requestId: this.pullRequestId,
            docId: this.docId,
            version: this.version,
        });
    }

    private clearPushState(): void {
        this.inFlight = null;
        this.pullRequestId = null;
        this.waitForVersion = null;
        clearTimeout(this.conflictTimer);
    }

    private mapCursors(changes: ChangeSet, assoc: -1 | 1): void {
        if (!this.cursors.size) {
            return;
        }
        for (const cursor of this.cursors.values()) {
            if (cursor.frozen) {
                continue;
            }
            cursor.anchor = changes.mapPos(cursor.anchor, assoc);
            cursor.head = changes.mapPos(cursor.head, assoc);
        }
        this.emitCursors();
    }

    private emitChange(change: CollabDocChange): void {
        for (const listener of [...this.changeListeners]) {
            listener(change);
        }
    }

    private emitCursors(): void {
        for (const listener of [...this.cursorListeners]) {
            listener();
        }
    }
}
