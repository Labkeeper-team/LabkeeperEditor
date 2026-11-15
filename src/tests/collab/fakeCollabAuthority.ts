import { ChangeSet, Text } from '@codemirror/state';
import type {
    CollabClientFrame,
    CollabParticipant,
    CollabSegmentRef,
    CollabSegmentType,
    CollabServerFrame,
    CollabUpdate,
} from '../../model/rpi/collabSocket.ts';

/**
 * In-memory central authority implementing the semantics of the `projectCollab`
 * channel (asyncapi): version check on push, broadcast of accepted updates to every
 * subscriber including the author, then pushAccepted; rejections; resume from a known
 * version; server-authoritative segment commands; presence and participants.
 *
 * Transport-agnostic: frames go out through the `send` of each peer, frames come in
 * through `receive`. Used by jest tests and by the Playwright WebSocket mock.
 */

export interface FakeCollabPeer {
    connectionId: string;
    userId: number;
    displayName: string;
    color: string;
    send: (frame: CollabServerFrame) => void;
    /** Server-side close of the socket (1008 after a refusal) */
    close?: (code: number) => void;
}

interface FakeDoc {
    docId: string;
    segmentType: CollabSegmentType;
    text: Text;
    updates: { clientID: string; changes: ChangeSet }[];
    subscribers: Set<string>;
}

export interface FakeCollabAuthorityOptions {
    segments: { type: CollabSegmentType; text: string }[];
    maxUpdatesPerPush?: number;
    /** Updates older than this version are no longer kept (resume then reloads) */
    historyStart?: number;
    canWrite?: (userId: number) => boolean;
    /** Distinct users at once; the next one gets participantLimit and 1008 (default 5) */
    maxParticipants?: number;
}

export class FakeCollabAuthority {
    private docs: FakeDoc[];
    private peers = new Map<string, FakeCollabPeer>();
    /** connectionId -> docId its cursor is in */
    private presenceDoc = new Map<string, string>();
    private structureVersion = 17;
    private docCounter = 0;
    locked = false;
    /** Every frame received, for assertions */
    readonly log: { connectionId: string; frame: CollabClientFrame }[] = [];
    /** Every rejection sent, for assertions */
    readonly rejections: CollabServerFrame[] = [];

    constructor(private options: FakeCollabAuthorityOptions) {
        this.docs = options.segments.map((segment) =>
            this.newDoc(segment.type, segment.text)
        );
    }

    /*
     * Inspection
     */

    texts(): string[] {
        return this.docs.map((doc) => doc.text.toString());
    }

    text(segmentId: number): string {
        return this.docs[segmentId - 1]?.text.toString() ?? '';
    }

    version(segmentId: number): number {
        return this.docs[segmentId - 1]?.updates.length ?? 0;
    }

    docId(segmentId: number): string {
        return this.docs[segmentId - 1].docId;
    }

    segmentCount(): number {
        return this.docs.length;
    }

    connectionIds(): string[] {
        return [...this.peers.keys()];
    }

    /*
     * Connections
     */

    /** false when the connection was refused (participantLimit, then close 1008) */
    connect(peer: FakeCollabPeer): boolean {
        const max = this.options.maxParticipants ?? 5;
        const users = new Set([...this.peers.values()].map((p) => p.userId));
        if (!users.has(peer.userId) && users.size >= max) {
            peer.send({
                type: 'collabError',
                code: 'participantLimit',
                message: `At most ${max} people can edit this project at the same time`,
            });
            peer.close?.(1008);
            return false;
        }
        this.peers.set(peer.connectionId, peer);
        peer.send({
            type: 'welcome',
            protocolVersion: 1,
            connectionId: peer.connectionId,
            userId: peer.userId,
            displayName: peer.displayName,
            color: peer.color,
            canWrite: this.options.canWrite?.(peer.userId) ?? true,
            structureVersion: this.structureVersion,
            locked: this.locked,
            segments: this.segmentRefs(),
            limits: {
                maxMessageBytes: 1_000_000,
                maxUpdatesPerPush: this.options.maxUpdatesPerPush ?? 100,
                maxDocumentLength: 1_000_000,
                maxChangeSetEntries: 10_000,
                maxOpenDocuments: 200,
                maxParticipants: max,
            },
            presenceTimeoutSeconds: 60,
        });
        peer.send({
            type: 'participantsChanged',
            kind: 'snapshot',
            participants: this.participants(),
        });
        this.broadcastParticipants('joined', peer, peer.connectionId);
        return true;
    }

