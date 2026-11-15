import { ChangeSet, Text } from '@codemirror/state';
import {
    CollabClientFrame,
    CollabCommandAcceptedFrame,
    CollabCommandRejectedFrame,
    CollabCommandRejectionCode,
    CollabDocumentOpenedFrame,
    CollabErrorFrame,
    CollabFileCommandFrame,
    CollabFileRef,
    CollabFilesChangedFrame,
    CollabPresenceChangedFrame,
    CollabSelection,
    CollabServerFrame,
    CollabWelcomeFrame,
} from '../../../model/rpi/collabSocket.ts';
import { LabkeeperFile } from '../../../model/domain.ts';
import { ViewModelRepository } from '../../repository';
import {
    CollabDocChange,
    CollabDocProblem,
    CollabDocTransport,
    CollabDocumentClient,
    RemoteCursor,
    toCollabText,
} from './CollabDocumentClient.ts';
import { CollabViewModelRepository } from './collabRepository.ts';
import type { CollabForwardResult, CollabViewSink } from './CollabService.ts';

/** A file command that got no answer for this long counts as lost */
const FILE_COMMAND_TIMEOUT_MS = 15_000;
/** openDocument of a text file without documentOpened for this long falls back to REST */
const FILE_OPEN_TIMEOUT_MS = 8_000;

/** Result of a file command: applied, rejected by the server, or no answer */
export type CollabFileCommandOutcome =
    | { ok: true }
    | {
          ok: false;
          code: CollabCommandRejectionCode | 'disconnected';
      };

/** A file command as the operation layer issues it; the requestId is added here */
export type CollabFileCommand = CollabFileCommandFrame extends infer F
    ? F extends { requestId: string }
        ? Omit<F, 'requestId'>
        : never
    : never;

/** What the file part of the session needs from CollabService */
export interface CollabFilesHost {
    transport: CollabDocTransport;
    /** Sends on the open connection once welcomed */
    send: (frame: CollabClientFrame) => boolean;
    isWelcomed: () => boolean;
    canWrite: () => boolean;
    isLocked: () => boolean;
    /** welcome.connectionId of the live connection */
    connectionId: () => string | null;
    /** Throttled updatePresence, shared with the segment documents */
    reportSelection: (docId: string, selection: CollabSelection | null) => void;
    /** A push came back readOnly: the session stops writing */
    onReadOnly: () => void;
    log: CollabDocTransport['log'];
}

/** Text file editor reactions to changes made by other participants */
export interface CollabTextFileHooks {
    /** The open text file is gone (deleted by somebody, or no longer in the list) */
    onOpenFileGone: (path: string) => void;
    /** The session has its file list (welcome): an open text file can become a document */
    onFilesReady: () => void;
}

interface PendingOpen {
    requestId: string;
    path: string;
    resolve: ((text: string | null) => void) | null;
    timer: ReturnType<typeof setTimeout> | undefined;
}

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);

/** `path` moved from `from` to `to` (a file, or a folder with everything under it) */
export function remapCollabPath(
    path: string,
    from: string,
    to: string
): string | null {
    if (path === from) {
        return to;
    }
    if (path.startsWith(`${from}/`)) {
        return `${to}${path.slice(from.length)}`;
    }
    return null;
}

function isFileRef(value: unknown): value is CollabFileRef {
    const ref = value as CollabFileRef;
    return Boolean(ref) && isString(ref.path) && isString(ref.url);
}

/**
 * File part of the collaboration session: the shared file list (welcome, filesChanged),
 * file commands with their answers, and the collaborative document of the text file that
 * is open in the text file editor. Uploads are HTTP (collab upload endpoint); their
 * result arrives here as filesChanged like every other change.
 *
 * The file list is written to the project files state as the server sends it, together
 * with the generated files that only the REST list knows. Remote text of the open file is
 * written to Redux before it reaches the editor view, like segment texts.
 */
