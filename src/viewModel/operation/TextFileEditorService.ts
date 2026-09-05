import { Hunk } from '../../model/domain.ts';
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
import {
    applyFileHunksToContent,
    getFileContentFromHunks,
} from '../utils/hunkGrouping.ts';

type OpenTextFileOptions = {
    silent?: boolean;
    hunksOverride?: Hunk[];
};

export class TextFileEditorService {
    repository: ViewModelRepository;
    rpi: Rpi;
    ideService: IdeService;
    observerService: ObserverService;
    private hunkService: import('./HunkService.ts').HunkService | null = null;
    private saveTimeout: ReturnType<typeof setTimeout> | null = null;
    private pendingSaveContent: string | null = null;
    private pendingSaveFileName: string | null = null;
    private savePromise: Promise<void> | null = null;
    private saveRequested = false;
    private loadRequestId = 0;

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

    setHunkService = (hunkService: import('./HunkService.ts').HunkService) => {
        this.hunkService = hunkService;
    };

    reloadActiveTextFileIfOpen = async (
        hunksOverride?: Hunk[]
    ): Promise<void> => {
        const fileName =
            this.repository.ideViewModelRepository.activeTextFile();
        if (!fileName) {
            return;
        }
        await this.onTextFileOpened(fileName, {
            silent: true,
            hunksOverride,
        });
    };

    onTextFileOpened = async (
        fileName: string,
        options?: OpenTextFileOptions
    ) => {
        if (!isTextFilePath(fileName)) {
            return;
        }
        const file = this.repository.projectViewModelRepository
            .files()
            .find((item) => item.fileName === fileName);
        const hunks =
            options?.hunksOverride ??
            this.repository.ideViewModelRepository.hunks();

        const currentFile =
            this.repository.ideViewModelRepository.activeTextFile();
        const silent = options?.silent === true && currentFile === fileName;

        if (!silent) {
            if (currentFile) {
                if (this.saveTimeout) {
                    clearTimeout(this.saveTimeout);
                    this.saveTimeout = null;
                }
                if (this.hasUnsavedTextFile() || this.savePromise) {
                    const saved = await this.flushSave();
                    if (!saved) {
                        return;
                    }
                }
            }

            this.repository.ideViewModelRepository.setActiveImageFile(null);
            this.repository.ideViewModelRepository.setActiveTextFile(fileName);
            this.repository.ideViewModelRepository.setTextFileContent('');
            this.repository.ideViewModelRepository.setSaveTextFileRequestState(
                'ok'
            );
        }

        const loadRequestId = ++this.loadRequestId;

        if (!file) {
            const hunkContent = getFileContentFromHunks(hunks, fileName);
            if (hunkContent === null) {
                if (!silent) {
                    this.repository.ideViewModelRepository.setActiveTextFile(
                        null
                    );
                }
                return;
            }
            this.repository.ideViewModelRepository.setTextFileContent(
                hunkContent
            );
            this.repository.ideViewModelRepository.resetTextFileRevisions();
            this.repository.ideViewModelRepository.setLoadTextFileRequestState(
                'ok'
            );
            return;
        }

        if (!silent) {
            this.repository.ideViewModelRepository.setLoadTextFileRequestState(
                'loading'
            );
        }

        try {
            const response = await fetch(file.url, { cache: 'no-store' });
            if (!response.ok) {
                throw new Error(`file-load-${response.status}`);
            }
            const content = await response.text();
            if (
                loadRequestId !== this.loadRequestId ||
                this.repository.ideViewModelRepository.activeTextFile() !==
                    fileName
            ) {
                return;
            }
            this.repository.ideViewModelRepository.setTextFileContent(
                applyFileHunksToContent(content, hunks, fileName)
            );
            this.repository.ideViewModelRepository.resetTextFileRevisions();
            this.repository.ideViewModelRepository.setLoadTextFileRequestState(
                'ok'
            );
        } catch {
            if (
                loadRequestId !== this.loadRequestId ||
                this.repository.ideViewModelRepository.activeTextFile() !==
                    fileName
            ) {
                return;
            }
            if (silent) {
                return;
            }
            this.failTextFileLoad();
        }
    };

