import { ChangeSet, Text } from '@codemirror/state';
import type {
    CollabClientFrame,
    CollabCommandRejectionCode,
    CollabFileChangeKind,
    CollabFileRef,
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
 * version; server-authoritative segment commands; presence and participants; the shared
 * file list with file commands (first command wins), text file documents and the collab
 * upload endpoint (`upload`).
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

interface FakeFile {
    path: string;
    text: boolean;
    /** Stored content; for a text file with a document the document text is newer */
    content: string;
    doc?: FakeDoc;
}

export interface FakeCollabAuthorityOptions {
    segments: { type: CollabSegmentType; text: string }[];
    /** User files of the project; `content` of binary files is any string */
    files?: { path: string; content?: string }[];
    /** Empty folders of the session */
    folders?: string[];
    maxUpdatesPerPush?: number;
    /** Updates older than this version are no longer kept (resume then reloads) */
    historyStart?: number;
    canWrite?: (userId: number) => boolean;
    /** Distinct users at once; the next one gets participantLimit and 1008 (default 5) */
    maxParticipants?: number;
    /** limits.maxFiles (default 100) */
    maxFiles?: number;
    /** A server of the protocol before file collaboration: welcome has no file list */
    withoutFiles?: boolean;
    /** Base of file URLs (default http://collab-files.test/) */
    fileUrlBase?: string;
}

/** Text file names of the channel description (case-insensitive) */
const TEXT_EXTENSIONS = new Set(
    (
        'txt text md markdown csv tsv json jsonl yaml yml xml html htm css scss js jsx ts tsx ' +
        'py r m tex ltx latex sty cls clo def ldf fd dtx ins tikz bib bst bbl aux log out toc ' +
        'lof lot idx ind ilg glo gls glg ist acn acr alg fls fdb_latexmk cfg bbx cbx lbx dbx dat'
    ).split(' ')
);

export function isCollabTextFileName(path: string): boolean {
    const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
    if (name === 'latexmkrc' || name === '.latexmkrc') {
        return true;
    }
    const dot = name.lastIndexOf('.');
    return dot > 0 && TEXT_EXTENSIONS.has(name.slice(dot + 1));
}

function isValidPath(path: unknown): path is string {
    return (
        typeof path === 'string' &&
        path.length > 0 &&
        path.length <= 200 &&
        !path.startsWith('/') &&
        !path.endsWith('/') &&
        !path.includes('..') &&
        !path.includes('//') &&
        // eslint-disable-next-line no-control-regex
        !/[\u0000-\u001f[\]<>"{}|\\^`]/.test(path)
    );
}

function remap(path: string, from: string, to: string): string | null {
    if (path === from) {
        return to;
    }
    if (path.startsWith(`${from}/`)) {
        return `${to}${path.slice(from.length)}`;
    }
    return null;
}

type FileCommandFrame = Extract<
    CollabClientFrame,
    {
        type:
            | 'createFile'
            | 'deleteFile'
            | 'renameFile'
            | 'createFolder'
            | 'deleteFolder'
            | 'renameFolder';
    }
>;

export class FakeCollabAuthority {
    private docs: FakeDoc[];
    private files = new Map<string, FakeFile>();
    private folders = new Set<string>();
    private filesVersion = 1000;
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
        for (const file of options.files ?? []) {
            this.files.set(file.path, {
                path: file.path,
                text: isCollabTextFileName(file.path),
                content: file.content ?? '',
            });
        }
        for (const folder of options.folders ?? []) {
            this.folders.add(folder);
        }
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

    filePaths(): string[] {
        return [...this.files.keys()].sort();
    }

    folderPaths(): string[] {
        return [...this.folders].sort();
    }

    /** Current content of a file: the document text for an opened text file */
    fileContent(path: string): string | undefined {
        const file = this.files.get(path);
        if (!file) {
            return undefined;
        }
        return file.doc ? file.doc.text.toString() : file.content;
    }

    fileDocId(path: string): string | undefined {
        return this.files.get(path)?.doc?.docId;
    }

    /** URL a file is served at (stable through uploads, like a storage object URL) */
    fileUrl(path: string): string {
        return `${this.options.fileUrlBase ?? 'http://collab-files.test/'}${path
            .split('/')
            .map(encodeURIComponent)
            .join('/')}`;
    }

    /** Path of a file URL, for a route that serves file contents */
    pathOfUrl(url: string): string | null {
        const base = this.options.fileUrlBase ?? 'http://collab-files.test/';
        if (!url.startsWith(base)) {
            return null;
        }
        const rest = url.slice(base.length).split('?')[0];
        return rest.split('/').map(decodeURIComponent).join('/');
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
                maxFiles: this.options.maxFiles ?? 100,
                maxFileBytes: 10 * 1024 * 1024,
            },
            presenceTimeoutSeconds: 60,
            ...(this.options.withoutFiles
                ? {}
                : {
                      filesVersion: this.filesVersion,
                      files: this.fileRefs(),
                      folders: this.folderPaths(),
                  }),
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
        for (const doc of this.allDocs()) {
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

    /**
     * `PUT /collab/file/upload`: creates or replaces a file as a participant. Returns the
     * HTTP status. A replaced text file with a document gets the new text from `server`.
     */
    upload(connectionId: string, path: string, content: string): number {
        const peer = this.peers.get(connectionId);
        if (!peer) {
            return 403;
        }
        if (this.locked) {
            return 423;
        }
        if (!isValidPath(path)) {
            return 400;
        }
        const existing = this.files.get(path);
        if (!existing && this.files.size >= (this.options.maxFiles ?? 100)) {
            return 409;
        }
        if (existing?.doc) {
            this.replaceDocText(existing, content);
        } else if (existing) {
            existing.content = content;
        } else {
            this.files.set(path, {
                path,
                text: isCollabTextFileName(path),
                content,
            });
            this.pruneFolders(path);
        }
        this.broadcastFiles('upload', peer, undefined, { path });
        return 201;
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
            case 'openDocument':
                this.onOpen(peer, frame);
                return;
            case 'resumeDocument': {
                const found = this.locate(frame.docId);
                const doc = found?.doc;
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
                        ...(found ? found.ref : {}),
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
                    ...found.ref,
                    fromVersion: frame.version,
                    version: doc.updates.length,
                    updates: this.updatesFrom(doc, frame.version),
                });
                return;
            }
            case 'closeDocument': {
                this.locate(frame.docId)?.doc.subscribers.delete(connectionId);
                return;
            }
            case 'pullUpdates': {
                const found = this.locate(frame.docId);
                if (!found) {
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
                    docId: found.doc.docId,
                    ...found.ref,
                    fromVersion: frame.version,
                    updates: this.updatesFrom(found.doc, frame.version),
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
            case 'createFile':
            case 'deleteFile':
            case 'renameFile':
            case 'createFolder':
            case 'deleteFolder':
            case 'renameFolder':
                this.onFileCommand(peer, frame);
                return;
            case 'updatePresence':
                this.onPresence(peer, frame);
                return;
        }
    }

    /*
     * Internals
     */

    private onOpen(
        peer: FakeCollabPeer,
        frame: Extract<CollabClientFrame, { type: 'openDocument' }>
    ): void {
        if ('filePath' in frame) {
            const file = this.files.get(frame.filePath);
            if (!file || !file.text) {
                peer.send({
                    type: 'collabError',
                    code: file ? 'notTextFile' : 'fileNotFound',
                    requestId: frame.requestId,
                });
                return;
            }
            if (!file.doc) {
                file.doc = this.newDoc('md', file.content);
            }
            file.doc.subscribers.add(peer.connectionId);
            peer.send({
                type: 'documentOpened',
                requestId: frame.requestId,
                docId: file.doc.docId,
                filePath: file.path,
                version: file.doc.updates.length,
                text: file.doc.text.toString(),
            });
            return;
        }
        const doc = this.docs[frame.segmentId - 1];
        if (!doc) {
            peer.send({
                type: 'collabError',
                code: 'segmentNotFound',
                requestId: frame.requestId,
            });
            return;
        }
        doc.subscribers.add(peer.connectionId);
        peer.send({
            type: 'documentOpened',
            requestId: frame.requestId,
            docId: doc.docId,
            segmentId: frame.segmentId,
            version: doc.updates.length,
            text: doc.text.toString(),
        });
    }

    private onPush(
        peer: FakeCollabPeer,
        frame: Extract<CollabClientFrame, { type: 'pushUpdates' }>
    ): void {
        const found = this.locate(frame.docId);
        const doc = found?.doc;
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
        if (!found || !doc || !doc.subscribers.has(peer.connectionId)) {
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
                ...found.ref,
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

    /** A path is taken by a file, an empty folder, or a folder that has files */
    private pathTaken(path: string): boolean {
        return (
            this.files.has(path) ||
            this.folders.has(path) ||
            this.folderHasFiles(path)
        );
    }

    private folderHasFiles(folder: string): boolean {
        return [...this.files.keys()].some((path) =>
            path.startsWith(`${folder}/`)
        );
    }

    private folderExists(folder: string): boolean {
        return (
            this.folders.has(folder) ||
            this.folderHasFiles(folder) ||
            [...this.folders].some((f) => f.startsWith(`${folder}/`))
        );
    }

    /** Folders that now have a file under them are not empty folders any more */
    private pruneFolders(path: string): void {
        for (const folder of [...this.folders]) {
            if (path.startsWith(`${folder}/`)) {
                this.folders.delete(folder);
            }
        }
    }

    private removeFileDoc(file: FakeFile): void {
        const doc = file.doc;
        if (!doc) {
            return;
        }
        for (const [connectionId, docId] of this.presenceDoc) {
            if (docId === doc.docId) {
                this.presenceDoc.delete(connectionId);
            }
        }
        doc.subscribers.clear();
    }

    private onFileCommand(peer: FakeCollabPeer, frame: FileCommandFrame): void {
        const reject = (code: CollabCommandRejectionCode) => {
            const rejection: CollabServerFrame = {
                type: 'commandRejected',
                requestId: frame.requestId,
                code,
                structureVersion: this.structureVersion,
                filesVersion: this.filesVersion,
            };
            this.rejections.push(rejection);
            peer.send(rejection);
        };
        if (this.locked) {
            reject('locked');
            return;
        }
        let kind: CollabFileChangeKind;
        let newPath: string | undefined;
        switch (frame.type) {
            case 'createFile': {
                if (
                    !isValidPath(frame.path) ||
                    !isCollabTextFileName(frame.path)
                ) {
                    reject('invalidFileName');
                    return;
                }
                if (this.pathTaken(frame.path)) {
                    reject('fileExists');
                    return;
                }
                if (this.files.size >= (this.options.maxFiles ?? 100)) {
                    reject('tooManyFiles');
                    return;
                }
                this.files.set(frame.path, {
                    path: frame.path,
                    text: true,
                    content: frame.text ?? '',
                });
                this.pruneFolders(frame.path);
                kind = 'create';
                break;
            }
            case 'deleteFile': {
                const file = this.files.get(frame.path);
                if (!file) {
                    reject('fileNotFound');
                    return;
                }
                this.removeFileDoc(file);
                this.files.delete(frame.path);
                kind = 'delete';
                break;
            }
            case 'renameFile': {
                const file = this.files.get(frame.path);
                if (!file) {
                    reject('fileNotFound');
                    return;
                }
                if (
                    !isValidPath(frame.newPath) ||
                    (file.doc && !isCollabTextFileName(frame.newPath))
                ) {
                    reject('invalidFileName');
                    return;
                }
                if (this.pathTaken(frame.newPath)) {
                    reject('fileExists');
                    return;
                }
                this.files.delete(frame.path);
                file.path = frame.newPath;
                file.text = file.doc
                    ? true
                    : isCollabTextFileName(frame.newPath);
                this.files.set(frame.newPath, file);
                this.pruneFolders(frame.newPath);
                kind = 'rename';
                newPath = frame.newPath;
                break;
            }
            case 'createFolder': {
                if (!isValidPath(frame.path)) {
                    reject('invalidFileName');
                    return;
                }
                if (
                    this.pathTaken(frame.path) ||
                    this.folderExists(frame.path)
                ) {
                    reject('fileExists');
                    return;
                }
                this.folders.add(frame.path);
                kind = 'createFolder';
                break;
            }
            case 'deleteFolder': {
                if (!this.folderExists(frame.path)) {
                    reject('fileNotFound');
                    return;
                }
                for (const [path, file] of [...this.files]) {
                    if (path.startsWith(`${frame.path}/`)) {
                        this.removeFileDoc(file);
                        this.files.delete(path);
                    }
                }
                for (const folder of [...this.folders]) {
                    if (remap(folder, frame.path, '') !== null) {
                        this.folders.delete(folder);
                    }
                }
                kind = 'deleteFolder';
                break;
            }
            case 'renameFolder': {
                if (!this.folderExists(frame.path)) {
                    reject('fileNotFound');
                    return;
                }
                if (
                    !isValidPath(frame.newPath) ||
                    remap(frame.newPath, frame.path, '') !== null
                ) {
                    reject('invalidFileName');
                    return;
                }
                if (
                    this.pathTaken(frame.newPath) ||
                    this.folderExists(frame.newPath)
                ) {
                    reject('fileExists');
                    return;
                }
                for (const [path, file] of [...this.files]) {
                    const moved = remap(path, frame.path, frame.newPath);
                    if (moved) {
                        this.files.delete(path);
                        file.path = moved;
                        this.files.set(moved, file);
                    }
                }
                for (const folder of [...this.folders]) {
                    const moved = remap(folder, frame.path, frame.newPath);
                    if (moved) {
                        this.folders.delete(folder);
                        this.folders.add(moved);
                    }
                }
                kind = 'renameFolder';
                newPath = frame.newPath;
                break;
            }
        }
        this.broadcastFiles(kind, peer, frame.requestId, {
            path: frame.path,
            newPath,
        });
        peer.send({
            type: 'commandAccepted',
            requestId: frame.requestId,
            structureVersion: this.structureVersion,
            filesVersion: this.filesVersion,
        });
    }

    private broadcastFiles(
        kind: CollabFileChangeKind,
        author: FakeCollabPeer,
        requestId: string | undefined,
        about: { path?: string; newPath?: string }
    ): void {
        this.filesVersion += 1;
        const files = this.fileRefs();
        const folders = this.folderPaths();
        for (const peer of this.peers.values()) {
            peer.send({
                type: 'filesChanged',
                filesVersion: this.filesVersion,
                kind,
                source: 'participant',
                connectionId: author.connectionId,
                userId: author.userId,
                ...(about.path !== undefined ? { path: about.path } : {}),
                ...(about.newPath !== undefined
                    ? { newPath: about.newPath }
                    : {}),
                ...(requestId && peer === author ? { requestId } : {}),
                files,
                folders,
            });
        }
    }

    /** The whole text replaced by the server (an upload over a text file with a document) */
    private replaceDocText(file: FakeFile, content: string): void {
        const doc = file.doc!;
        const next = Text.of(content.split(/\r\n?|\n/));
        const changes = ChangeSet.of(
            { from: 0, to: doc.text.length, insert: next },
            doc.text.length
        );
        const fromVersion = doc.updates.length;
        doc.updates.push({ clientID: 'server', changes });
        doc.text = next;
        for (const connectionId of doc.subscribers) {
            this.peers.get(connectionId)?.send({
                type: 'documentUpdates',
                docId: doc.docId,
                filePath: file.path,
                fromVersion,
                updates: [{ clientID: 'server', changes: changes.toJSON() }],
            });
        }
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
        const found = this.locate(docId);
        if (!found) {
            return;
        }
        for (const connectionId of found.doc.subscribers) {
            if (connectionId === peer.connectionId) {
                continue;
            }
            this.peers.get(connectionId)?.send({
                type: 'presenceChanged',
                docId,
                ...found.ref,
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

    private fileRefs(): CollabFileRef[] {
        return [...this.files.values()]
            .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
            .map((file) => ({
                path: file.path,
                url: this.fileUrl(file.path),
                text: file.text,
                ...(file.doc ? { docId: file.doc.docId } : {}),
            }));
    }

    private allDocs(): FakeDoc[] {
        return [
            ...this.docs,
            ...[...this.files.values()]
                .map((file) => file.doc)
                .filter((doc): doc is FakeDoc => Boolean(doc)),
        ];
    }

    /** A live document and how its frames name it (segmentId or filePath) */
    private locate(
        docId: string
    ):
        | { doc: FakeDoc; ref: { segmentId: number } | { filePath: string } }
        | undefined {
        const index = this.docs.findIndex((d) => d.docId === docId);
        if (index >= 0) {
            return { doc: this.docs[index], ref: { segmentId: index + 1 } };
        }
        for (const file of this.files.values()) {
            if (file.doc?.docId === docId) {
                return { doc: file.doc, ref: { filePath: file.path } };
            }
        }
        return undefined;
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