export class CollabFiles {
    private ready = false;
    private files: CollabFileRef[] = [];
    private folders: string[] = [];
    private filesVersion = 0;
    private commands = new Map<
        string,
        {
            resolve: (outcome: CollabFileCommandOutcome) => void;
            timer: ReturnType<typeof setTimeout>;
        }
    >();
    private doc: CollabDocumentClient | null = null;
    private docPath: string | null = null;
    private docUnsubscribe: (() => void) | null = null;
    private opening: PendingOpen | null = null;
    private sinks = new Set<CollabViewSink>();
    private pendingViewEdit: {
        key: string;
        result: CollabForwardResult;
    } | null = null;
    private revisions: Record<string, number> = {};
    private hooks: CollabTextFileHooks | null = null;
    private cursorFlushQueued = false;

    constructor(
        private host: CollabFilesHost,
        private repository: ViewModelRepository,
        private collabRepository: CollabViewModelRepository
    ) {}

    setHooks = (hooks: CollabTextFileHooks | null): void => {
        this.hooks = hooks;
    };

    /*
     * State for the operation layer
     */

    /** The file list comes from the live session */
    isReady = (): boolean => this.ready && this.host.isWelcomed();

    /** File changes go through the session (commands and the collab upload endpoint) */
    canWrite = (): boolean => this.isReady() && this.host.canWrite();

    /** Connection to name in collab uploads */
    connectionId = (): string | null =>
        this.isReady() ? this.host.connectionId() : null;

    fileRef = (path: string): CollabFileRef | undefined =>
        this.files.find((file) => file.path === path);

    /** Opened as a collaborative document rather than downloaded */
    isTextDocumentFile = (path: string): boolean =>
        this.isReady() && Boolean(this.fileRef(path)?.text);

    /** The open text file is bound to its collaborative document */
    isBound = (path: string | null): boolean =>
        Boolean(path) && this.doc !== null && this.docPath === path;

    /**
     * Files state while the session has the list: its user files plus the generated files
     * of the REST list (generated files are per user and never in the session). Null
     * without a session list: the REST list is used as it is.
     */
    mergeFiles = (restFiles: LabkeeperFile[]): LabkeeperFile[] | null => {
        if (!this.ready) {
            return null;
        }
        const generated = restFiles.filter((file) => file.autogenerated);
        const userPaths = new Set(this.files.map((file) => file.path));
        return [
            ...this.files.map((file) => ({
                autogenerated: false,
                fileName: file.path,
                url: file.url,
            })),
            ...generated.filter((file) => !userPaths.has(file.fileName)),
        ];
    };

    /*
     * Commands
     */

    command = (
        command: CollabFileCommand
    ): Promise<CollabFileCommandOutcome> => {
        if (!this.canWrite()) {
            return Promise.resolve({ ok: false, code: 'disconnected' });
        }
        if (this.host.isLocked()) {
            return Promise.resolve({ ok: false, code: 'locked' });
        }
        const requestId = this.host.transport.nextRequestId('f');
        const frame = { ...command, requestId } as CollabFileCommandFrame;
        if (!this.host.send(frame)) {
            return Promise.resolve({ ok: false, code: 'disconnected' });
        }
        this.host.log('file command', { type: frame.type, requestId });
        return new Promise((resolve) => {
            const timer = setTimeout(() => {
                if (this.commands.delete(requestId)) {
                    this.host.log(
                        'file command without answer',
                        { requestId },
                        'warning'
                    );
                    resolve({ ok: false, code: 'disconnected' });
                }
            }, FILE_COMMAND_TIMEOUT_MS);
            this.commands.set(requestId, { resolve, timer });
        });
    };

    /** commandAccepted / commandRejected of a file command; false when not ours */
    onCommandResult = (
        frame: CollabCommandAcceptedFrame | CollabCommandRejectedFrame
    ): boolean => {
        const pending = this.commands.get(frame.requestId);
        if (!pending) {
            return false;
        }
        this.commands.delete(frame.requestId);
        clearTimeout(pending.timer);
        if (isNumber(frame.filesVersion)) {
            this.filesVersion = Math.max(this.filesVersion, frame.filesVersion);
        }
        if (frame.type === 'commandAccepted') {
            pending.resolve({ ok: true });
        } else {
            this.host.log(
                'file command rejected',
                { code: frame.code, message: frame.message },
                'warning'
            );
            pending.resolve({ ok: false, code: frame.code });
        }
        return true;
    };

