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
        editorCallback: (insert: string) => void
    ) => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const thisCopy = this;
        for (const item of items) {
            await new Promise((reslv) => {
                try {
                    if (item.kind === 'file') {
                        const project =
                            this.repository.projectViewModelRepository.project();
                        if (!project) {
                            this.repository.toast(
                                this.repository.dictionary.segment.errors
                                    .non_authorized_paste_image,
                                'error'
                            );
                            return reslv(null);
                        }
                        const file = item.getAsFile();
                        if (!file) {
                            return reslv(null);
                        }
                        this.fileService.checkFile(
                            file,
                            this.repository.dictionary
                        );
                        const reader = new FileReader();
                        reader.onload = async function () {
                            const fileToUpload = file;
                            const name =
                                thisCopy.fileService.calculateNumberFile(
                                    segmentIndex + 1,
                                    file.name
                                );
                            const formData = new FormData();
                            const filename = name ?? 'Файлнейм';
                            formData.append('file', fileToUpload);

                            if (!project.projectId) {
                                return;
                            }

                            const res = await thisCopy.rpi.uploadFileRequest(
                                formData,
                                project.projectId,
                                name
                            );

                            if (res.code === 413) {
                                thisCopy.repository.toast(
                                    thisCopy.repository.dictionary.filemanager.errors.tooBigFile.replace(
                                        '${replace1}',
                                        '10Mb'
                                    ),
                                    'error'
                                );
                                reslv(null);
                            }
                            if (res.code === 409) {
                                thisCopy.repository.toast(
                                    thisCopy.repository.dictionary.filemanager
                                        .errors.tooMuchFiles,
                                    'error'
                                );
                                reslv(null);
                            }
                            if (res.isUnauth) {
                                thisCopy.repository.toast(
                                    thisCopy.repository.dictionary.filemanager
                                        .errors.sessionExpired,
                                    'error'
                                );
                                thisCopy.ideService.resetEditor();
                                reslv(null);
                            }
                            if (res.isForbidden) {
                                thisCopy.repository.toast(
                                    thisCopy.repository.dictionary.filemanager
                                        .errors.notEnoughRights,
                                    'error'
                                );
                                thisCopy.ideService.resetEditor();
                                reslv(null);
                            }

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
                                    case 'computational':
                                    default: {
                                        if (file.type.includes('image')) {
                                            itemToInsert = `image("${url}")`;
                                        } else {
                                            itemToInsert = `load_csv("${filename}")`;
                                        }
                                        break;
                                    }
                                }
                                await thisCopy.loaderService.loadFiles(
                                    project.projectId
                                );
                                editorCallback(itemToInsert);
                                reslv(null);
                            }
                        };
                        reader.readAsDataURL(file);
                    } else {
                        reslv(null);
                    }
                } catch {
                    reslv(null);
                }
            });
        }
    };

    onPrevVersionButtonClicked = () => {
        this.programService.undo();
        this.ideService.onProgramUpdated();
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
    };

    onNextVersionButtonClicked = () => {
        this.programService.redo();
        this.ideService.onProgramUpdated();
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
    };

    onRoundStrategySet = (strategy: ProgramRoundStrategy) => {
        this.programService.changeRoundStrategy(strategy);
        this.ideService.onProgramUpdated();
    };

    onProgramSaveTimeout = async () => {
        await this.segmentEditorSaveProgram();
    };

    private segmentEditorSaveProgram = async (): Promise<void> => {
        if (this.repository.projectViewModelRepository.projectIsReadonly()) {
            return;
        }
        const savedProgram = this.programService.getCurrentProgram();
        const project = this.repository.projectViewModelRepository.project();
        if (project) {
            const result = await this.rpi.saveProgramRequest(
                project.projectId,
                savedProgram
            );
            if (result.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
            }
            if (!result.isOk) {
                return;
            }
        }
    };

    segmentEditorChangeSegmentPosition = async (
        direction: 'up' | 'down',
        segmentIndex: number
    ): Promise<void> => {
        this.observerService.onEvent(Events.EVENT_MOVE_SEGMENT);
        this.programService.moveSegment(segmentIndex, direction);
        await this.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
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
        this.programService.deleteSegmentByIndex(segmentIndex);
        await this.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
    };

    onSegmentAddedViaDivider = async (
        segmentType: SegmentType,
        after: number
    ) => {
        // TODO observer service call
        this.programService.addSegmentAfterIndex(segmentType, after);
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(after + 1);
        await this.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
    };

    onFocusSegment = async (segmentIndex: number) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
    };

    onBlurSegment = async (segmentIndex: number, segmentText: string) => {
        if (
            this.repository.ideViewModelRepository.activeSegmentIndex() ===
            segmentIndex
        ) {
            this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
        }
        this.programService.changeSegmentTextByPositionIndex(
            segmentIndex,
            segmentText
        );
        await this.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
    };

    onSegmentTextEdited = async (segmentIndex: number, segmentText: string) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
        this.programService.changeSegmentTextByPositionIndex(
            segmentIndex,
            segmentText
        );

        this.ideService.onSegmentUpdate(segmentIndex, segmentText);
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