    disconnect(connectionId: string): void {
        const peer = this.peers.get(connectionId);
        if (!peer) {
            return;
        }
        this.peers.delete(connectionId);
        for (const doc of this.docs) {
            doc.subscribers.delete(connectionId);
        }
        this.clearPresence(peer);
        this.broadcastParticipants('left', peer);
    }

    setLocked(locked: boolean): void {
        this.locked = locked;
        for (const peer of this.peers.values()) {
            peer.send({ type: 'projectLockChanged', locked, reason: 'agent' });
        }
    }

    /*
     * Client frames
     */

    receive(connectionId: string, frame: CollabClientFrame): void {
        const peer = this.peers.get(connectionId);
        if (!peer) {
            return;
        }
        this.log.push({ connectionId, frame });
        switch (frame.type) {
            case 'ping':
                peer.send({ type: 'pong', requestId: frame.requestId });
                return;
            case 'openDocument': {
                const doc = this.docs[frame.segmentId - 1];
                if (!doc) {
                    peer.send({
                        type: 'collabError',
                        code: 'segmentNotFound',
                        requestId: frame.requestId,
                    });
                    return;
                }
                doc.subscribers.add(connectionId);
                peer.send({
                    type: 'documentOpened',
                    requestId: frame.requestId,
                    docId: doc.docId,
                    segmentId: frame.segmentId,
                    version: doc.updates.length,
                    text: doc.text.toString(),
                });
                return;
            }
            case 'resumeDocument': {
                const index = this.docs.findIndex(
                    (d) => d.docId === frame.docId
                );
                const doc = this.docs[index];
                const start = this.options.historyStart ?? 0;
                if (
                    !doc ||
                    frame.version > doc.updates.length ||
                    frame.version < start
                ) {
                    peer.send({
                        type: 'reloadRequired',
                        requestId: frame.requestId,
                        docId: frame.docId,
                        segmentId: doc ? index + 1 : undefined,
                        reason: !doc
                            ? 'unknownDocument'
                            : frame.version > doc.updates.length
                              ? 'unknownVersion'
                              : 'historyTrimmed',
                    });
                    return;
                }
                doc.subscribers.add(connectionId);
                peer.send({
                    type: 'documentResumed',
                    requestId: frame.requestId,
                    docId: doc.docId,
                    segmentId: index + 1,
                    fromVersion: frame.version,
                    version: doc.updates.length,
                    updates: this.updatesFrom(doc, frame.version),
                });
                return;
            }
            case 'closeDocument': {
                const doc = this.docs.find((d) => d.docId === frame.docId);
                doc?.subscribers.delete(connectionId);
                return;
            }
            case 'pullUpdates': {
                const index = this.docs.findIndex(
                    (d) => d.docId === frame.docId
                );
                const doc = this.docs[index];
                if (!doc) {
                    peer.send({
                        type: 'collabError',
                        code: 'unknownDocument',
                        requestId: frame.requestId,
                    });
                    return;
                }
                peer.send({
                    type: 'documentUpdates',
                    requestId: frame.requestId,
                    docId: doc.docId,
                    segmentId: index + 1,
                    fromVersion: frame.version,
                    updates: this.updatesFrom(doc, frame.version),
                });
                return;
            }
            case 'pushUpdates':
                this.onPush(peer, frame);
                return;
            case 'addSegment':
            case 'deleteSegment':
            case 'moveSegment':
                this.onCommand(peer, frame);
                return;
            case 'updatePresence':
                this.onPresence(peer, frame);
                return;
        }
    }

    /*
     * Internals
     */