    /*
     * Text file document
     */

    /**
     * Opens the document of a text file. Resolves with its text, or null when the file
     * has no document in the session (the caller downloads it over REST then).
     */
    openDocument = (path: string): Promise<string | null> => {
        if (!this.isTextDocumentFile(path)) {
            return Promise.resolve(null);
        }
        if (this.doc && this.docPath === path) {
            return Promise.resolve(this.doc.text);
        }
        this.closeDocument();
        return new Promise((resolve) => {
            if (!this.sendOpen(path, resolve)) {
                resolve(null);
            }
        });
    };

    /** The text file editor closed the file or switched to another one */
    closeDocument = (): void => {
        this.cancelOpening();
        const doc = this.doc;
        if (!doc) {
            return;
        }
        this.host.reportSelection(doc.docId, null);
        this.host.send({ type: 'closeDocument', docId: doc.docId });
        this.disposeDoc();
    };

    /** Stable key of the bound document for the view binding, if any */
    bindingKey = (): string | undefined => this.doc?.docId;

    clientFor = (docId: string): CollabDocumentClient | undefined =>
        this.doc?.docId === docId ? this.doc : undefined;

    /**
     * TextFileEditorService asks before it stores a local text of the bound file.
     * false: drop the edit (made in a view that shows another document, or not writable).
     */
    acceptLocalText = (path: string, text: string): boolean => {
        const viewEdit = this.pendingViewEdit;
        this.pendingViewEdit = null;
        const doc = this.doc;
        if (!doc || this.docPath !== path) {
            return true;
        }
        if (
            viewEdit &&
            viewEdit.key === doc.docId &&
            viewEdit.result === 'stale'
        ) {
            return false;
        }
        if (!this.host.canWrite()) {
            return false;
        }
        doc.setLocalText(text);
        return true;
    };

    /** View binding of the text file editor (collabBinding of segments, keyed by docId) */
    readonly binding = {
        attachView: (sink: CollabViewSink): (() => void) => {
            this.sinks.add(sink);
            this.queueCursorFlush();
            return () => {
                this.sinks.delete(sink);
            };
        },
        forwardViewChanges: (
            key: string,
            _index: number,
            changes: ChangeSet,
            startDoc: Text
        ): CollabForwardResult => {
            const doc = this.doc;
            let result: CollabForwardResult = 'none';
            if (doc && doc.docId === key) {
                if (this.host.canWrite()) {
                    result = doc.applyLocalChanges(changes, startDoc)
                        ? 'applied'
                        : 'stale';
                } else {
                    result = 'stale';
                }
            } else if (doc) {
                result = 'stale';
            }
            const viewEdit = { key, result };
            this.pendingViewEdit = viewEdit;
            queueMicrotask(() => {
                if (this.pendingViewEdit === viewEdit) {
                    this.pendingViewEdit = null;
                }
            });
            return result;
        },
        reportSelection: (
            key: string,
            selection: CollabSelection | null
        ): void => {
            if (this.doc?.docId === key) {
                this.host.reportSelection(key, selection);
            }
        },
        cursorsForKey: (key: string): RemoteCursor[] =>
            this.doc?.docId === key ? this.doc.remoteCursors() : [],
        docForKey: (key: string): Text | null =>
            this.doc?.docId === key ? this.doc.doc : null,
    };

    /** Selections of mounted views for a presence refresh */
    viewSelections = (
        docId?: string
    ): { docId: string; selection: CollabSelection }[] => {
        const doc = this.doc;
        if (!doc || (docId && doc.docId !== docId)) {
            return [];
        }
        const result: { docId: string; selection: CollabSelection }[] = [];
        for (const sink of this.sinks) {
            if (sink.key() !== doc.docId) {
                continue;
            }
            const selection = sink.selection();
            if (selection) {
                result.push({ docId: doc.docId, selection });
            }
        }
        return result;
    };

