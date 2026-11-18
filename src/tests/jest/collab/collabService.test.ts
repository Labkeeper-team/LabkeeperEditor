import { ChangeSet, Text } from '@codemirror/state';
import {
    mockViewModelState,
    MockViewModelRepository,
} from '../../../viewModel/repository';
import { mockRpi, Rpi } from '../../../model/rpi';
import { mockObserver } from '../../../model/service/ObserverService.ts';
import { setupContext } from '../../../viewModel/context.ts';
import { mockAgentSocket, PROJECT_ID } from '../common.ts';
import type {
    CollabConnection,
    CollabSocket,
} from '../../../model/rpi/collabSocket.ts';
import { FakeCollabAuthority } from '../../collab/fakeCollabAuthority.ts';
import { seededRandom, TestNetwork } from './collabTestNetwork.ts';
import { inMemoryCollabRepository } from '../../../viewModel/domain/collab/collabRepository.ts';
import type { Program } from '../../../model/domain.ts';
import {
    participantLimitOf,
    type CollabViewSink,
} from '../../../viewModel/domain/collab/CollabService.ts';
import type { RemoteCursor } from '../../../viewModel/domain/collab/CollabDocumentClient.ts';

const OWNER_ID = 1;
const GUEST_ID = 2;

global.structuredClone = (val) =>
    val === undefined ? undefined : JSON.parse(JSON.stringify(val));

function program(texts: string[]): Program {
    return {
        segments: texts.map((text, index) => ({
            id: index + 1,
            type: 'md',
            parameters: { visible: true },
            text,
        })),
        parameters: { roundStrategy: 'threeDigits' },
    };
}

/** CollabSocket over the test network: connect opens a connection to the authority */
function testSocket(
    net: TestNetwork,
    user: { userId: number; displayName: string; color: string }
): CollabSocket & { drop: () => void; reconnect: () => void } {
    let counter = 0;
    let connectionId = '';
    let handlers: Parameters<CollabSocket['connect']>[1] | null = null;
    const open = () => {
        counter += 1;
        connectionId = `${user.displayName}-${counter}`;
        handlers!.onOpen();
        net.open(
            connectionId,
            user,
            (frame) => handlers?.onFrame(frame),
            (code) =>
                handlers?.onClose(
                    code === 1008 ? 'denied' : 'closed',
                    code !== 1008
                )
        );
    };
    return {
        connect: (_projectId, h): CollabConnection => {
            handlers = h;
            open();
            return {
                send: (frame) => net.send(connectionId, frame),
                isOpen: () => net.isOpen(connectionId),
                close: () => net.close(connectionId),
            };
        },
        drop: () => {
            net.close(connectionId);
            handlers?.onClose('closed', true);
        },
        reconnect: () => open(),
    };
}

/** A fake mounted view: keeps a Text like CodeMirror would and records carets */
function fakeView(
    service: NonNullable<ReturnType<typeof setupContext>['collabService']>,
    index: number,
    initial: string
) {
    const view = {
        doc: Text.of(initial.split('\n')),
        cursors: [] as RemoteCursor[],
        key: service.keyAt(index)!,
    };
    const sink: CollabViewSink = {
        key: () => view.key,
        applyRemote: (change, cursors) => {
            view.doc = view.doc.eq(change.before)
                ? change.changes.apply(view.doc)
                : change.after;
            view.cursors = cursors;
        },
        setCursors: (cursors, doc) => {
            if (view.doc.eq(doc)) {
                view.cursors = cursors;
            }
        },
        selection: () => null,
    };
    service.attachView(sink);
    return {
        view,
        /** Typing in the view: forwarded like the view plugin, then onChange like the editor */
        type: async (
            ctx: ReturnType<typeof makeUser>['ctx'],
            pos: number,
            text: string
        ) => {
            const changes = ChangeSet.of(
                { from: pos, insert: text },
                view.doc.length
            );
            const start = view.doc;
            view.doc = changes.apply(view.doc);
            service.forwardViewChanges(view.key, index, changes, start);
            await ctx.programEditorService.onSegmentTextEdited(
                index,
                view.doc.toString()
            );
        },
    };
}

