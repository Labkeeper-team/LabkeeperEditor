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
    svarIdToPath,
} from '../../view/pages/project/fileManager/svarFileTreeAdapter.ts';

export class FileManagerService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    fileService: FileService;
    observerService: ObserverService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        fileService: FileService,
        observerService: ObserverService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.repository = repository;
        this.fileService = fileService;
        this.observerService = observerService;
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
        const normalized = name.trim();
        if (
            !normalized ||
            normalized.includes('/') ||
            normalized.includes('..')
        ) {
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

    onUploadFiles = async (files: File[], folderPrefix?: string | null) => {
        this.repository.settingsViewModelRepository.setIsFileDraggedToFileManager(
            false
        );
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }
        const prefix =
            folderPrefix ??
            this.repository.settingsViewModelRepository.currentFolderPath();
        let isResultOk = false;
        for (const file of files) {
            this.fileService.checkFile(file, this.repository.dictionary);
            const name = this.fileService.calculateNumberFile(
                null,
                file.name,
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
                        '10Mb'
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
                    this.repository.dictionary.filemanager.errors.tooMuchFiles,
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
                this.observerService.onEvent(
                    Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_UPLOAD
                );
            }
        }
        if (isResultOk) {
            await this.loaderService.loadFiles(project.projectId);
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
            await this.onUploadFiles([ev.file.file], folderPrefix || null);
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

    onSvarMoveFiles = async (ids: string[], targetId: string) => {
        const targetPrefix = svarIdToPath(targetId);
        for (const id of ids) {
            const oldPath = svarIdToPath(id);
            const fileName = oldPath.slice(oldPath.lastIndexOf('/') + 1);
            const newPath = targetPrefix
                ? `${targetPrefix}/${fileName}`
                : fileName;
            if (oldPath !== newPath) {
                await this.onFileNameChanged(oldPath, newPath);
            }
        }
    };

    onDeleteFile = async (fileName: string) => {
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }
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
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
        } else if (!result.isUnauth) {
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
            } else if (!result.isOk) {
                this.observerService.onEvent(
                    Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_DELETE
                );
            }
        }
        await this.loaderService.loadFiles(project.projectId);
        this.repository.settingsViewModelRepository.setFilesToDelete([]);
    };

    onCancelDeleteFiles = () => {
        this.repository.settingsViewModelRepository.setFilesToDelete([]);
    };

    onFileNameChanged = async (oldName: string, newName: string) => {
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            false
        );
        const project = this.repository.projectViewModelRepository.project();
        if (!project || oldName === newName) {
            return;
        }
        if (!newName || newName.includes('..')) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.bad_name,
                'error'
            );
            return;
        }

        const uniqueNewName = newName;
        const result = await this.rpi.renameFileRequest(
            oldName,
            uniqueNewName,
            project.projectId
        );
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
        if (result.isOk) {
            this.programService.replaceAllInProgram(oldName, uniqueNewName);
            await this.loaderService.loadFiles(project.projectId);
        } else if (!result.isUnauth) {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_RENAME
            );
        }
    };

    onFileRenameButtonClicked = () => {
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            true
        );
    };
}