    /*
     * Frames
     */

    onWelcome = (frame: CollabWelcomeFrame): void => {
        if (!Array.isArray(frame.files) || !Array.isArray(frame.folders)) {
            // a server without file collaboration: files stay with REST
            this.ready = false;
            this.collabRepository.setFilesReady(false);
            this.disposeDoc();
            return;
        }
        const wasReady = this.ready;
        this.ready = true;
        this.filesVersion = Number(frame.filesVersion) || 0;
        this.replaceLists(frame.files, frame.folders);
        this.collabRepository.setFilesReady(true);
        this.host.log('files welcome', { files: this.files.length });

        const doc = this.doc;
        if (doc && this.docPath) {
            // the file may have been renamed or deleted while we were away
            const byDoc = this.files.find((file) => file.docId === doc.docId);
            const current = byDoc ?? this.fileRef(this.docPath);
            if (!current || !current.text) {
                this.fileGone(this.docPath);
            } else if (current.docId && current.docId !== doc.docId) {
                // another document took the path: open it from the server text
                this.reopen(current.path, 'document replaced');
            } else {
                if (current.path !== this.docPath) {
                    this.followRename(this.docPath, current.path);
                }
                doc.setLocked(this.host.isLocked());
                doc.resume();
            }
        } else if (this.opening) {
            const path = this.opening.path;
            const resolve = this.opening.resolve;
            this.cancelOpening(false);
            if (!this.sendOpen(path, resolve)) {
                resolve?.(null);
            }
        }
        this.closeGoneActiveFiles();
        if (!wasReady) {
            this.hooks?.onFilesReady();
        }
    };

    onFilesChanged = (frame: CollabFilesChangedFrame): void => {
        if (
            !Array.isArray(frame.files) ||
            !Array.isArray(frame.folders) ||
            !this.ready
        ) {
            this.host.log(
                'filesChanged ignored',
                { kind: frame.kind },
                'warning'
            );
            return;
        }
        if (isNumber(frame.filesVersion)) {
            this.filesVersion = frame.filesVersion;
        }
        this.host.log('filesChanged', {
            kind: frame.kind,
            source: frame.source,
            filesVersion: this.filesVersion,
        });
        if (frame.kind === 'upload' && isString(frame.path)) {
            this.bumpRevision([frame.path]);
        } else if (frame.kind === 'reset') {
            this.bumpRevision(frame.files.filter(isFileRef).map((f) => f.path));
        }
        if (
            (frame.kind === 'rename' || frame.kind === 'renameFolder') &&
            isString(frame.path) &&
            isString(frame.newPath)
        ) {
            this.followRename(frame.path, frame.newPath);
            this.remapRevisions(frame.path, frame.newPath);
        }
        this.replaceLists(frame.files, frame.folders);
        // a document keeps its docId through renames: follow it even without kind/path
        const doc = this.doc;
        if (doc && this.docPath) {
            const byDoc = this.files.find((file) => file.docId === doc.docId);
            if (byDoc && byDoc.path !== this.docPath) {
                this.followRename(this.docPath, byDoc.path);
            } else if (!byDoc && !this.fileRef(this.docPath)) {
                this.fileGone(this.docPath);
            }
        }
        if (frame.kind === 'deleteFolder' && isString(frame.path)) {
            const current =
                this.repository.settingsViewModelRepository.currentFolderPath();
            if (remapCollabPath(current, frame.path, '') !== null) {
                this.repository.settingsViewModelRepository.setCurrentFolderPath(
                    ''
                );
            }
        }
        this.closeGoneActiveFiles();
    };