function makeUser(
    net: TestNetwork,
    user: { userId: number; displayName: string; color: string },
    initial: Program
) {
    const mvs: MockViewModelRepository = mockViewModelState();
    const rpi: Rpi = mockRpi();
    rpi.getProjectRequest = jest.fn().mockImplementation(async () => ({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            projectId: PROJECT_ID,
            userId: OWNER_ID,
            title: 't',
            lastModified: '',
            isPublic: true,
            projectType: 'markdown',
            program: program(net.authority.texts()),
        },
    }));
    rpi.saveProgramRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {},
    });
    const socket = testSocket(net, user);
    const collabRepository = inMemoryCollabRepository();
    const ctx = setupContext(
        rpi,
        mvs,
        mockObserver(),
        mockAgentSocket().socket,
        {
            socket,
            repository: collabRepository,
        }
    );
    mvs.userViewModelRepository.setUserInfo({
        isAuthenticated: true,
        email: `${user.displayName}@example.com`,
        id: user.userId,
        privacyPolicyAccepted: true,
        crossBorderDataTransferPolicyAccepted: true,
        tokenBalance: 0,
    });
    mvs.projectViewModelRepository.setProject({
        projectId: PROJECT_ID,
        userId: OWNER_ID,
        title: 't',
        lastModified: '',
        program: initial,
        isPublic: true,
        projectType: 'markdown',
    });
    mvs.projectViewModelRepository.setReadOnly(user.userId !== OWNER_ID);
    ctx.programService.setNewProgram(initial);
    mvs.projectViewModelRepository.setCurrentProgram(initial);
    return { ctx, mvs, rpi, socket, collabRepository };
}

function setup(texts: string[], seed = 5, maxParticipants?: number) {
    const authority = new FakeCollabAuthority({
        segments: texts.map((text) => ({ type: 'md', text })),
        maxParticipants,
    });
    const net = new TestNetwork(authority, seededRandom(seed));
    const owner = makeUser(
        net,
        { userId: OWNER_ID, displayName: 'alice', color: '#e8590c' },
        program(texts)
    );
    const guest = makeUser(
        net,
        { userId: GUEST_ID, displayName: 'bob', color: '#1971c2' },
        program(texts)
    );
    owner.ctx.collabService!.start(PROJECT_ID);
    guest.ctx.collabService!.start(PROJECT_ID);
    net.flush();
    return { authority, net, owner, guest };
}

const reduxTexts = (user: ReturnType<typeof makeUser>) =>
    user.mvs
        .mockState()
        .currentProgram.segments.map(
            (segment: { text: string }) => segment.text
        );
const modelTexts = (user: ReturnType<typeof makeUser>) =>
    user.ctx.programService
        .getCurrentProgram()
        .segments.map((segment) => segment.text);

