import { ChangeSet } from '@codemirror/state';
import {
    CollabDocumentClient,
    diffTexts,
} from '../../../viewModel/domain/collab/CollabDocumentClient.ts';
import type { CollabClientFrame } from '../../../model/rpi/collabSocket.ts';
import { FakeCollabAuthority } from '../../collab/fakeCollabAuthority.ts';
import { seededRandom, TestDocPeer, TestNetwork } from './collabTestNetwork.ts';

function setup(text: string, seed = 1) {
    const authority = new FakeCollabAuthority({
        segments: [{ type: 'md', text }],
    });
    const net = new TestNetwork(authority, seededRandom(seed));
    const alice = new TestDocPeer(net, 'alice', 1, '#e8590c');
    const bob = new TestDocPeer(net, 'bob', 2, '#1971c2');
    alice.connect();
    bob.connect();
    net.flush();
    return { authority, net, alice, bob };
}

/** One random local edit: insert a short string or delete a short range */
function randomEdit(peer: TestDocPeer, random: () => number): void {
    const length = peer.client!.doc.length;
    if (length > 0 && random() < 0.35) {
        const from = Math.floor(random() * length);
        const to = Math.min(length, from + 1 + Math.floor(random() * 3));
        peer.remove(from, to);
        return;
    }
    const pos = Math.floor(random() * (length + 1));
    const alphabet = 'abcxyz \n';
    let text = '';
    const count = 1 + Math.floor(random() * 3);
    for (let i = 0; i < count; i++) {
        text += alphabet[Math.floor(random() * alphabet.length)];
    }
    peer.insert(pos, text);
}

describe('diffTexts', () => {
    test('finds the single changed range', () => {
        expect(diffTexts('hello world', 'hello brave world')).toEqual({
            from: 6,
            to: 6,
            insert: 'brave ',
        });
        expect(diffTexts('abcdef', 'abef')).toEqual({
            from: 2,
            to: 4,
            insert: '',
        });
        expect(diffTexts('same', 'same')).toBeNull();
    });
});