    onDocumentOpened = (frame: CollabDocumentOpenedFrame): void => {
        if (
            !isString(frame.docId) ||
            !isString(frame.filePath) ||
            !isNumber(frame.version) ||
            !isString(frame.text)
        ) {
            this.host.log('malformed file documentOpened', undefined, 'error');
            return;
        }
        const opening = this.opening;
        if (!opening || opening.requestId !== frame.requestId) {
            // an answer to an open we gave up on: the server keeps us subscribed, undo it
            if (this.doc?.docId !== frame.docId) {
                this.host.send({ type: 'closeDocument', docId: frame.docId });
            }
            return;
        }
        clearTimeout(opening.timer);
        this.opening = null;
        const before = this.doc?.doc ?? this.reopenBase;
        this.disposeDoc();
        const client = new CollabDocumentClient(
            {
                docId: frame.docId,
                segmentId: 0,
                version: frame.version,
                text: frame.text,
            },
            this.host.transport,
            (problem) => this.onDocProblem(frame.docId, problem)
        );
        client.setLocked(this.host.isLocked());
        this.doc = client;
        this.docPath = frame.filePath;
        this.publishDoc();
        const unsubscribe = [
            client.onChange((change) => this.onDocChange(client, change)),
            client.onCursorsChanged(() => this.queueCursorFlush()),
            client.onDrained(() => this.refreshPresence()),
        ];
        this.docUnsubscribe = () => unsubscribe.forEach((fn) => fn());
        this.host.log('file document open', {
            docId: frame.docId,
            version: frame.version,
        });
        if (opening.resolve) {
            opening.resolve(client.text);
        } else if (
            this.repository.ideViewModelRepository.activeTextFile() ===
            this.docPath
        ) {
            // reopened after a reload: the server text replaces what the editor shows
            const shown = toCollabText(
                this.repository.ideViewModelRepository.textFileContent()
            );
            const start = before ?? shown;
            this.writeText({
                changes: ChangeSet.of(
                    { from: 0, to: start.length, insert: client.doc },
                    start.length
                ),
                before: start,
                after: client.doc,
                remote: true,
            });
        }
        this.queueCursorFlush();
    };

    /** Document frames of the bound file; false when the frame is not about it */
    onDocFrame = (frame: CollabServerFrame): boolean => {
        if (!('docId' in frame)) {
            return false;
        }
        const doc = this.doc;
        if (!doc || doc.docId !== frame.docId) {
            return false;
        }
        switch (frame.type) {
            case 'documentResumed':
                doc.receiveResumed(
                    frame.requestId,
                    frame.fromVersion,
                    Array.isArray(frame.updates) ? frame.updates : []
                );
                return true;
            case 'documentUpdates':
                if (
                    Array.isArray(frame.updates) &&
                    isNumber(frame.fromVersion)
                ) {
                    doc.receiveDocumentUpdates(
                        frame.fromVersion,
                        frame.updates,
                        frame.requestId
                    );
                }
                return true;
            case 'pushAccepted':
                doc.onPushAccepted(frame.requestId, Number(frame.version));
                return true;
            case 'pushRejected':
                doc.onPushRejected(frame);
                return true;
            case 'reloadRequired': {
                const path = isString(frame.filePath)
                    ? frame.filePath
                    : this.docPath;
                if (path && path !== this.docPath && this.docPath) {
                    this.followRename(this.docPath, path);
                }
                this.reopen(path, `reloadRequired: ${frame.reason}`);
                return true;
            }
            default:
                return false;
        }
    };

    /** collabError about our openDocument; false when not ours */
    onCollabError = (frame: CollabErrorFrame): boolean => {
        const opening = this.opening;
        if (
            !opening ||
            !frame.requestId ||
            frame.requestId !== opening.requestId
        ) {
            return false;
        }
        this.host.log(
            'file document not opened',
            { code: frame.code },
            'warning'
        );
        this.cancelOpening();
        return true;
    };

    onPresenceChanged = (frame: CollabPresenceChangedFrame): void => {
        const doc = this.doc;
        if (!doc) {
            return;
        }
        if (doc.docId === frame.docId) {
            doc.setRemotePresence(frame);
        } else {
            // a connection has one cursor per project
            doc.removeCursor(frame.connectionId);
        }
    };

    retainConnections = (connectionIds: Set<string>): void => {
        this.doc?.retainConnections(connectionIds);
    };

