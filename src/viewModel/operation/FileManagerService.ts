import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { FileService } from '../domain/FileService.ts';
import {
    joinFolderPath,
    normalizeFileTreeNodeName,
    svarIdToPath,
} from '../../view/pages/project/fileManager/svarFileTreeAdapter.ts';
import { TextFileEditorService } from './TextFileEditorService.ts';
import { EditingLockService } from '../domain/EditingLockService.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { fileExtension, trackEvent } from '../utils/observerContext.ts';
import type {
    CollabFileCommand,
    CollabFileCommandOutcome,
    CollabFiles,
} from '../domain/collab/CollabFiles.ts';

/** createFile picks the next free name this many times when the name was taken meanwhile */
const COLLAB_CREATE_FILE_ATTEMPTS = 3;

/** Как файл попал в проект: выбор в окне, бросок или вставка из буфера (GH-244) */
export type FileUploadMethod = 'picker' | 'drop' | 'paste';

export class FileManagerService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    fileService: FileService;
    textFileEditorService: TextFileEditorService;
    editingLock: EditingLockService;
    observerService: ObserverService;
    private hunkService: import('./HunkService.ts').HunkService | null = null;
    /** Collaborative editing: file changes go through the session while it is live */
    private collabFiles: CollabFiles | null = null;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        fileService: FileService,
        textFileEditorService: TextFileEditorService,
        editingLock: EditingLockService,
        observerService: ObserverService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.repository = repository;
        this.fileService = fileService;
        this.textFileEditorService = textFileEditorService;
        this.editingLock = editingLock;
        this.observerService = observerService;
    }

    setHunkService = (hunkService: import('./HunkService.ts').HunkService) => {
        this.hunkService = hunkService;
    };

    setCollabFiles = (collabFiles: CollabFiles) => {
        this.collabFiles = collabFiles;
    };

    /** The live session takes file changes (any participant who may write) */
    private collab = (): CollabFiles | null =>
        this.collabFiles?.canWrite() ? this.collabFiles : null;

    /** Somebody else's project without a live session: files cannot be changed */
    private cannotChangeFiles = (): boolean =>
        this.repository.projectViewModelRepository.projectIsReadonly() &&
        !this.collab();

    /** Sends a file command; the shared list changes with the filesChanged that follows */
    private runCollabCommand = async (
        collab: CollabFiles,
        command: CollabFileCommand
    ): Promise<CollabFileCommandOutcome> => {
        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        try {
            return await collab.command(command);
        } finally {
            this.restoreFilesReadyState();
        }
    };

    /** Toast of a rejected file command, as the REST answers of the same cases */
    private toastCollabRejection = (
        outcome: CollabFileCommandOutcome,
        fallback: string
    ) => {
        if (outcome.ok) {
            return;
        }
        const errors = this.repository.dictionary.filemanager.errors;
        switch (outcome.code) {
            case 'fileExists':
                this.repository.toast(errors.fileAlreadyExists, 'error');
                return;
            case 'fileNotFound':
                this.repository.toast(errors.notFound, 'error');
                return;
            case 'invalidFileName':
                this.repository.toast(errors.bad_name, 'error');
                return;
            case 'tooManyFiles':
                this.repository.toast(errors.tooMuchFiles, 'error');
                return;
            case 'tooLarge':
                this.repository.toast(
                    errors.tooBigFile.replace('${replace1}', '10'),
                    'error'
                );
                return;
            case 'locked':
                this.repository.toast(
                    this.repository.dictionary.agent_chat.editing_locked,
                    'info'
                );
                return;
            default:
                this.repository.toast(fallback, 'error');
        }
    };

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    onFolderButtonClicked = async () => {
        const project = this.repository.projectViewModelRepository.project();
        if (
            project &&
            this.repository.userViewModelRepository.isAuthenticated()
        ) {
            this.repository.settingsViewModelRepository.setShowFileManager(
                true
            );
            this.track(Events.EVENT_FILE_MANAGER_OPENED, {
                source: 'header',
            });
            await this.loaderService.loadFiles(project.projectId);
        } else {
            this.track(Events.EVENT_AUTH_MODAL_OPENED, {
                source: 'file_manager',
            });
            this.repository.authViewModelRepository.setCurrentView('login');
        }
    };

    onCrossButtonInFileManagerClicked = () => {
        this.repository.settingsViewModelRepository.setShowFileManager(false);
        this.track(Events.EVENT_FILE_MANAGER_CLOSED);
    };

    onCurrentFolderPathChanged = (path: string) => {
        this.repository.settingsViewModelRepository.setCurrentFolderPath(path);
    };

    onEphemeralFolderCreated = (folderPath: string) => {
        this.repository.settingsViewModelRepository.addEphemeralFolder(
            folderPath
        );
    };

    onCreateFolder = (name: string, parentPath: string) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        const normalized = normalizeFileTreeNodeName(name);
        if (!normalized) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.bad_name,
                'error'
            );
            return;
        }
        const folderPath = parentPath
            ? `${parentPath}/${normalized}`
            : normalized;
        if (this.collab()) {
            void this.createCollabFolder(folderPath);
            return;
        }
        this.onEphemeralFolderCreated(folderPath);
        this.track(Events.EVENT_FOLDER_CREATED);
    };

    /** An empty folder of the session: every participant sees it */
    private createCollabFolder = async (folderPath: string) => {
        const collab = this.collab();
        if (!collab) {
            this.onEphemeralFolderCreated(folderPath);
            return;
        }
        const outcome = await this.runCollabCommand(collab, {
            type: 'createFolder',
            path: folderPath,
        });
        if (outcome.ok) {
            this.track(Events.EVENT_FOLDER_CREATED);
        } else {
            this.toastCollabRejection(
                outcome,
                this.repository.dictionary.filemanager.errors.internalError
            );
        }
    };

    onCreateFile = async () => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        if (this.cannotChangeFiles()) {
            return;
        }
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }

        const folderPrefix = this.resolveCurrentFolderPath();
        const collab = this.collab();
        if (collab) {
            await this.createCollabFile(collab, folderPrefix);
            return;
        }
        const fileName = this.fileService.calculateNumberFile(
            null,
            'new.txt',
            folderPrefix || null
        );
        const blob = new Blob([''], { type: 'text/plain' });
        const formData = new FormData();
        formData.append(
            'file',
            blob,
            fileName.slice(fileName.lastIndexOf('/') + 1)
        );

        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        try {
            const result = await this.rpi.uploadFileRequest(
                formData,
                project.projectId,
                fileName
            );

            if (result.code === 413) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors.tooBigFile.replace(
                        '${replace1}',
                        '10'
                    ),
                    'error'
                );
                this.restoreFilesReadyState();
                return;
            }
            if (result.code === 400) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors.bad_name,
                    'error'
                );
                this.restoreFilesReadyState();
                return;
            }
            if (result.code === 409) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors.tooMuchFiles,
                    'error'
                );
                this.restoreFilesReadyState();
                return;
            }
            if (result.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
                this.restoreFilesReadyState();
                return;
            }
            if (result.isOk) {
                this.track(Events.EVENT_FILE_CREATED, {
                    ext: fileExtension(fileName),
                });
                await this.loaderService.loadFiles(project.projectId);
                this.repository.ideViewModelRepository.setActiveImageFile(null);
                this.repository.ideViewModelRepository.setActiveTextFile(
                    fileName
                );
                this.repository.ideViewModelRepository.setTextFileContent('');
                this.repository.ideViewModelRepository.setLoadTextFileRequestState(
                    'ok'
                );
                this.repository.ideViewModelRepository.setSaveTextFileRequestState(
                    'ok'
                );
            } else if (
                result.code !== 413 &&
                result.code !== 400 &&
                result.code !== 409 &&
                !result.isUnauth
            ) {
                this.restoreFilesReadyState();
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors.upload_failed,
                    'error'
                );
            }
        } catch (error) {
            this.restoreFilesReadyState();
            throw error;
        }
    };

    /**
     * New empty text file through the session. Two participants creating the same name:
     * the first wins, the second takes the next free name and tries again.
     */
    private createCollabFile = async (
        collab: CollabFiles,
        folderPrefix: string
    ) => {
        let outcome: CollabFileCommandOutcome = {
            ok: false,
            code: 'fileExists',
        };
        let fileName = '';
        for (
            let attempt = 0;
            attempt < COLLAB_CREATE_FILE_ATTEMPTS &&
            !outcome.ok &&
            outcome.code === 'fileExists';
            attempt++
        ) {
            // the list already has the name that won: filesChanged comes before the rejection
            fileName = this.fileService.calculateNumberFile(
                null,
                'new.txt',
                folderPrefix || null
            );
            outcome = await this.runCollabCommand(collab, {
                type: 'createFile',
                path: fileName,
            });
        }
        if (!outcome.ok) {
            this.toastCollabRejection(
                outcome,
                this.repository.dictionary.filemanager.errors.upload_failed
            );
            return;
        }
        this.track(Events.EVENT_FILE_CREATED, {
            ext: fileExtension(fileName),
        });
        // opened like the REST path does, without another file-opened event
        await this.textFileEditorService.onTextFileOpened(fileName, {
            silent: true,
        });
    };

    /** Upload as a participant of the session: the result arrives as filesChanged */
    private uploadThroughCollab = (
        collab: CollabFiles,
        formData: FormData,
        projectId: string,
        name: string
    ) => {
        const connectionId = collab.connectionId();
        if (!connectionId) {
            return null;
        }
        return this.rpi.uploadCollabFileRequest(
            formData,
            projectId,
            name,
            connectionId
        );
    };

    /** Возвращает имена загруженных файлов в проекте: по ним чат агента дописывает запрос */
    onUploadFiles = async (
        files: File[],
        folderPrefix?: string | null,
        method: FileUploadMethod = 'picker',
        source?: 'agent_chat'
    ): Promise<string[]> => {
        const uploaded: string[] = [];
        if (this.editingLock.rejectEdit()) {
            return uploaded;
        }
        this.repository.settingsViewModelRepository.setIsFileDraggedToFileManager(
            false
        );
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return uploaded;
        }
        const prefix =
            folderPrefix !== undefined && folderPrefix !== null
                ? folderPrefix
                : this.resolveCurrentFolderPath();
        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        let isResultOk = false;
        let uploadedThroughCollab = false;
        try {
            for (const file of files) {
                const normalizedName = normalizeFileTreeNodeName(file.name);
                if (!normalizedName) {
                    this.repository.toast(
                        this.repository.dictionary.filemanager.errors.bad_name,
                        'error'
                    );
                    continue;
                }
                if (
                    !(await this.fileService.checkFile(
                        file,
                        this.repository.dictionary
                    ))
                ) {
                    continue;
                }
                const name = this.fileService.calculateNumberFile(
                    null,
                    normalizedName,
                    prefix || null
                );
                const formData = new FormData();
                formData.append('file', file);

                const collab = this.collab();
                const collabUpload = collab
                    ? this.uploadThroughCollab(
                          collab,
                          formData,
                          project.projectId,
                          name
                      )
                    : null;
                if (collab) {
                    uploadedThroughCollab = true;
                }
                const result = await (collabUpload ??
                    this.rpi.uploadFileRequest(
                        formData,
                        project.projectId,
                        name
                    ));
                if (result.code === 423 && collabUpload) {
                    this.repository.toast(
                        this.repository.dictionary.agent_chat.editing_locked,
                        'info'
                    );
                    break;
                }
                if (result.code === 413) {
                    this.repository.toast(
                        this.repository.dictionary.filemanager.errors.tooBigFile.replace(
                            '${replace1}',
                            '10'
                        ),
                        'error'
                    );
                }
                if (result.code === 400) {
                    this.repository.toast(
                        this.repository.dictionary.filemanager.errors.bad_name,
                        'error'
                    );
                }
                if (result.code === 409) {
                    this.repository.toast(
                        this.repository.dictionary.filemanager.errors
                            .tooMuchFiles,
                        'error'
                    );
                    break;
                }
                if (result.isUnauth) {
                    this.repository.toast(
                        this.repository.dictionary.filemanager.errors
                            .sessionExpired,
                        'error'
                    );
                    this.ideService.resetEditor();
                    break;
                }
                if (result.isOk) {
                    isResultOk = true;
                    uploaded.push(name);
                } else if (
                    result.code !== 413 &&
                    result.code !== 400 &&
                    result.code !== 409 &&
                    !result.isUnauth
                ) {
                    this.repository.toast(
                        this.repository.dictionary.filemanager.errors
                            .upload_failed,
                        'error'
                    );
                }
            }
            if (isResultOk) {
                this.track(Events.EVENT_FILE_UPLOADED, {
                    file_count: files.length,
                    method,
                    ...(prefix ? { folder: prefix } : {}),
                    ...(source ? { source } : {}),
                });
                if (uploadedThroughCollab && this.collab()) {
                    // every participant gets the new list as filesChanged
                    this.restoreFilesReadyState();
                } else {
                    await this.loaderService.loadFiles(project.projectId);
                }
            } else {
                this.restoreFilesReadyState();
            }
        } catch (error) {
            this.restoreFilesReadyState();
            throw error;
        }
        return uploaded;
    };

    onSvarCreateFile = async (ev: {
        file: { name: string; type?: string; file?: File };
        parent: string;
        newId?: string;
    }) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        if (ev.file.type === 'folder') {
            const folderPath = ev.newId
                ? svarIdToPath(ev.newId)
                : joinFolderPath(svarIdToPath(ev.parent), ev.file.name);
            if (this.collab()) {
                await this.createCollabFolder(folderPath);
                return;
            }
            this.onEphemeralFolderCreated(folderPath);
            return;
        }
        if (ev.file.file) {
            const folderPrefix = svarIdToPath(ev.parent);
            await this.onUploadFiles([ev.file.file], folderPrefix, 'picker');
        }
    };

    onSvarDeleteFiles = async (ids: string[]) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        for (const id of ids) {
            await this.onDeleteFile(svarIdToPath(id));
        }
    };

    onSvarRenameFile = async (id: string, name: string) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        const oldPath = svarIdToPath(id);
        const parentPath = oldPath.includes('/')
            ? oldPath.slice(0, oldPath.lastIndexOf('/'))
            : '';
        const newPath = parentPath ? `${parentPath}/${name}` : name;
        await this.onFileNameChanged(oldPath, newPath);
    };

    /** TODO(3) move file → folder. Вариант A (без folder API, текущий): цикл renameFileRequest. */
    onSvarMoveFiles = async (ids: string[], targetId: string) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        const targetPrefix = svarIdToPath(targetId);
        for (const id of ids) {
            const oldPath = svarIdToPath(id);
            const fileName = oldPath.slice(oldPath.lastIndexOf('/') + 1);
            const newPath = targetPrefix
                ? `${targetPrefix}/${fileName}`
                : fileName;
            if (oldPath !== newPath) {
                await this.renameFilePath(oldPath, newPath);
            }
        }
        this.track(Events.EVENT_FILES_MOVED, { count: ids.length });
    };

    // TODO(3) onMoveFile(oldPath, targetFolder):
    // A) делегировать в onSvarMoveFiles (renameFileRequest на каждый файл).
    // B) rpi.moveFileRequest(oldPath, targetFolder, projectId) — один запрос, затем loadFiles.

    private folderHasFiles = (folderPath: string): boolean => {
        return this.repository.projectViewModelRepository
            .files()
            .some(
                (file) =>
                    file.fileName === folderPath ||
                    file.fileName.startsWith(`${folderPath}/`)
            );
    };

    private pruneEphemeralFolders = (folderPath: string) => {
        const folders =
            this.repository.settingsViewModelRepository.ephemeralFolders();
        const filtered = folders.filter(
            (folder) =>
                folder !== folderPath && !folder.startsWith(`${folderPath}/`)
        );
        this.repository.settingsViewModelRepository.setEphemeralFolders(
            filtered
        );
    };

    private remapCurrentFolderAfterDelete = (folderPath: string) => {
        const current =
            this.repository.settingsViewModelRepository.currentFolderPath();
        if (current === folderPath || current.startsWith(`${folderPath}/`)) {
            this.repository.settingsViewModelRepository.setCurrentFolderPath(
                ''
            );
        }
    };

    private remapCurrentFolderAfterRename = (
        oldPath: string,
        newPath: string
    ) => {
        const current =
            this.repository.settingsViewModelRepository.currentFolderPath();
        if (current === oldPath) {
            this.repository.settingsViewModelRepository.setCurrentFolderPath(
                newPath
            );
        } else if (current.startsWith(`${oldPath}/`)) {
            this.repository.settingsViewModelRepository.setCurrentFolderPath(
                `${newPath}${current.slice(oldPath.length)}`
            );
        }

        const folders =
            this.repository.settingsViewModelRepository.ephemeralFolders();
        const remapped = folders.map((folder) => {
            if (folder === oldPath) {
                return newPath;
            }
            if (folder.startsWith(`${oldPath}/`)) {
                return `${newPath}${folder.slice(oldPath.length)}`;
            }
            return folder;
        });
        this.repository.settingsViewModelRepository.setEphemeralFolders(
            remapped
        );
    };

    onRenameFolder = async (oldPath: string, newPath: string) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        if (!oldPath || oldPath === newPath) {
            return;
        }
        const oldParentPath = oldPath.includes('/')
            ? oldPath.slice(0, oldPath.lastIndexOf('/'))
            : '';
        const newParentPath = newPath.includes('/')
            ? newPath.slice(0, newPath.lastIndexOf('/'))
            : '';
        const newName = newPath.includes('/')
            ? newPath.slice(newPath.lastIndexOf('/') + 1)
            : newPath;
        const normalizedName = normalizeFileTreeNodeName(newName);
        if (!normalizedName || oldParentPath !== newParentPath) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.bad_name,
                'error'
            );
            return;
        }
        const normalizedNewPath = oldParentPath
            ? `${oldParentPath}/${normalizedName}`
            : normalizedName;
        if (oldPath === normalizedNewPath) {
            return;
        }

        const collab = this.collab();
        if (collab) {
            const hadFiles = this.folderHasFiles(oldPath);
            const outcome = await this.runCollabCommand(collab, {
                type: 'renameFolder',
                path: oldPath,
                newPath: normalizedNewPath,
            });
            if (!outcome.ok) {
                this.toastCollabRejection(
                    outcome,
                    this.repository.dictionary.filemanager.errors
                        .rename_folder_failed
                );
                return;
            }
            this.track(Events.EVENT_FOLDER_RENAMED);
            if (hadFiles) {
                // the server does not touch segment texts: the author's edits go as updates
                this.replaceFileReferences(
                    `${oldPath}/`,
                    `${normalizedNewPath}/`
                );
            }
            return;
        }

        if (!this.folderHasFiles(oldPath)) {
            this.remapCurrentFolderAfterRename(oldPath, normalizedNewPath);
            this.track(Events.EVENT_FOLDER_RENAMED);
            return;
        }

        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }

        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        const result = await this.rpi.renameFolderRequest(
            oldPath,
            normalizedNewPath,
            project.projectId
        );
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            this.restoreFilesReadyState();
            return;
        }
        if (result.isOk) {
            this.track(Events.EVENT_FOLDER_RENAMED);
            this.programService.replaceAllInProgram(
                `${oldPath}/`,
                `${normalizedNewPath}/`
            );
            this.remapCurrentFolderAfterRename(oldPath, normalizedNewPath);
            await this.textFileEditorService.onOpenFilePathChanged(
                oldPath,
                normalizedNewPath
            );
            await this.loaderService.loadFiles(project.projectId);
        } else if (result.code === 400) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.bad_name,
                'error'
            );
            this.restoreFilesReadyState();
        } else if (result.code === 423) {
            // Папку держит другая операция, например сохранение программы.
            // Ответ штатный: сообщаем и даём повторить, в мониторинг не шлём
            this.restoreFilesReadyState();
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.folder_locked,
                'error'
            );
        } else {
            this.restoreFilesReadyState();
            this.repository.toast(
                this.repository.dictionary.filemanager.errors
                    .rename_folder_failed,
                'error'
            );
        }
    };

    onDeleteFolder = async (folderPath: string) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        if (!folderPath) {
            return;
        }

        const collab = this.collab();
        if (collab) {
            const outcome = await this.runCollabCommand(collab, {
                type: 'deleteFolder',
                path: folderPath,
            });
            if (outcome.ok) {
                this.track(Events.EVENT_FOLDER_DELETED, { count: 1 });
            } else {
                this.toastCollabRejection(
                    outcome,
                    this.repository.dictionary.filemanager.errors.internalError
                );
            }
            return;
        }

        if (!this.folderHasFiles(folderPath)) {
            this.pruneEphemeralFolders(folderPath);
            this.remapCurrentFolderAfterDelete(folderPath);
            this.track(Events.EVENT_FOLDER_DELETED, { count: 1 });
            return;
        }

        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }

        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        const result = await this.rpi.deleteFolderRequest(
            folderPath,
            project.projectId
        );
        if (
            this.repository.projectViewModelRepository.project()?.projectId !==
            project.projectId
        ) {
            return;
        }
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            this.restoreFilesReadyState();
            return;
        }
        if (result.isOk) {
            this.track(Events.EVENT_FOLDER_DELETED, { count: 1 });
            for (const fileName of [
                this.repository.ideViewModelRepository.activeTextFile(),
                this.repository.ideViewModelRepository.activeImageFile(),
            ]) {
                if (fileName?.startsWith(`${folderPath}/`)) {
                    this.textFileEditorService.onOpenFileDeleted(fileName);
                }
            }
            this.pruneEphemeralFolders(folderPath);
            this.remapCurrentFolderAfterDelete(folderPath);
            await this.loaderService.loadFiles(project.projectId);
        } else {
            this.restoreFilesReadyState();
        }
    };

    private restoreFilesReadyState = () => {
        this.repository.ideViewModelRepository.setGetFilesRequestState('ok');
    };

    onDeleteFile = async (fileName: string) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }
        const collab = this.collab();
        if (collab) {
            const outcome = await this.runCollabCommand(collab, {
                type: 'deleteFile',
                path: fileName,
            });
            if (outcome.ok) {
                this.track(Events.EVENT_FILE_DELETED, {
                    count: 1,
                    ext: fileExtension(fileName),
                });
                this.textFileEditorService.onOpenFileDeleted(fileName);
            } else {
                this.toastCollabRejection(
                    outcome,
                    this.repository.dictionary.filemanager.errors.internalError
                );
            }
            return;
        }
        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        const result = await this.rpi.deleteFileRequest(
            fileName,
            project.projectId
        );
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            this.restoreFilesReadyState();
        }
        if (result.isOk) {
            this.track(Events.EVENT_FILE_DELETED, {
                count: 1,
                ext: fileExtension(fileName),
            });
            this.textFileEditorService.onOpenFileDeleted(fileName);
            await this.loaderService.loadFiles(project.projectId);
        } else if (!result.isUnauth) {
            this.restoreFilesReadyState();
        }
    };

    onConfirmDeleteFiles = async () => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        const files =
            this.repository.settingsViewModelRepository.filesToDelete();
        if (!files?.length) {
            this.repository.settingsViewModelRepository.setFilesToDelete([]);
            return;
        }
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            this.repository.settingsViewModelRepository.setFilesToDelete([]);
            return;
        }
        const collab = this.collab();
        if (collab) {
            let deleted = 0;
            for (const file of files) {
                const outcome = await this.runCollabCommand(collab, {
                    type: 'deleteFile',
                    path: file.fileName,
                });
                if (!outcome.ok) {
                    this.toastCollabRejection(
                        outcome,
                        this.repository.dictionary.filemanager.errors
                            .internalError
                    );
                    break;
                }
                deleted += 1;
                this.textFileEditorService.onOpenFileDeleted(file.fileName);
            }
            if (deleted) {
                this.track(Events.EVENT_FILE_DELETED, { count: deleted });
            }
            this.repository.settingsViewModelRepository.setFilesToDelete([]);
            return;
        }
        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        for (const file of files) {
            const result = await this.rpi.deleteFileRequest(
                file.fileName,
                project.projectId
            );
            if (result.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
                this.repository.settingsViewModelRepository.setFilesToDelete(
                    []
                );
                this.restoreFilesReadyState();
                return;
            }
            if (result.code === 404) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors.notFound,
                    'error'
                );
                this.repository.settingsViewModelRepository.setFilesToDelete(
                    []
                );
                this.restoreFilesReadyState();
                return;
            }
            if (result.isOk) {
                this.textFileEditorService.onOpenFileDeleted(file.fileName);
            }
        }
        this.track(Events.EVENT_FILE_DELETED, { count: files.length });
        await this.loaderService.loadFiles(project.projectId);
        this.repository.settingsViewModelRepository.setFilesToDelete([]);
    };

    onCancelDeleteFiles = () => {
        this.repository.settingsViewModelRepository.setFilesToDelete([]);
    };

    private renameFilePath = async (oldName: string, newName: string) => {
        const project = this.repository.projectViewModelRepository.project();
        if (!project || oldName === newName) {
            return;
        }
        // GH-188: имя файла, удалённого агентом, человек занял сам, и удаление этим решено
        if (
            this.hunkService &&
            !(await this.hunkService.acceptDeletionOfFileName(newName))
        ) {
            return;
        }
        const collab = this.collab();
        if (collab) {
            const outcome = await this.runCollabCommand(collab, {
                type: 'renameFile',
                path: oldName,
                newPath: newName,
            });
            if (!outcome.ok) {
                this.toastCollabRejection(
                    outcome,
                    this.repository.dictionary.filemanager.errors
                        .rename_file_failed
                );
                return;
            }
            this.track(Events.EVENT_FILE_RENAMED, {
                ext: fileExtension(newName),
            });
            // the open file follows filesChanged; references in segments are the author's edit
            this.replaceFileReferences(oldName, newName);
            return;
        }
        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        const result = await this.rpi.renameFileRequest(
            oldName,
            newName,
            project.projectId
        );
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            this.restoreFilesReadyState();
        }
        if (result.isOk) {
            this.track(Events.EVENT_FILE_RENAMED, {
                ext: fileExtension(newName),
            });
            this.programService.replaceAllInProgram(oldName, newName);
            await this.textFileEditorService.onOpenFilePathChanged(
                oldName,
                newName
            );
            await this.loaderService.loadFiles(project.projectId);
        } else if (result.code === 400) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.bad_name,
                'error'
            );
            this.restoreFilesReadyState();
        } else if (result.code === 417) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.fileAlreadyExists,
                'error'
            );
            this.restoreFilesReadyState();
        } else if (!result.isUnauth) {
            this.restoreFilesReadyState();
            this.repository.toast(
                this.repository.dictionary.filemanager.errors
                    .rename_file_failed,
                'error'
            );
        }
    };

    onFileNameChanged = async (oldName: string, newName: string) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            false
        );
        const oldParentPath = oldName.includes('/')
            ? oldName.slice(0, oldName.lastIndexOf('/'))
            : '';
        const newParentPath = newName.includes('/')
            ? newName.slice(0, newName.lastIndexOf('/'))
            : '';
        const newFileName = newName.includes('/')
            ? newName.slice(newName.lastIndexOf('/') + 1)
            : newName;
        const normalizedName = normalizeFileTreeNodeName(newFileName);
        if (!normalizedName || oldParentPath !== newParentPath) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.bad_name,
                'error'
            );
            return;
        }

        const normalizedNewPath = oldParentPath
            ? `${oldParentPath}/${normalizedName}`
            : normalizedName;
        await this.renameFilePath(oldName, normalizedNewPath);
    };

    /**
     * References to a renamed file in segment texts, in a live session: the collaboration
     * server leaves texts alone, so the change goes to the documents as the author's edit
     */
    private replaceFileReferences = (from: string, to: string) => {
        const before = this.programService
            .getCurrentProgram()
            .segments.map((segment) => segment.text);
        this.programService.replaceAllInProgram(from, to);
        const changed = this.programService
            .getCurrentProgram()
            .segments.some((segment, index) => segment.text !== before[index]);
        if (!changed) {
            return;
        }
        this.ideService.onProgramUpdated();
        if (!this.repository.projectViewModelRepository.projectIsReadonly()) {
            this.repository.ideViewModelRepository.markProgramChanged();
            void this.loaderService.segmentEditorSaveProgram();
        }
    };

    onFileRenameButtonClicked = () => {
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            true
        );
    };

    private resolveCurrentFolderPath = (): string => {
        const current =
            this.repository.settingsViewModelRepository.currentFolderPath();
        if (!current) {
            return '';
        }
        const ephemeralFolders =
            this.repository.settingsViewModelRepository.ephemeralFolders();
        const folderExists =
            ephemeralFolders.includes(current) ||
            this.repository.projectViewModelRepository
                .files()
                .some(
                    (file) =>
                        file.fileName === current ||
                        file.fileName.startsWith(`${current}/`)
                );
        if (!folderExists) {
            this.repository.settingsViewModelRepository.setCurrentFolderPath(
                ''
            );
            return '';
        }
        return current;
    };
}
