import { ChangeSet } from '@codemirror/state';
import type {
    CollabClientFrame,
    CollabServerFrame,
} from '../../../model/rpi/collabSocket.ts';
import { FakeCollabAuthority } from '../../collab/fakeCollabAuthority.ts';
import { CollabDocumentClient } from '../../../viewModel/domain/collab/CollabDocumentClient.ts';

/** Small deterministic PRNG (mulberry32) so failures can be replayed by seed */
export function seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Network between document clients and the fake authority. Every connection has an
 * up queue (client -> server) and a down queue (server -> client); per-queue order is
 * kept (as on a WebSocket), everything else interleaves at random.
 */
const CLOSE_MARK = '__serverClose';

export class TestNetwork {
    readonly up = new Map<string, CollabClientFrame[]>();
    readonly down = new Map<string, CollabServerFrame[]>();
    private handlers = new Map<string, (frame: CollabServerFrame) => void>();
    private closeHandlers = new Map<string, (code: number) => void>();

    constructor(
        readonly authority: FakeCollabAuthority,
        private random: () => number = Math.random
    ) {}

    open(
        connectionId: string,
        user: { userId: number; displayName: string; color: string },
        onFrame: (frame: CollabServerFrame) => void,
        onClose: (code: number) => void = () => {}
    ): void {
        this.up.set(connectionId, []);
        this.down.set(connectionId, []);
        this.handlers.set(connectionId, onFrame);
        this.closeHandlers.set(connectionId, onClose);
        this.authority.connect({
            connectionId,
            ...user,
            send: (frame) => this.down.get(connectionId)?.push(frame),
            // the close travels after the frames already queued, like on a socket
            close: (code) =>
                this.down.get(connectionId)?.push({
                    type: CLOSE_MARK,
                    code,
                } as unknown as CollabServerFrame),
        });
    }

    /** Drops the connection with every frame still in flight on it */
    close(connectionId: string): void {
        this.up.delete(connectionId);
        this.down.delete(connectionId);
        this.handlers.delete(connectionId);
        this.authority.disconnect(connectionId);
    }

    send(connectionId: string, frame: CollabClientFrame): boolean {
        const queue = this.up.get(connectionId);
        if (!queue) {
            return false;
        }
        // frames are copied like on a real wire
        queue.push(JSON.parse(JSON.stringify(frame)));
        return true;
    }

    isOpen(connectionId: string): boolean {
        return this.up.has(connectionId);
    }

    /** Delivers one frame from a random non-empty queue. false when all are empty */
    step(): boolean {
        const queues: { id: string; dir: 'up' | 'down' }[] = [];
        for (const [id, q] of this.up) {
            if (q.length) queues.push({ id, dir: 'up' });
        }
        for (const [id, q] of this.down) {
            if (q.length) queues.push({ id, dir: 'down' });
        }
        if (!queues.length) {
            return false;
        }
        const pick = queues[Math.floor(this.random() * queues.length)];
        if (pick.dir === 'up') {
            const frame = this.up.get(pick.id)!.shift()!;
            this.authority.receive(pick.id, frame);
        } else {
            const frame = this.down.get(pick.id)!.shift()!;
            const mark = frame as unknown as { type: string; code: number };
            if (mark.type === CLOSE_MARK) {
                const onClose = this.closeHandlers.get(pick.id);
                this.up.delete(pick.id);
                this.down.delete(pick.id);
                this.handlers.delete(pick.id);
                this.closeHandlers.delete(pick.id);
                onClose?.(mark.code);
                return true;
            }
            this.handlers.get(pick.id)?.(JSON.parse(JSON.stringify(frame)));
        }
        return true;
    }

    /** Delivers everything until the network is quiet */
    flush(maxSteps = 100_000): void {
        let steps = 0;
        while (this.step()) {
            steps += 1;
            if (steps > maxSteps) {
                throw new Error('network did not settle');
            }
        }
    }
}

/**
 * A minimal session around one CollabDocumentClient of segment 1: routes frames the way
 * CollabService does, reconnects with a new connection id and resumes.
 */
export class TestDocPeer {
    client: CollabDocumentClient | null = null;
    connectionId = '';
    private welcomed = false;
    private counter = 0;
    private generation = 0;
    readonly problems: string[] = [];

    constructor(
        private net: TestNetwork,
        readonly name: string,
        readonly userId: number,
        readonly color = '#1971c2'
    ) {}

    connect(): void {
        this.generation += 1;
        this.connectionId = `${this.name}-${this.generation}`;
        this.welcomed = false;
        this.net.open(
            this.connectionId,
            { userId: this.userId, displayName: this.name, color: this.color },
            (frame) => this.onFrame(frame)
        );
    }

    disconnect(): void {
        this.net.close(this.connectionId);
        this.welcomed = false;
        this.client?.onDisconnected();
    }

    get text(): string {
        return this.client?.text ?? '';
    }

    /** Inserts text at a position of the current document */
    insert(pos: number, text: string): void {
        const client = this.client!;
        client.applyLocalChanges(
            ChangeSet.of({ from: pos, insert: text }, client.doc.length)
        );
    }

    remove(from: number, to: number): void {
        const client = this.client!;
        client.applyLocalChanges(ChangeSet.of({ from, to }, client.doc.length));
    }

    private transport = {
        send: (frame: CollabClientFrame) =>
            this.welcomed && this.net.send(this.connectionId, frame),
        nextRequestId: (prefix: string) => `${prefix}-${++this.counter}`,
        isLive: () => this.welcomed && this.net.isOpen(this.connectionId),
        maxUpdatesPerPush: () => 100,
        log: () => {},
    };

    private onFrame(frame: CollabServerFrame): void {
        switch (frame.type) {
            case 'welcome':
                this.welcomed = true;
                if (this.client) {
                    this.client.resume();
                } else {
                    this.net.send(this.connectionId, {
                        type: 'openDocument',
                        requestId: `o-${++this.counter}`,
                        segmentId: 1,
                    });
                }
                return;
            case 'documentOpened':
                this.client?.dispose();
                this.client = new CollabDocumentClient(
                    {
                        docId: frame.docId,
                        segmentId: frame.segmentId ?? 1,
                        version: frame.version,
                        text: frame.text,
                    },
                    this.transport,
                    (problem) => {
                        this.problems.push(problem.kind);
                        if (problem.kind !== 'readOnly') {
                            this.net.send(this.connectionId, {
                                type: 'openDocument',
                                requestId: `o-${++this.counter}`,
                                segmentId: 1,
                            });
                        }
                    }
                );
                return;
            case 'documentResumed':
                this.client?.receiveResumed(
                    frame.requestId,
                    frame.fromVersion,
                    frame.updates
                );
                return;
            case 'documentUpdates':
                this.client?.receiveDocumentUpdates(
                    frame.fromVersion,
                    frame.updates,
                    frame.requestId
                );
                return;
            case 'pushAccepted':
                this.client?.onPushAccepted(frame.requestId, frame.version);
                return;
            case 'pushRejected':
                this.client?.onPushRejected(frame);
                return;
            case 'reloadRequired':
                this.problems.push(`reloadRequired:${frame.reason}`);
                this.client?.dispose();
                this.client = null;
                this.net.send(this.connectionId, {
                    type: 'openDocument',
                    requestId: `o-${++this.counter}`,
                    segmentId: 1,
                });
                return;
            case 'presenceChanged':
                this.client?.setRemotePresence(frame);
                return;
            case 'projectLockChanged':
                this.client?.setLocked(frame.locked);
                return;
            default:
                return;
        }
    }
}
