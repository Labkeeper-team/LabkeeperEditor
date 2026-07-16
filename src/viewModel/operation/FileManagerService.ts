import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { FileService } from '../domain/FileService.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import {
    joinFolderPath,
    normalizeFileTreeNodeName,
    svarIdToPath,
} from '../../view/pages/project/fileManager/svarFileTreeAdapter.ts';
import { TextFileEditorService } from './TextFileEditorService.ts';

export class FileManagerService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    fileService: FileService;
    observerService: ObserverService;
    textFileEditorService: TextFileEditorService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        fileService: FileService,
        observerService: ObserverService,
        textFileEditorService: TextFileEditorService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.repository = repository;
        this.fileService = fileService;
        this.observerService = observerService;
        this.textFileEditorService = textFileEditorService;
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
            await this.loaderService.loadFiles(project.projectId);
        } else {
            this.repository.authViewModelRepository.setCurrentView('login');
        }
    };

    onCrossButtonInFileManagerClicked = () => {
        this.repository.settingsViewModelRepository.setShowFileManager(false);
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
        this.onEphemeralFolderCreated(folderPath);
    };

    onCreateFile = async () => {
        if (this.repository.projectViewModelRepository.projectIsReadonly()) {
            return;
        }
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }

        const folderPrefix = this.resolveCurrentFolderPath();
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
                this.observerService.onEvent(
                    Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_UPLOAD
                );
            }
        } catch (error) {
            this.restoreFilesReadyState();
            throw error;
        }
    };

    onUploadFiles = async (files: File[], folderPrefix?: string | null) => {
        this.repository.settingsViewModelRepository.setIsFileDraggedToFileManager(
            false
        );
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }
        const prefix =
            folderPrefix !== undefined && folderPrefix !== null
                ? folderPrefix
                : this.resolveCurrentFolderPath();
        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        let isResultOk = false;
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
                this.fileService.checkFile(file, this.repository.dictionary);
                const name = this.fileService.calculateNumberFile(
                    null,
                    normalizedName,
                    prefix || null
                );
                const formData = new FormData();
                formData.append('file', file);

                const result = await this.rpi.uploadFileRequest(
                    formData,
                    project.projectId,
                    name
                );
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
                    this.observerService.onEvent(
                        Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_UPLOAD
                    );
                }
            }
            if (isResultOk) {
                await this.loaderService.loadFiles(project.projectId);
            } else {
                this.restoreFilesReadyState();
            }
        } catch (error) {
            this.restoreFilesReadyState();
            throw error;
        }
    };

    onSvarCreateFile = async (ev: {
        file: { name: string; type?: string; file?: File };
        parent: string;
        newId?: string;
    }) => {
        if (ev.file.type === 'folder') {
            const folderPath = ev.newId
                ? svarIdToPath(ev.newId)
                : joinFolderPath(svarIdToPath(ev.parent), ev.file.name);
            this.onEphemeralFolderCreated(folderPath);
            return;
        }
        if (ev.file.file) {
            const folderPrefix = svarIdToPath(ev.parent);
            await this.onUploadFiles([ev.file.file], folderPrefix);
        }
    };

    onSvarDeleteFiles = async (ids: string[]) => {
        for (const id of ids) {
            await this.onDeleteFile(svarIdToPath(id));
        }
    };

    onSvarRenameFile = async (id: string, name: string) => {
        const oldPath = svarIdToPath(id);
        const parentPath = oldPath.includes('/')
            ? oldPath.slice(0, oldPath.lastIndexOf('/'))
            : '';
        const newPath = parentPath ? `${parentPath}/${name}` : name;
        await this.onFileNameChanged(oldPath, newPath);
    };

    /** TODO(3) move file → folder. Вариант A (без folder API, текущий): цикл renameFileRequest. */
    onSvarMoveFiles = async (ids: string[], targetId: string) => {
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

        if (!this.folderHasFiles(oldPath)) {
            this.remapCurrentFolderAfterRename(oldPath, normalizedNewPath);
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
        } else {
            this.restoreFilesReadyState();
            this.repository.toast(
                this.repository.dictionary.filemanager.errors
                    .rename_folder_failed,
                'error'
            );
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_RENAME
            );
        }
    };

    onDeleteFolder = async (folderPath: string) => {
        if (!folderPath) {
            return;
        }

        if (!this.folderHasFiles(folderPath)) {
            this.pruneEphemeralFolders(folderPath);
            this.remapCurrentFolderAfterDelete(folderPath);
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
            this.pruneEphemeralFolders(folderPath);
            this.remapCurrentFolderAfterDelete(folderPath);
            await this.loaderService.loadFiles(project.projectId);
        } else {
            this.restoreFilesReadyState();
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_DELETE
            );
        }
    };

    private restoreFilesReadyState = () => {
        this.repository.ideViewModelRepository.setGetFilesRequestState('ok');
    };

    onDeleteFile = async (fileName: string) => {
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
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
            this.textFileEditorService.onOpenFileDeleted(fileName);
            await this.loaderService.loadFiles(project.projectId);
        } else if (!result.isUnauth) {
            this.restoreFilesReadyState();
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_DELETE
            );
        }
    };

    onConfirmDeleteFiles = async () => {
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
            } else if (!result.isOk) {
                this.observerService.onEvent(
                    Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_DELETE
                );
            } else {
                this.textFileEditorService.onOpenFileDeleted(file.fileName);
            }
        }
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
        } else if (!result.isUnauth) {
            this.restoreFilesReadyState();
            this.repository.toast(
                this.repository.dictionary.filemanager.errors
                    .rename_file_failed,
                'error'
            );
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_RENAME
            );
        }
    };

    onFileNameChanged = async (oldName: string, newName: string) => {
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