describe('CollabService', () => {
    test('a user over the participant limit is refused and edits without collaboration', () => {
        const { owner, net } = setup(['one'], 5, 2);
        expect(owner.collabRepository.current.maxParticipants).toBe(2);
        const carol = makeUser(
            net,
            { userId: 3, displayName: 'carol', color: '#2f9e44' },
            program(['one'])
        );
        carol.ctx.collabService!.start(PROJECT_ID);
        net.flush();
        expect(carol.collabRepository.current.participantLimit).toBe(2);
        expect(carol.collabRepository.current.status).toBe('denied');
        expect(carol.ctx.collabService!.isActive()).toBe(false);
        // the participant list of the others did not change
        expect(owner.collabRepository.current.participants).toHaveLength(2);

        // another tab of a user who is already connected is accepted
        const ownerTab = makeUser(
            net,
            { userId: 1, displayName: 'alice', color: '#e8590c' },
            program(['one'])
        );
        ownerTab.ctx.collabService!.start(PROJECT_ID);
        net.flush();
        expect(ownerTab.collabRepository.current.status).toBe('live');
        expect(ownerTab.collabRepository.current.participantLimit).toBeNull();
    });

    test('the limit number is read from the message, with 5 as default', () => {
        expect(
            participantLimitOf(
                'At most 3 people can edit this project at the same time'
            )
        ).toBe(3);
        expect(participantLimitOf(undefined)).toBe(5);
        expect(participantLimitOf('too many')).toBe(5);
    });

    test('welcome opens every segment and both users see each other', () => {
        const { owner, guest } = setup(['one', 'two']);
        expect(owner.collabRepository.current.status).toBe('live');
        expect(owner.collabRepository.current.readySegments).toEqual([
            true,
            true,
        ]);
        expect(
            guest.collabRepository.current.participants.map(
                (p) => p.displayName
            )
        ).toEqual(['alice', 'bob']);
        expect(guest.collabRepository.current.canWrite).toBe(true);
    });

    test('a guest of a public project edits a segment; the owner gets it in model and Redux', async () => {
        const { owner, guest, net, authority } = setup(['hello', 'second']);
        const ownerView = fakeView(owner.ctx.collabService!, 0, 'hello');
        const guestView = fakeView(guest.ctx.collabService!, 0, 'hello');
        await guestView.type(guest.ctx, 5, ' world');
        net.flush();
        expect(authority.text(1)).toBe('hello world');
        expect(modelTexts(owner)).toEqual(['hello world', 'second']);
        expect(reduxTexts(owner)[0]).toBe('hello world');
        expect(ownerView.view.doc.toString()).toBe('hello world');
        // non-owners never save over REST (it would answer 403)
        await guest.ctx.programEditorService.onProgramSaveTimeout();
        expect(guest.rpi.saveProgramRequest).not.toHaveBeenCalled();
    });

    test('concurrent typing of both users converges in every model', async () => {
        const { owner, guest, net, authority } = setup(['abcdef']);
        const ownerView = fakeView(owner.ctx.collabService!, 0, 'abcdef');
        const guestView = fakeView(guest.ctx.collabService!, 0, 'abcdef');
        const random = seededRandom(42);
        for (let i = 0; i < 40; i++) {
            await ownerView.type(
                owner.ctx,
                Math.floor(random() * (ownerView.view.doc.length + 1)),
                'o'
            );
            await guestView.type(
                guest.ctx,
                Math.floor(random() * (guestView.view.doc.length + 1)),
                'g'
            );
            for (let s = Math.floor(random() * 4); s > 0; s--) {
                net.step();
            }
        }
        net.flush();
        const final = authority.text(1);
        expect(final).toHaveLength(6 + 80);
        expect(modelTexts(owner)).toEqual([final]);
        expect(modelTexts(guest)).toEqual([final]);
        expect(ownerView.view.doc.toString()).toBe(final);
        expect(guestView.view.doc.toString()).toBe(final);
    });

    test('segment add, move and delete are applied only when segmentsChanged arrives', () => {
        const { owner, guest, net, authority } = setup(['a', 'b']);
        owner.ctx.programEditorService.onAddSegmentClicked('md');
        // nothing applied optimistically
        expect(modelTexts(owner)).toEqual(['a', 'b']);
        net.flush();
        expect(authority.segmentCount()).toBe(3);
        expect(modelTexts(owner)).toEqual(['a', 'b', '']);
        expect(modelTexts(guest)).toEqual(['a', 'b', '']);
        expect(guest.collabRepository.current.readySegments).toEqual([
            true,
            true,
            true,
        ]);

        void guest.ctx.programEditorService.segmentEditorChangeSegmentPosition(
            'up',
            1
        );
        net.flush();
        expect(modelTexts(owner)).toEqual(['b', 'a', '']);
        expect(modelTexts(guest)).toEqual(['b', 'a', '']);

        void guest.ctx.programEditorService.deleteSegment(0);
        net.flush();
        expect(authority.texts()).toEqual(['a', '']);
        expect(modelTexts(owner)).toEqual(['a', '']);
        expect(modelTexts(guest)).toEqual(['a', '']);
    });

    test('text edits keep going to the right document after the segment moved', async () => {
        const { owner, guest, net, authority } = setup(['first', 'second']);
        const guestSecond = fakeView(guest.ctx.collabService!, 1, 'second');
        void owner.ctx.programEditorService.segmentEditorChangeSegmentPosition(
            'up',
            1
        );
        net.flush();
        expect(modelTexts(guest)).toEqual(['second', 'first']);
        // the same view (same key) is now at index 0
        await guestSecond.type(guest.ctx, 6, '!');
        net.flush();
        expect(authority.texts()).toEqual(['second!', 'first']);
        expect(modelTexts(owner)).toEqual(['second!', 'first']);
    });

    test('a structure conflict is retried against the new list', () => {
        const { owner, guest, net, authority } = setup(['a', 'b', 'c']);
        // both delete at once: guest deletes "c" while owner deletes "a"
        void owner.ctx.programEditorService.deleteSegment(0);
        void guest.ctx.programEditorService.deleteSegment(2);
        net.flush();
        expect(
            authority.rejections.some(
                (frame) =>
                    frame.type === 'commandRejected' &&
                    frame.code === 'structureConflict'
            )
        ).toBe(true);
        expect(authority.texts()).toEqual(['b']);
        expect(modelTexts(owner)).toEqual(['b']);
        expect(modelTexts(guest)).toEqual(['b']);
    });

    test('offline edits are pushed after the reconnect and the owner REST save waits for it', async () => {
        const { owner, guest, net, authority } = setup(['text']);
        const ownerView = fakeView(owner.ctx.collabService!, 0, 'text');
        owner.socket.drop();
        expect(owner.collabRepository.current.status).toBe('reconnecting');
        await ownerView.type(owner.ctx, 4, ' offline');
        net.flush();
        (owner.rpi.saveProgramRequest as jest.Mock).mockClear();
        await owner.ctx.programEditorService.onProgramSaveTimeout();
        expect(owner.rpi.saveProgramRequest).not.toHaveBeenCalled();

        owner.socket.reconnect();
        net.flush();
        expect(authority.text(1)).toBe('text offline');
        expect(modelTexts(guest)).toEqual(['text offline']);
        // the skipped save goes after the reconnect, with the structure version
        expect(owner.rpi.saveProgramRequest).toHaveBeenCalledWith(
            PROJECT_ID,
            expect.anything(),
            expect.any(Number)
        );
    });

    test('remote carets reach the view and disappear when the user leaves', () => {
        const { owner, guest, net } = setup(['0123456789']);
        const ownerView = fakeView(owner.ctx.collabService!, 0, '0123456789');
        const guestKey = guest.ctx.collabService!.keyAt(0)!;
        guest.ctx.collabService!.reportSelection(guestKey, {
            anchor: 4,
            head: 4,
        });
        net.flush();
        return Promise.resolve().then(() => {
            expect(ownerView.view.cursors).toEqual([
                expect.objectContaining({ displayName: 'bob', head: 4 }),
            ]);
            guest.ctx.collabService!.stop();
            net.flush();
            return Promise.resolve().then(() => {
                expect(ownerView.view.cursors).toEqual([]);
                expect(
                    owner.collabRepository.current.participants.map(
                        (p) => p.displayName
                    )
                ).toEqual(['alice']);
            });
        });
    });

    test('a REST reload while collaborating keeps the document texts', () => {
        const { owner, net } = setup(['live text']);
        net.flush();
        // e.g. the agent finished and the program is read again: stale text in the answer
        owner.ctx.ideService.setNewProgram(program(['stale text']));
        expect(modelTexts(owner)).toEqual(['live text']);
    });
});