    setLocked = (locked: boolean): void => {
        this.doc?.setLocked(locked);
    };

    onDisconnected = (): void => {
        this.doc?.onDisconnected();
        this.resolveCommands('disconnected');
    };

    /** The session stopped: nothing of the file part survives */
    reset = (): void => {
        this.cancelOpening();
        this.disposeDoc();
        this.resolveCommands('disconnected');
        this.ready = false;
        this.files = [];
        this.folders = [];
        this.filesVersion = 0;
        this.revisions = {};
        this.pendingViewEdit = null;
    };

    refreshPresence = (docId?: string): void => {
        for (const { docId: id, selection } of this.viewSelections(docId)) {
            this.host.reportSelection(id, selection);
        }
    };

    /*
     * Internals
     */

    private sendOpen(
        path: string,
        resolve: ((text: string | null) => void) | null
    ): boolean {
        const requestId = this.host.transport.nextRequestId('o');
        if (
            !this.host.send({ type: 'openDocument', requestId, filePath: path })
        ) {
            return false;
        }
        const pending: PendingOpen = {
            requestId,
            path,
            resolve,
            timer: undefined,
        };
        pending.timer = setTimeout(() => {
            if (this.opening === pending) {
                this.host.log(
                    'file document open timed out',
                    undefined,
                    'warning'
                );
                this.cancelOpening();
            }
        }, FILE_OPEN_TIMEOUT_MS);
        this.opening = pending;
        return true;
    }

    private cancelOpening(resolveNull = true): void {
        const opening = this.opening;
        if (!opening) {
            return;
        }
        clearTimeout(opening.timer);
        this.opening = null;
        if (resolveNull) {
            opening.resolve?.(null);
        }
    }

    /** Drops the document state and opens the file again from the server text */
    private reopen(path: string | null, reason: string): void {
        const lost = this.doc?.unconfirmedCount ?? 0;
        this.host.log(
            'file document reload',
            { reason, lostUnconfirmedUpdates: lost },
            lost ? 'warning' : 'info'
        );
        const before = this.doc;
        this.disposeDocState();
        if (!path || !this.fileRef(path)) {
            this.doc = null;
            if (path) {
                this.fileGone(path);
            }
            return;
        }
        // keep the old text as the base the reopened text replaces in the view
        this.doc = null;
        this.publishDoc();
        this.docPath = path;
        this.cancelOpening();
        if (!this.sendOpen(path, null)) {
            this.docPath = null;
            return;
        }
        if (before) {
            this.reopenBase = before.doc;
        }
    }

    private reopenBase: Text | null = null;

    private onDocProblem(docId: string, problem: CollabDocProblem): void {
        if (this.doc?.docId !== docId) {
            return;
        }
        if (problem.kind === 'readOnly') {
            this.host.onReadOnly();
            return;
        }
        this.reopen(
            this.docPath,
            problem.kind === 'reload' ? problem.reason : 'unknownDocument'
        );
    }

    private onDocChange(client: CollabDocumentClient, change: CollabDocChange) {
        if (!change.remote || this.doc !== client) {
            return;
        }
        this.writeText(change);
    }

    /** Remote text into Redux first, then into the mounted view */
    private writeText(change: CollabDocChange): void {
        const ide = this.repository.ideViewModelRepository;
        if (!this.docPath || ide.activeTextFile() !== this.docPath) {
            return;
        }
        ide.setTextFileContent(change.after.toString());
        const doc = this.doc;
        const cursors = doc?.remoteCursors() ?? [];
        for (const sink of this.sinks) {
            if (doc && sink.key() === doc.docId) {
                sink.applyRemote(change, cursors);
            }
        }
    }

    private replaceLists(files: unknown[], folders: unknown[]): void {
        this.files = files
            .filter(isFileRef)
            .map((file) => ({ ...file, text: Boolean(file.text) }));
        this.folders = folders.filter(isString);
        const merged = this.mergeFiles(
            this.repository.projectViewModelRepository.files()
        );
        if (merged) {
            this.repository.projectViewModelRepository.setFiles(merged);
        }
        this.repository.settingsViewModelRepository.setEphemeralFolders(
            this.folders
        );
        this.repository.ideViewModelRepository.setGetFilesRequestState('ok');
    }