describe('CollabDocumentClient', () => {
    test('opens the document with the server text and version', () => {
        const { alice, bob, authority } = setup('first\nsecond');
        expect(alice.text).toBe('first\nsecond');
        expect(bob.text).toBe('first\nsecond');
        expect(alice.client!.version).toBe(0);
        expect(authority.version(1)).toBe(0);
    });

    test('own updates are confirmed by the server echo', () => {
        const { alice, bob, net, authority } = setup('abc');
        alice.insert(3, 'd');
        expect(alice.client!.unconfirmedCount).toBe(1);
        net.flush();
        expect(alice.client!.unconfirmedCount).toBe(0);
        expect(alice.client!.version).toBe(1);
        expect(bob.text).toBe('abcd');
        expect(authority.text(1)).toBe('abcd');
    });

    test('keeps one push in flight and batches the rest', () => {
        const { alice, net, authority } = setup('');
        alice.insert(0, 'a');
        alice.insert(1, 'b');
        alice.insert(2, 'c');
        const pushes = () =>
            authority.log.filter((entry) => entry.frame.type === 'pushUpdates');
        net.flush();
        // the first keystroke goes alone, the other two follow together after its echo
        expect(pushes()).toHaveLength(2);
        expect(
            (
                pushes()[1].frame as Extract<
                    CollabClientFrame,
                    { type: 'pushUpdates' }
                >
            ).updates
        ).toHaveLength(2);
        expect(authority.text(1)).toBe('abc');
    });

    test('concurrent edits of two clients converge (randomized interleavings)', () => {
        for (let seed = 1; seed <= 60; seed++) {
            const random = seededRandom(seed * 7919);
            const { alice, bob, net, authority } = setup('The quick fox', seed);
            for (let round = 0; round < 25; round++) {
                randomEdit(alice, random);
                randomEdit(bob, random);
                // deliver only part of the traffic so edits overlap with pushes in flight
                const steps = Math.floor(random() * 6);
                for (let i = 0; i < steps; i++) {
                    net.step();
                }
            }
            net.flush();
            expect(alice.text).toBe(authority.text(1));
            expect(bob.text).toBe(authority.text(1));
            expect(alice.client!.unconfirmedCount).toBe(0);
            expect(bob.client!.unconfirmedCount).toBe(0);
        }
    });

    test('versionConflict: the losing push waits for the updates and is retried', () => {
        const { alice, bob, net, authority } = setup('0123456789');
        alice.insert(0, 'A');
        bob.insert(10, 'B');
        // both pushes reach the server before any answer reaches the clients
        const upAlice = net.up.get(alice.connectionId)!;
        const upBob = net.up.get(bob.connectionId)!;
        authority.receive(alice.connectionId, upAlice.shift()!);
        authority.receive(bob.connectionId, upBob.shift()!);
        expect(
            authority.rejections.filter(
                (frame) =>
                    frame.type === 'pushRejected' &&
                    frame.code === 'versionConflict'
            )
        ).toHaveLength(1);
        net.flush();
        expect(authority.text(1)).toBe('A0123456789B');
        expect(alice.text).toBe('A0123456789B');
        expect(bob.text).toBe('A0123456789B');
        expect(authority.version(1)).toBe(2);
    });

    test('disconnect and resume with pending changes, including an update accepted before the drop', () => {
        const { alice, bob, net, authority } = setup('hello');
        alice.insert(5, ' world');
        // the push reaches the server, but its echo and pushAccepted are lost with the socket
        const up = net.up.get(alice.connectionId)!;
        authority.receive(alice.connectionId, up.shift()!);
        expect(authority.text(1)).toBe('hello world');
        alice.disconnect();
        // offline edits on both sides
        alice.insert(0, '>> ');
        bob.insert(0, 'B:');
        net.flush();
        expect(alice.client!.unconfirmedCount).toBe(2);

        alice.connect();
        net.flush();
        // the accepted update came back in documentResumed and was confirmed, not duplicated
        // both inserted at 0; bob was accepted first, so the order of the prefixes is the server's
        expect(authority.text(1)).toBe('B:>> hello world');
        expect(alice.text).toBe(authority.text(1));
        expect(bob.text).toBe(authority.text(1));
        expect(alice.client!.unconfirmedCount).toBe(0);
        expect(authority.text(1).match(/world/g)).toHaveLength(1);
    });

    test('resume from a trimmed history reloads the document', () => {
        const authority = new FakeCollabAuthority({
            segments: [{ type: 'md', text: 'x' }],
            historyStart: 5,
        });
        const net = new TestNetwork(authority, seededRandom(3));
        const alice = new TestDocPeer(net, 'alice', 1);
        alice.connect();
        net.flush();
        alice.disconnect();
        alice.connect();
        net.flush();
        expect(alice.problems).toContain('reloadRequired:historyTrimmed');
        expect(alice.text).toBe('x');
    });

    test('a gap in documentUpdates triggers pullUpdates', () => {
        const { alice, bob, net, authority } = setup('abc');
        bob.insert(0, '1');
        net.flush();
        bob.insert(0, '2');
        // lose the update frame for alice
        authority.receive(
            bob.connectionId,
            net.up.get(bob.connectionId)!.shift()!
        );
        net.down.get(alice.connectionId)!.length = 0;
        bob.insert(0, '3');
        net.flush();
        expect(
            authority.log.some(
                (entry) =>
                    entry.connectionId === alice.connectionId &&
                    entry.frame.type === 'pullUpdates'
            )
        ).toBe(true);
        expect(alice.text).toBe(authority.text(1));
        expect(alice.text).toBe('321abc');
    });

    test('locked: pushes wait for projectLockChanged(false)', () => {
        const { alice, bob, net, authority } = setup('abc');
        authority.setLocked(true);
        net.flush();
        alice.insert(0, 'X');
        net.flush();
        expect(authority.text(1)).toBe('abc');
        expect(alice.client!.unconfirmedCount).toBe(1);
        authority.setLocked(false);
        net.flush();
        expect(authority.text(1)).toBe('Xabc');
        expect(bob.text).toBe('Xabc');
    });

    test('remote cursors are mapped through local and remote changes', () => {
        const { alice, bob, net } = setup('0123456789');
        // bob puts his caret after "5"
        net.send(bob.connectionId, {
            type: 'updatePresence',
            docId: bob.client!.docId,
            version: bob.client!.version,
            selection: { anchor: 6, head: 6 },
        });
        net.flush();
        const cursorOf = () => alice.client!.remoteCursors()[0];
        expect(cursorOf()).toMatchObject({
            connectionId: bob.connectionId,
            displayName: 'bob',
            color: '#1971c2',
            head: 6,
        });
        // alice types before it: the caret moves with the text
        alice.insert(0, 'AB');
        expect(cursorOf().head).toBe(8);
        // a remote insert after it does not move it
        bob.insert(10, 'Z');
        net.flush();
        expect(cursorOf().head).toBe(8);
        // a remote delete before it pulls it back
        bob.remove(0, 1);
        net.flush();
        expect(cursorOf().head).toBe(7);
        expect(alice.text.slice(cursorOf().head - 1, cursorOf().head)).toBe(
            '5'
        );
    });

    test('a selection is kept as a range and removed when the peer leaves the document', () => {
        const { alice, bob, net } = setup('hello world');
        net.send(bob.connectionId, {
            type: 'updatePresence',
            docId: bob.client!.docId,
            version: 0,
            selection: { anchor: 6, head: 11 },
        });
        net.flush();
        expect(alice.client!.remoteCursors()[0]).toMatchObject({
            anchor: 6,
            head: 11,
        });
        net.send(bob.connectionId, {
            type: 'updatePresence',
            docId: bob.client!.docId,
            version: 0,
        });
        net.flush();
        expect(alice.client!.remoteCursors()).toHaveLength(0);
    });

    test('presence from a version ahead of ours stays frozen and clamped', () => {
        const client = new CollabDocumentClient(
            { docId: 'd', segmentId: 1, version: 3, text: 'abc' },
            {
                send: () => true,
                nextRequestId: (p) => p,
                isLive: () => false,
                maxUpdatesPerPush: () => 100,
                log: () => {},
            }
        );
        client.setRemotePresence({
            type: 'presenceChanged',
            docId: 'd',
            segmentId: 1,
            connectionId: 'c-1',
            userId: 2,
            displayName: 'bob',
            color: '#1971c2',
            version: 9,
            selection: { anchor: 50, head: 50 },
        });
        expect(client.remoteCursors()[0]).toMatchObject({
            head: 3,
            frozen: true,
        });
        client.applyLocalChanges(ChangeSet.of({ from: 0, insert: 'xx' }, 3));
        expect(client.remoteCursors()[0].head).toBe(3);
    });

    test('rejects local changes made against another text', () => {
        const client = new CollabDocumentClient(
            { docId: 'd', segmentId: 1, version: 0, text: 'abc' },
            {
                send: () => true,
                nextRequestId: (p) => p,
                isLive: () => false,
                maxUpdatesPerPush: () => 100,
                log: () => {},
            }
        );
        const other = ChangeSet.of({ from: 0, insert: 'x' }, 5);
        expect(client.applyLocalChanges(other)).toBe(false);
        expect(client.setLocalText('abcd')).toBe(true);
        expect(client.text).toBe('abcd');
        expect(client.unconfirmedCount).toBe(1);
    });
});