    private onPush(
        peer: FakeCollabPeer,
        frame: Extract<CollabClientFrame, { type: 'pushUpdates' }>
    ): void {
        const index = this.docs.findIndex((d) => d.docId === frame.docId);
        const doc = this.docs[index];
        const reject = (
            code: Extract<CollabServerFrame, { type: 'pushRejected' }>['code']
        ) => {
            const rejection: CollabServerFrame = {
                type: 'pushRejected',
                requestId: frame.requestId,
                docId: frame.docId,
                code,
                ...(doc ? { serverVersion: doc.updates.length } : {}),
            };
            this.rejections.push(rejection);
            peer.send(rejection);
        };
        if (!doc || !doc.subscribers.has(peer.connectionId)) {
            reject('unknownDocument');
            return;
        }
        if (this.locked) {
            reject('locked');
            return;
        }
        if (frame.version !== doc.updates.length) {
            reject('versionConflict');
            return;
        }
        if (frame.updates.length > (this.options.maxUpdatesPerPush ?? 100)) {
            reject('tooLarge');
            return;
        }
        let text = doc.text;
        const parsed: { clientID: string; changes: ChangeSet }[] = [];
        try {
            for (const update of frame.updates) {
                if (update.clientID === 'server') {
                    throw new Error('reserved clientID');
                }
                const changes = ChangeSet.fromJSON(update.changes);
                if (changes.length !== text.length) {
                    throw new Error('length mismatch');
                }
                text = changes.apply(text);
                parsed.push({ clientID: update.clientID, changes });
            }
        } catch {
            reject('invalidChanges');
            return;
        }
        const fromVersion = doc.updates.length;
        doc.updates.push(...parsed);
        doc.text = text;
        const outgoing = frame.updates.map((u) => ({
            clientID: u.clientID,
            changes: u.changes,
        }));
        for (const connectionId of doc.subscribers) {
            this.peers.get(connectionId)?.send({
                type: 'documentUpdates',
                docId: doc.docId,
                segmentId: index + 1,
                fromVersion,
                updates: outgoing,
            });
        }
        peer.send({
            type: 'pushAccepted',
            requestId: frame.requestId,
            docId: doc.docId,
            version: doc.updates.length,
        });
    }

    private onCommand(
        peer: FakeCollabPeer,
        frame: Extract<
            CollabClientFrame,
            { type: 'addSegment' | 'deleteSegment' | 'moveSegment' }
        >
    ): void {
        const reject = (
            code: Extract<
                CollabServerFrame,
                { type: 'commandRejected' }
            >['code']
        ) => {
            const rejection: CollabServerFrame = {
                type: 'commandRejected',
                requestId: frame.requestId,
                code,
                structureVersion: this.structureVersion,
            };
            this.rejections.push(rejection);
            peer.send(rejection);
        };
        if (this.locked) {
            reject('locked');
            return;
        }
        if (frame.structureVersion !== this.structureVersion) {
            reject('structureConflict');
            return;
        }
        const n = this.docs.length;
        let changed: Omit<
            Extract<CollabServerFrame, { type: 'segmentsChanged' }>,
            'type' | 'structureVersion' | 'segments' | 'requestId'
        >;
        if (frame.type === 'addSegment') {
            if (frame.position < 1 || frame.position > n + 1) {
                reject('invalidPosition');
                return;
            }
            const text = frame.text ?? '';
            this.docs.splice(
                frame.position - 1,
                0,
                this.newDoc(frame.segmentType, text)
            );
            changed = {
                kind: 'add',
                connectionId: peer.connectionId,
                segmentId: frame.position,
                segment: {
                    id: frame.position,
                    type: frame.segmentType,
                    parameters: { visible: true },
                    text,
                },
            };
        } else if (frame.type === 'deleteSegment') {
            if (frame.segmentId < 1 || frame.segmentId > n) {
                reject('segmentNotFound');
                return;
            }
            const [removed] = this.docs.splice(frame.segmentId - 1, 1);
            for (const [connectionId, docId] of this.presenceDoc) {
                if (docId === removed.docId) {
                    this.presenceDoc.delete(connectionId);
                }
            }
            changed = {
                kind: 'delete',
                connectionId: peer.connectionId,
                segmentId: frame.segmentId,
            };
        } else {
            if (frame.segmentId < 1 || frame.segmentId > n) {
                reject('segmentNotFound');
                return;
            }
            if (frame.toSegmentId < 1 || frame.toSegmentId > n) {
                reject('invalidPosition');
                return;
            }
            const [moved] = this.docs.splice(frame.segmentId - 1, 1);
            this.docs.splice(frame.toSegmentId - 1, 0, moved);
            changed = {
                kind: 'move',
                connectionId: peer.connectionId,
                segmentId: frame.segmentId,
                toSegmentId: frame.toSegmentId,
            };
        }
        this.structureVersion += 1;
        for (const other of this.peers.values()) {
            other.send({
                type: 'segmentsChanged',
                structureVersion: this.structureVersion,
                segments: this.segmentRefs(),
                ...changed,
                ...(other === peer ? { requestId: frame.requestId } : {}),
            });
        }
        peer.send({
            type: 'commandAccepted',
            requestId: frame.requestId,
            structureVersion: this.structureVersion,
        });
    }

