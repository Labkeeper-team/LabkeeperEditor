import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { FileService } from '../domain/FileService.ts';

export class FileManagerService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    fileService: FileService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        fileService: FileService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.repository = repository;
        this.fileService = fileService;
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

    onUploadFile = async (file: File) => {
        this.repository.settingsViewModelRepository.setIsFileDraggedToFileManager(
            false
        );
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }

        this.fileService.checkFile(file, this.repository.dictionary);
        const name = file.name;
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
        if (result.code === 409) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.tooMuchFiles,
                'error'
            );
        }
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
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
        }
    };

    onFileNameChanged = async (oldName: string, newName: string) => {
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            false
        );
        const project = this.repository.projectViewModelRepository.project();
        if (!project || oldName === newName) {
            return;
        }

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
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
        }
    };

    onFileRenameButtonClicked = () => {
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            true
        );
    };
}