    /** The open file, the open image and the current folder follow a rename or move */
    private followRename(from: string, to: string): void {
        if (this.docPath) {
            const next = remapCollabPath(this.docPath, from, to);
            if (next) {
                this.docPath = next;
                this.publishDoc();
            }
        }
        const ide = this.repository.ideViewModelRepository;
        const activeText = ide.activeTextFile();
        const nextText = activeText
            ? remapCollabPath(activeText, from, to)
            : null;
        if (nextText) {
            ide.setActiveTextFile(nextText);
        }
        const activeImage = ide.activeImageFile();
        const nextImage = activeImage
            ? remapCollabPath(activeImage, from, to)
            : null;
        if (nextImage) {
            ide.setActiveImageFile(nextImage);
        }
        const settings = this.repository.settingsViewModelRepository;
        const nextFolder = remapCollabPath(
            settings.currentFolderPath(),
            from,
            to
        );
        if (nextFolder) {
            settings.setCurrentFolderPath(nextFolder);
        }
    }

    /** The open text file or image is not in the list any more: close it */
    private closeGoneActiveFiles(): void {
        const ide = this.repository.ideViewModelRepository;
        const activeImage = ide.activeImageFile();
        if (activeImage && !this.fileRef(activeImage)) {
            ide.setActiveImageFile(null);
        }
        const activeText = ide.activeTextFile();
        if (
            activeText &&
            activeText === this.docPath &&
            !this.fileRef(activeText)
        ) {
            this.fileGone(activeText);
        }
    }

    private fileGone(path: string): void {
        this.host.log('open file is gone', undefined, 'info');
        this.cancelOpening();
        this.disposeDoc();
        this.hooks?.onOpenFileGone(path);
    }

    private bumpRevision(paths: string[]): void {
        if (!paths.length) {
            return;
        }
        const next = { ...this.revisions };
        for (const path of paths) {
            next[path] = (next[path] ?? 0) + 1;
        }
        this.revisions = next;
        this.collabRepository.setFileRevisions(next);
    }

    private remapRevisions(from: string, to: string): void {
        let changed = false;
        const next: Record<string, number> = {};
        for (const [path, revision] of Object.entries(this.revisions)) {
            const mapped = remapCollabPath(path, from, to);
            next[mapped ?? path] = revision;
            changed ||= mapped !== null;
        }
        if (changed) {
            this.revisions = next;
            this.collabRepository.setFileRevisions(next);
        }
    }

    private resolveCommands(code: 'disconnected'): void {
        const pending = [...this.commands.values()];
        this.commands.clear();
        for (const command of pending) {
            clearTimeout(command.timer);
            command.resolve({ ok: false, code });
        }
    }

    private disposeDocState(): void {
        this.docUnsubscribe?.();
        this.docUnsubscribe = null;
        this.doc?.dispose();
    }

    private disposeDoc(): void {
        this.disposeDocState();
        this.doc = null;
        this.docPath = null;
        this.reopenBase = null;
        this.publishDoc();
        this.queueCursorFlush();
    }

    /** The text file editor may edit the file whose document is bound */
    private publishDoc(): void {
        const path = this.doc ? this.docPath : null;
        if (this.collabRepository.state().textFileDocPath !== path) {
            this.collabRepository.setTextFileDocPath(path);
        }
    }

    /** Remote carets go to views in a microtask: a view may be in the middle of an update */
    private queueCursorFlush(): void {
        if (this.cursorFlushQueued) {
            return;
        }
        this.cursorFlushQueued = true;
        queueMicrotask(() => {
            this.cursorFlushQueued = false;
            const doc = this.doc;
            const cursors = doc?.remoteCursors() ?? [];
            for (const sink of this.sinks) {
                if (!doc || sink.key() === doc.docId) {
                    sink.setCursors(cursors, doc?.doc ?? Text.empty);
                }
            }
        });
    }
}