    private onPresence(
        peer: FakeCollabPeer,
        frame: Extract<CollabClientFrame, { type: 'updatePresence' }>
    ): void {
        const previous = this.presenceDoc.get(peer.connectionId);
        if (frame.selection && previous && previous !== frame.docId) {
            this.sendPresence(peer, previous, undefined, undefined);
        }
        if (frame.selection) {
            this.presenceDoc.set(peer.connectionId, frame.docId);
        } else {
            this.presenceDoc.delete(peer.connectionId);
        }
        this.sendPresence(peer, frame.docId, frame.selection, frame.version);
    }

    private sendPresence(
        peer: FakeCollabPeer,
        docId: string,
        selection: { anchor: number; head: number } | undefined,
        version: number | undefined
    ): void {
        const index = this.docs.findIndex((d) => d.docId === docId);
        const doc = this.docs[index];
        if (!doc) {
            return;
        }
        for (const connectionId of doc.subscribers) {
            if (connectionId === peer.connectionId) {
                continue;
            }
            this.peers.get(connectionId)?.send({
                type: 'presenceChanged',
                docId,
                segmentId: index + 1,
                connectionId: peer.connectionId,
                userId: peer.userId,
                displayName: peer.displayName,
                color: peer.color,
                ...(selection ? { selection, version } : {}),
            });
        }
    }

    private clearPresence(peer: FakeCollabPeer): void {
        const docId = this.presenceDoc.get(peer.connectionId);
        this.presenceDoc.delete(peer.connectionId);
        if (docId) {
            this.sendPresence(peer, docId, undefined, undefined);
        }
    }

    private broadcastParticipants(
        kind: 'joined' | 'left',
        subject: FakeCollabPeer,
        except?: string
    ): void {
        const participants = this.participants();
        for (const peer of this.peers.values()) {
            if (peer.connectionId === except) {
                continue;
            }
            peer.send({
                type: 'participantsChanged',
                kind,
                connectionId: subject.connectionId,
                userId: subject.userId,
                participants,
            });
        }
    }

    private participants(): CollabParticipant[] {
        const byUser = new Map<number, CollabParticipant>();
        for (const peer of this.peers.values()) {
            const entry = byUser.get(peer.userId);
            if (entry) {
                entry.connectionIds.push(peer.connectionId);
            } else {
                byUser.set(peer.userId, {
                    userId: peer.userId,
                    displayName: peer.displayName,
                    color: peer.color,
                    connectionIds: [peer.connectionId],
                });
            }
        }
        return [...byUser.values()];
    }

    private segmentRefs(): CollabSegmentRef[] {
        return this.docs.map((doc, index) => ({
            segmentId: index + 1,
            segmentType: doc.segmentType,
            docId: doc.docId,
        }));
    }

    private updatesFrom(doc: FakeDoc, version: number): CollabUpdate[] {
        return doc.updates.slice(version).map((update) => ({
            clientID: update.clientID,
            changes: update.changes.toJSON(),
        }));
    }

    private newDoc(segmentType: CollabSegmentType, text: string): FakeDoc {
        this.docCounter += 1;
        const suffix = String(this.docCounter).padStart(12, '0');
        return {
            docId: `5b0f7a9e-3c1d-4c63-9a8c-${suffix}`,
            segmentType,
            text: Text.of(text.split(/\r\n?|\n/)),
            updates: [],
            subscribers: new Set(),
        };
    }
}
