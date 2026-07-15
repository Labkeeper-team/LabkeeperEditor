import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { IdeService } from '../domain/IdeService.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import {
    isImageFilePath,
    isTextFilePath,
} from '../../view/pages/project/fileManager/svarFileTreeAdapter.ts';

export class TextFileEditorService {
    repository: ViewModelRepository;
    rpi: Rpi;
    ideService: IdeService;
    observerService: ObserverService;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private pendingSaveContent: string | null = null;
    private pendingSaveFileName: string | null = null;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        ideService: IdeService,
        observerService: ObserverService
    ) {
        this.repository = repository;
        this.rpi = rpi;
        this.ideService = ideService;
        this.observerService = observerService;
    }

    onTextFileOpened = async (fileName: string) => {
        if (!isTextFilePath(fileName)) {
            return;
        }
        const file = this.repository.projectViewModelRepository
            .files()
            .find((item) => item.fileName === fileName);
        if (!file) {
            return;
        }

        const currentFile =
            this.repository.ideViewModelRepository.activeTextFile();
        if (currentFile && currentFile !== fileName) {
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = null;
            }
            await this.flushSave();
        }

        this.repository.ideViewModelRepository.setActiveImageFile(null);
        this.repository.ideViewModelRepository.setActiveTextFile(fileName);
        this.repository.ideViewModelRepository.setTextFileContent('');
        this.repository.ideViewModelRepository.setLoadTextFileRequestState(
            'loading'
        );
        this.repository.ideViewModelRepository.setSaveTextFileRequestState(
            'ok'
        );

        try {
            const response = await fetch(file.url);
            const content = await response.text();
            this.repository.ideViewModelRepository.setTextFileContent(content);
            this.repository.ideViewModelRepository.setLoadTextFileRequestState(
                'ok'
            );
        } catch {
            this.repository.ideViewModelRepository.setLoadTextFileRequestState(
                'error'
            );
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.internalError,
                'error'
            );
        }
    };

    onImageFileOpened = async (fileName: string) => {
        if (!isImageFilePath(fileName)) {
            return;
        }
        const file = this.repository.projectViewModelRepository
            .files()
            .find((item) => item.fileName === fileName);
        if (!file) {
            return;
        }

        if (this.repository.ideViewModelRepository.activeTextFile()) {
            await this.onTextFileEditorClosed();
        }

        this.repository.ideViewModelRepository.setActiveImageFile(fileName);
    };

    onImageFilePreviewClosed = () => {
        this.repository.ideViewModelRepository.setActiveImageFile(null);
    };

    onTextFileContentChanged = (content: string) => {
        this.repository.ideViewModelRepository.setTextFileContent(content);
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.pendingSaveContent = content;
        this.pendingSaveFileName =
            this.repository.ideViewModelRepository.activeTextFile();
        this.saveTimeout = setTimeout(() => {
            this.saveTimeout = null;
            void this.flushSave();
        }, 1000);
    };

    onTextFileSaveTimeout = async () => {
        await this.flushSave();
    };

    onTextFileEditorClosed = async () => {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        await this.flushSave();
        this.repository.ideViewModelRepository.setActiveTextFile(null);
        this.repository.ideViewModelRepository.setTextFileContent('');
        this.repository.ideViewModelRepository.setLoadTextFileRequestState(
            'unknown'
        );
        this.repository.ideViewModelRepository.setSaveTextFileRequestState(
            'unknown'
        );
    };

    onOpenFileDeleted = (fileName: string) => {
        if (this.pendingSaveFileName === fileName) {
            this.pendingSaveContent = null;
            this.pendingSaveFileName = null;
        }

        if (
            this.repository.ideViewModelRepository.activeTextFile() === fileName
        ) {
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = null;
            }
            this.repository.ideViewModelRepository.setActiveTextFile(null);
            this.repository.ideViewModelRepository.setTextFileContent('');
            this.repository.ideViewModelRepository.setLoadTextFileRequestState(
                'unknown'
            );
            this.repository.ideViewModelRepository.setSaveTextFileRequestState(
                'unknown'
            );
        }

        if (
            this.repository.ideViewModelRepository.activeImageFile() ===
            fileName
        ) {
            this.repository.ideViewModelRepository.setActiveImageFile(null);
        }
    };

    onOpenFilePathChanged = async (oldPath: string, newPath: string) => {
        const activeText =
            this.repository.ideViewModelRepository.activeTextFile();
        if (activeText === oldPath || activeText?.startsWith(`${oldPath}/`)) {
            if (this.saveTimeout) {
                clearTimeout(this.saveTimeout);
                this.saveTimeout = null;
            }
            const updatedPath =
                activeText === oldPath
                    ? newPath
                    : `${newPath}${activeText.slice(oldPath.length)}`;
            if (
                this.pendingSaveFileName === oldPath ||
                this.pendingSaveFileName?.startsWith(`${oldPath}/`)
            ) {
                this.pendingSaveFileName =
                    this.pendingSaveFileName === oldPath
                        ? newPath
                        : `${newPath}${this.pendingSaveFileName.slice(oldPath.length)}`;
            }
            this.repository.ideViewModelRepository.setActiveTextFile(
                updatedPath
            );
            await this.flushSave();
            return;
        }

        const activeImage =
            this.repository.ideViewModelRepository.activeImageFile();
        if (activeImage === oldPath || activeImage?.startsWith(`${oldPath}/`)) {
            const updatedPath =
                activeImage === oldPath
                    ? newPath
                    : `${newPath}${activeImage.slice(oldPath.length)}`;
            this.repository.ideViewModelRepository.setActiveImageFile(
                updatedPath
            );
        }
    };

    private flushSave = async () => {
        const fileName =
            this.pendingSaveFileName ??
            this.repository.ideViewModelRepository.activeTextFile();
        const content =
            this.pendingSaveContent ??
            this.repository.ideViewModelRepository.textFileContent();
        this.pendingSaveContent = null;
        this.pendingSaveFileName = null;

        if (
            !fileName ||
            this.repository.projectViewModelRepository.projectIsReadonly()
        ) {
            return;
        }

        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }

        this.repository.ideViewModelRepository.setSaveTextFileRequestState(
            'loading'
        );
        const blob = new Blob([content], { type: 'text/plain' });
        const formData = new FormData();
        formData.append(
            'file',
            blob,
            fileName.slice(fileName.lastIndexOf('/') + 1)
        );

        const result = await this.rpi.uploadFileRequest(
            formData,
            project.projectId,
            fileName
        );

        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            this.repository.ideViewModelRepository.setSaveTextFileRequestState(
                'error'
            );
            return;
        }

        if (result.isOk) {
            this.repository.ideViewModelRepository.setSaveTextFileRequestState(
                'ok'
            );
        } else {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_FILE_MANAGER_UPLOAD
            );
            this.repository.ideViewModelRepository.setSaveTextFileRequestState(
                'error'
            );
        }
    };
}