    private failTextFileLoad = () => {
        this.loadRequestId += 1;
        this.repository.ideViewModelRepository.setActiveTextFile(null);
        this.repository.ideViewModelRepository.setTextFileContent('');
        this.repository.ideViewModelRepository.setLoadTextFileRequestState(
            'unknown'
        );
        this.repository.ideViewModelRepository.setSaveTextFileRequestState(
            'unknown'
        );
        this.repository.ideViewModelRepository.resetTextFileRevisions();
        this.repository.toast(
            this.repository.dictionary.filemanager.errors.internalError,
            'error'
        );
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
            const closed = await this.onTextFileEditorClosed();
            if (!closed) {
                return;
            }
        }

        this.repository.ideViewModelRepository.setActiveImageFile(fileName);
    };

    onImageFilePreviewClosed = () => {
        this.repository.ideViewModelRepository.setActiveImageFile(null);
    };

    onTextFileContentChanged = (content: string) => {
        const activeFile =
            this.repository.ideViewModelRepository.activeTextFile();
        if (activeFile && this.hunkService) {
            this.hunkService.acceptHunksForFile(activeFile);
        }
        this.repository.ideViewModelRepository.markTextFileChanged();
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

    onTextFileEditorClosed = async (): Promise<boolean> => {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
            this.saveTimeout = null;
        }
        if (this.hasUnsavedTextFile() || this.savePromise) {
            const saved = await this.flushSave();
            if (!saved) {
                return false;
            }
        }
        this.loadRequestId += 1;
        this.repository.ideViewModelRepository.setActiveTextFile(null);
        this.repository.ideViewModelRepository.setTextFileContent('');
        this.repository.ideViewModelRepository.setLoadTextFileRequestState(
            'unknown'
        );
        this.repository.ideViewModelRepository.setSaveTextFileRequestState(
            'unknown'
        );
        return true;
    };

    onOpenFileDeleted = (fileName: string) => {
        if (this.pendingSaveFileName === fileName) {
            this.pendingSaveContent = null;
            this.pendingSaveFileName = null;
        }

        if (
            this.repository.ideViewModelRepository.activeTextFile() === fileName
        ) {
            this.loadRequestId += 1;
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
            this.repository.ideViewModelRepository.resetTextFileRevisions();
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

    private hasUnsavedTextFile = (): boolean => {
        if (this.pendingSaveContent != null) {
            return true;
        }
        return (
            this.repository.ideViewModelRepository.textFileChangeRevision() !==
            this.repository.ideViewModelRepository.savedTextFileRevision()
        );
    };

    private flushSave = async (): Promise<boolean> => {
        this.saveRequested = true;
        const savePromise = this.savePromise ?? this.flushSaveRequests();
        this.savePromise = savePromise;

        try {
            await savePromise;
        } finally {
            if (this.savePromise === savePromise) {
                this.savePromise = null;
            }
        }

        return (
            this.repository.ideViewModelRepository.activeTextFile() !== null &&
            this.repository.ideViewModelRepository.textFileChangeRevision() ===
                this.repository.ideViewModelRepository.savedTextFileRevision()
        );
    };

    private flushSaveRequests = async (): Promise<void> => {
        while (this.saveRequested) {
            this.saveRequested = false;
            await this.saveCurrentTextFile();
        }
    };

    private saveCurrentTextFile = async (): Promise<void> => {
        const fileName =
            this.pendingSaveFileName ??
            this.repository.ideViewModelRepository.activeTextFile();
        const content =
            this.pendingSaveContent ??
            this.repository.ideViewModelRepository.textFileContent();
        this.pendingSaveContent = null;
        this.pendingSaveFileName = null;
        const savingRevision =
            this.repository.ideViewModelRepository.textFileChangeRevision();

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
            this.repository.ideViewModelRepository.markTextFileRevisionSaved(
                savingRevision
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
