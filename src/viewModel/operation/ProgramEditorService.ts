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
import { ProgramRoundStrategy, SegmentType } from '../../model/domain.ts';

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
        }
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

    onFocusSegment = async (segmentIndex: number) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
    };

    onBlurSegment = async (segmentIndex: number) => {
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
