import { ViewModelRepository } from '../repository';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { Rpi } from '../../model/rpi';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { FileService } from '../domain/FileService.ts';
import {
    ProgramRoundStrategy,
    Segment,
    SegmentType,
} from '../../model/domain.ts';
import { getIdeSegmentEditorView } from '../../view/pages/project/editor/ide/segments/ideSegmentEditorView';
import { EditorNavigationTarget } from '../repository';

export class ProgramEditorService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    observerService: ObserverService;
    fileService: FileService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        observerService: ObserverService,
        fileService: FileService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.repository = repository;
        this.observerService = observerService;
        this.fileService = fileService;
    }

    onAddedFilesToSegmentEditor = async (
        items: DataTransferItemList,
        segmentIndex: number,
        cursorPosition: number
    ) => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const thisCopy = this;
        let itemIndex = 0;
        for (const item of items) {
            if (item.kind === 'file') {
                const project =
                    this.repository.projectViewModelRepository.project();
                if (
                    !project ||
                    this.repository.projectViewModelRepository.projectIsReadonly()
                ) {
                    this.repository.toast(
                        this.repository.dictionary.segment.errors
                            .non_authorized_paste_image,
                        'error'
                    );
                    return;
                }
                const file = item.getAsFile();
                if (!file) {
                    return;
                }
                this.fileService.checkFile(file, this.repository.dictionary);
                const finalItemIndex = itemIndex;
                const reader = new FileReader();
                reader.onload = async function () {
                    const fileToUpload = file;
                    const name = thisCopy.fileService.calculateNumberFile(
                        segmentIndex + 1 + finalItemIndex,
                        file.name
                    );
                    const formData = new FormData();
                    const filename = name ?? 'Файлнейм';
                    formData.append('file', fileToUpload);

                    if (!project.projectId) {
                        return;
                    }

                    thisCopy.repository.settingsViewModelRepository.setShowFileManager(
                        true
                    );
                    thisCopy.repository.ideViewModelRepository.setGetFilesRequestState(
                        'loading'
                    );
                    thisCopy.repository.ideViewModelRepository.setGetProjectRequestState(
                        'loading'
                    );
                    const res = await thisCopy.rpi.uploadFileRequest(
                        formData,
                        project.projectId,
                        name
                    );
                    thisCopy.repository.ideViewModelRepository.setGetProjectRequestState(
                        'ok'
                    );

                    if (res.isOk) {
                        const lastProgram =
                            thisCopy.programService.getCurrentProgram();
                        const url = res.body;
                        const segmentType =
                            lastProgram.segments[segmentIndex]?.type;
                        let itemToInsert = '';
                        switch (segmentType) {
                            case 'md':
                                if (file.type.includes('image')) {
                                    itemToInsert = `!['image.png'](${url})`;
                                }
                                break;
                            case 'latex':
                                if (file.type.includes('image')) {
                                    itemToInsert = `\\begin{center}
\\includegraphics{${url}}
\\end{center}`;
                                }
                                break;
                            case 'computational': {
                                if (file.type.includes('image')) {
                                    itemToInsert = `image("${url}")`;
                                } else {
                                    itemToInsert = `load_csv("${filename}")`;
                                }
                                break;
                            }
                            case 'asciimath':
                                return;
                        }
                        await thisCopy.loaderService.loadFiles(
                            project.projectId
                        );
                        const segmentText =
                            thisCopy.programService.getCurrentProgram()
                                ?.segments[segmentIndex]?.text;
                        const before = segmentText.slice(0, cursorPosition);
                        const inserted = `\n${itemToInsert}\n`;
                        const composed = `${before}${inserted}${segmentText.slice(cursorPosition)}`;
                        await thisCopy.onSegmentTextEdited(
                            segmentIndex,
                            composed,
                            before.length + inserted.length
                        );
                    } else if (res.code === 413) {
                        thisCopy.repository.ideViewModelRepository.setGetFilesRequestState(
                            'ok'
                        );
                        thisCopy.repository.toast(
                            thisCopy.repository.dictionary.filemanager.errors.tooBigFile.replace(
                                '${replace1}',
                                '10Mb'
                            ),
                            'error'
                        );
                    } else if (res.code === 409) {
                        thisCopy.repository.ideViewModelRepository.setGetFilesRequestState(
                            'ok'
                        );
                        thisCopy.repository.toast(
                            thisCopy.repository.dictionary.filemanager.errors
                                .tooMuchFiles,
                            'error'
                        );
                    } else if (res.isUnauth) {
                        thisCopy.repository.toast(
                            thisCopy.repository.dictionary.filemanager.errors
                                .sessionExpired,
                            'error'
                        );
                        thisCopy.ideService.resetEditor();
                    } else if (res.isForbidden) {
                        thisCopy.repository.ideViewModelRepository.setGetFilesRequestState(
                            'forbidden'
                        );
                        thisCopy.repository.toast(
                            thisCopy.repository.dictionary.filemanager.errors
                                .notEnoughRights,
                            'error'
                        );
                        thisCopy.ideService.resetEditor();
                    } else {
                        thisCopy.observerService.onEvent(
                            Events.EVENT_RPI_UNKNOWN_PROGRAM_EDITOR_UPLOAD
                        );
                        thisCopy.repository.ideViewModelRepository.setGetFilesRequestState(
                            'error'
                        );
                    }
                };
                reader.readAsDataURL(file);
                itemIndex++;
            }
        }
    };

    onPrevVersionButtonClicked = () => {
        const cursorHint = this.programService.undo();
        if (cursorHint) {
            this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
                cursorHint.segmentIndex
            );
        }
        this.ideService.onProgramUpdated();
        if (cursorHint) {
            this.repository.ideViewModelRepository.setPendingSegmentEditorCursor(
                {
                    segmentIndex: cursorHint.segmentIndex,
                    offset: cursorHint.cursorOffset,
                }
            );
            // Страховка: если за 2 rAF-кадра pending не был применён слушателем CM
            // (например, CM не получил docChanged), сбрасываем его принудительно.
            this.scheduleStaleHintClear();
        }
    };

    onNextVersionButtonClicked = () => {
        const cursorHint = this.programService.redo();
        if (cursorHint) {
            this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
                cursorHint.segmentIndex
            );
        }
        this.ideService.onProgramUpdated();
        if (cursorHint) {
            this.repository.ideViewModelRepository.setPendingSegmentEditorCursor(
                {
                    segmentIndex: cursorHint.segmentIndex,
                    offset: cursorHint.cursorOffset,
                }
            );
            this.scheduleStaleHintClear();
        }
    };

    /** Сбрасывает pendingSegmentEditorCursor через 2 rAF-кадра, если CM-слушатель не успел его применить. */
    private scheduleStaleHintClear = () => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                const still =
                    this.repository.ideViewModelRepository.pendingSegmentEditorCursor();
                if (still) {
                    this.repository.ideViewModelRepository.setPendingSegmentEditorCursor(
                        null
                    );
                }
            });
        });
    };

    onRoundStrategySet = (strategy: ProgramRoundStrategy) => {
        this.programService.changeRoundStrategy(strategy);
        this.ideService.onProgramUpdated();
    };

    onProgramSaveTimeout = async () => {
        await this.loaderService.segmentEditorSaveProgram();
    };

    segmentEditorChangeSegmentPosition = async (
        direction: 'up' | 'down',
        segmentIndex: number
    ): Promise<void> => {
        this.observerService.onEvent(Events.EVENT_MOVE_SEGMENT);
        this.programService.moveSegment(segmentIndex, direction);
        this.ideService.onProgramUpdated();
        await this.loaderService.segmentEditorSaveProgram();
    };

    segmentEditorChangeSegmentVisibility = async (
        visible: boolean,
        parameterName: string,
        segmentIndex: number
    ) => {
        this.programService.changeSegmentVisibility(
            visible,
            parameterName,
            segmentIndex
        );
        this.ideService.onProgramUpdated();
    };

    deleteSegment = async (segmentIndex: number) => {
        const filesBefore = this.ideService.calculateFilesToDelete(
            this.programService.getCurrentProgram()
        );
        this.programService.deleteSegmentByIndex(segmentIndex);
        const filesAfter = this.ideService.calculateFilesToDelete(
            this.programService.getCurrentProgram()
        );

        if (filesAfter.length > filesBefore.length) {
            this.repository.settingsViewModelRepository.setFilesToDelete(
                filesAfter
            );
        }

        await this.loaderService.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
    };

    onSegmentAddedViaDivider = async (
        segmentType: SegmentType,
        after: number
    ) => {
        // TODO observer service call
        this.programService.addSegmentAfterIndex(segmentType, after);
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(after + 1);
        await this.loaderService.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
    };

    addLatexBoundarySegment = async (
        text: string,
        placement: 'start' | 'end'
    ) => {
        if (placement === 'start') {
            await this.onSegmentAddedViaDivider('latex', -1);
            await this.onSegmentTextEdited(0, text);
            return;
        }

        this.onAddSegmentClicked('latex');
        const targetSegmentIndex =
            this.programService.getCurrentProgram().segments.length - 1;
        if (targetSegmentIndex < 0) {
            return;
        }
        await this.onSegmentTextEdited(targetSegmentIndex, text);
    };

    onFocusSegment = async (segmentIndex: number) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
        const view = getIdeSegmentEditorView(segmentIndex);
        if (view) {
            const from = view.state.selection.main.from;
            const line = view.state.doc.lineAt(from).number;
            this.repository.ideViewModelRepository.setActiveEditorLine(line);
            this.repository.ideViewModelRepository.setSynctexEditorPosition({
                segmentIndex,
                line,
            });
        }
    };

    onBlurSegment = async (segmentIndex: number) => {
        const view = getIdeSegmentEditorView(segmentIndex);
        if (view) {
            const from = view.state.selection.main.from;
            const line = view.state.doc.lineAt(from).number;
            this.repository.ideViewModelRepository.setSynctexEditorPosition({
                segmentIndex,
                line,
            });
        }

        if (
            this.repository.ideViewModelRepository.activeSegmentIndex() ===
            segmentIndex
        ) {
            this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
        }

        this.ideService.onProgramUpdated();
    };

    onSegmentTextEdited = async (
        segmentIndex: number,
        segmentText: string,
        cursorHead?: number
    ) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
        const programBefore = this.programService.getCurrentProgram();
        const filesBefore =
            this.ideService.calculateFilesToDelete(programBefore);
        this.programService.changeSegmentTextByPositionIndex(
            segmentIndex,
            segmentText,
            cursorHead
        );
        const programAfter = this.programService.getCurrentProgram();
        const filesAfter = this.ideService.calculateFilesToDelete(programAfter);

        if (filesAfter.length > filesBefore.length) {
            this.repository.settingsViewModelRepository.setFilesToDelete(
                filesAfter
            );
        }

        this.ideService.onSegmentUpdate(segmentIndex, segmentText);
        this.repository.projectViewModelRepository.setInputSegmentText(
            segmentIndex,
            segmentText
        );
    };

    private canUseSynctexNavigation = (): boolean => {
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return false;
        }
        if (this.repository.projectViewModelRepository.projectIsReadonly()) {
            return false;
        }
        if (this.repository.projectViewModelRepository.mode() !== 'latex') {
            return false;
        }
        const project = this.repository.projectViewModelRepository.project();
        return Boolean(project?.projectId);
    };

    private getSegmentIdForNavigation = (segmentIndex: number): number => {
        const program =
            this.repository.projectViewModelRepository.currentProgram();
        const segment = program?.segments[segmentIndex] as
            | (Segment & { id?: number })
            | undefined;
        if (segment?.id != null && segment.id > 0) {
            return segment.id;
        }
        return segmentIndex + 1;
    };

    private resolveSynctexEditorPosition =
        (): EditorNavigationTarget | null => {
            const activeIndex =
                this.repository.ideViewModelRepository.activeSegmentIndex();
            const activeLine =
                this.repository.ideViewModelRepository.activeEditorLine();

            if (activeIndex >= 0 && activeLine != null && activeLine >= 1) {
                return { segmentIndex: activeIndex, line: activeLine };
            }

            const saved =
                this.repository.ideViewModelRepository.synctexEditorPosition();
            if (saved && saved.segmentIndex >= 0 && saved.line >= 1) {
                return saved;
            }

            const previousIndex =
                this.repository.ideViewModelRepository.previousActiveSegmentIndex();
            if (previousIndex >= 0) {
                const view = getIdeSegmentEditorView(previousIndex);
                if (view) {
                    const from = view.state.selection.main.from;
                    const line = view.state.doc.lineAt(from).number;
                    return { segmentIndex: previousIndex, line };
                }
            }

            return null;
        };

    onSyncEditorToPdf = async () => {
        if (!this.canUseSynctexNavigation()) {
            return;
        }
        const project = this.repository.projectViewModelRepository.project();
        if (!project?.projectId) {
            return;
        }
        if (!this.repository.projectViewModelRepository.pdfUri()) {
            this.repository.toast(
                this.repository.dictionary.synctex.errors.no_pdf,
                'error'
            );
            return;
        }
        const position = this.resolveSynctexEditorPosition();
        if (!position) {
            this.repository.toast(
                this.repository.dictionary.synctex.errors.no_cursor,
                'error'
            );
            return;
        }
        const result = await this.rpi.navigationDocToPdfRequest(
            project.projectId,
            {
                segmentId: this.getSegmentIdForNavigation(
                    position.segmentIndex
                ),
                line: position.line,
            }
        );
        if (!result.isOk || !result.body) {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_PROGRAM_EDITOR_SYNC_EDITOR_TO_PDF
            );
            this.repository.toast(
                this.repository.dictionary.synctex.errors.failed,
                'error'
            );
            return;
        }
        this.repository.ideViewModelRepository.setPdfNavigationTarget(
            result.body
        );
    };

    onSyncPdfToEditor = async () => {
        if (!this.canUseSynctexNavigation()) {
            return;
        }
        const project = this.repository.projectViewModelRepository.project();
        if (!project?.projectId) {
            return;
        }
        const pdfPosition =
            this.repository.ideViewModelRepository.pdfClickPosition();
        if (!pdfPosition) {
            this.repository.toast(
                this.repository.dictionary.synctex.errors.no_pdf_selection,
                'error'
            );
            return;
        }
        const result = await this.rpi.navigationPdfToDocRequest(
            project.projectId,
            pdfPosition
        );
        if (!result.isOk || !result.body) {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_PROGRAM_EDITOR_SYNC_PDF_TO_EDITOR
            );
            this.repository.toast(
                this.repository.dictionary.synctex.errors.failed,
                'error'
            );
            return;
        }
        const program =
            this.repository.projectViewModelRepository.currentProgram();
        const segments = program?.segments ?? [];
        let segmentIndex = segments.findIndex(
            (s) => (s as Segment & { id?: number }).id === result.body.segmentId
        );
        if (segmentIndex < 0) {
            segmentIndex = result.body.segmentId - 1;
        }
        if (segmentIndex < 0 || segmentIndex >= segments.length) {
            return;
        }
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
        this.repository.ideViewModelRepository.setEditorNavigationTarget({
            segmentIndex,
            line: result.body.line,
        });
    };

    onAddSegmentClicked = (type: SegmentType) => {
        switch (type) {
            case 'md':
                this.observerService.onEvent(Events.EVENT_CREATE_MD_SEGMENT);
                break;
            case 'asciimath':
                this.observerService.onEvent(
                    Events.EVENT_CREATE_ASCIIMATH_SEGMENT
                );
                break;
            case 'latex':
                this.observerService.onEvent(Events.EVENT_CREATE_LATEX_SEGMENT);
                break;
            case 'computational':
                this.observerService.onEvent(Events.EVENT_CREATE_COMP_SEGMENT);
                break;
        }
        this.programService.addSegmentToLastPosition(type);
        this.repository.ideViewModelRepository.setActiveSegmentIndex(
            this.programService.getCurrentProgram().segments.length
        );
        this.ideService.onProgramUpdated();
        this.repository.scrollEditorToBottom();
    };
}
