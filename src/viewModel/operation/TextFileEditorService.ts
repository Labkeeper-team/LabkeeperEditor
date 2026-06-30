import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { isTextFilePath } from '../../view/pages/project/fileManager/svarFileTreeAdapter.ts';

export class TextFileEditorService {
    repository: ViewModelRepository;
    rpi: Rpi;
    loaderService: LoaderService;
    ideService: IdeService;
    observerService: ObserverService;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private pendingSaveContent: string | null = null;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        loaderService: LoaderService,
        ideService: IdeService,
        observerService: ObserverService
    ) {
        this.repository = repository;
        this.rpi = rpi;
        this.loaderService = loaderService;
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
        try {
            const response = await fetch(file.url);
            const content = await response.text();
            this.repository.ideViewModelRepository.setActiveTextFile(fileName);
            this.repository.ideViewModelRepository.setTextFileContent(content);
            this.repository.ideViewModelRepository.setSaveTextFileRequestState(
                'ok'
            );
        } catch {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.internalError,
                'error'
            );
        }
    };

    onTextFileContentChanged = (content: string) => {
        this.repository.ideViewModelRepository.setTextFileContent(content);
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.pendingSaveContent = content;
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
        this.repository.ideViewModelRepository.setSaveTextFileRequestState(
            'unknown'
        );
    };

    private flushSave = async () => {
        const fileName =
            this.repository.ideViewModelRepository.activeTextFile();
        const content =
            this.pendingSaveContent ??
            this.repository.ideViewModelRepository.textFileContent();
        this.pendingSaveContent = null;

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
            await this.loaderService.loadFiles(project.projectId);
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
