import { ViewModelRepository } from '../repository';
import { ProgramService } from '../../model/service/ProgramService.ts';
import {
    CompileSuccessResult,
    ComputationalOutputSegment,
    LabkeeperFile,
    Program,
    Segment,
    TextOutputSegment,
} from '../../model/domain.ts';
import { ResetService } from './ResetService.ts';

const dollarPattern = /\$\{[\w|\p{Script=Cyrillic}]+\}/u;

const PREVIEW_DEBOUNCE_MS = 200;

export class IdeService {
    repository: ViewModelRepository;
    programService: ProgramService;
    resetService: ResetService;

    private previewTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingPreviewApply: (() => void) | null = null;

    constructor(
        repository: ViewModelRepository,
        programService: ProgramService,
        resetService: ResetService
    ) {
        this.repository = repository;
        this.programService = programService;
        this.resetService = resetService;
    }

    private schedulePreviewUpdate(apply: () => void) {
        if (this.previewTimer) clearTimeout(this.previewTimer);
        this.pendingPreviewApply = apply;
        this.previewTimer = setTimeout(() => {
            this.previewTimer = null;
            const fn = this.pendingPreviewApply;
            this.pendingPreviewApply = null;
            fn?.();
        }, PREVIEW_DEBOUNCE_MS);
    }

    private flushPreviewUpdate() {
        if (this.previewTimer) {
            clearTimeout(this.previewTimer);
            this.previewTimer = null;
            const fn = this.pendingPreviewApply;
            this.pendingPreviewApply = null;
            fn?.();
        }
    }

    setActiveSegmentIndexAndPreviousSegmentIndex = (activeIndex: number) => {
        if (
            this.repository.ideViewModelRepository.activeSegmentIndex() !== -1
        ) {
            this.repository.ideViewModelRepository.setPreviousActiveSegmentIndex(
                this.repository.ideViewModelRepository.activeSegmentIndex()
            );
        } else if (activeIndex !== -1) {
            this.repository.ideViewModelRepository.setPreviousActiveSegmentIndex(
                activeIndex
            );
        }
        this.repository.ideViewModelRepository.setActiveSegmentIndex(
            activeIndex
        );
    };

    resetEditor = () => {
        this.flushPreviewUpdate();
        this.resetService.resetAll();
    };

    private isRenderedOnServer(segment: Segment): boolean {
        return segment.type === 'latex' || segment.type === 'computational';
    }

    onSegmentUpdate = (segmentIndex: number, segmentText: string) => {
        if (
            !this.isRenderedOnServer(
                this.programService.getCurrentProgram().segments[segmentIndex]
            )
        ) {
            const segmentType =
                this.programService.getCurrentProgram().segments[segmentIndex]
                    .type;
            if (dollarPattern.test(segmentText)) {
                this.schedulePreviewUpdate(() => {
                    this.repository.projectViewModelRepository.setCompileResultForSegment(
                        segmentIndex,
                        {
                            type: 'computational',
                            statements: [{ type: 'no_result' }],
                        } as ComputationalOutputSegment
                    );
                });
            } else {
                this.schedulePreviewUpdate(() => {
                    this.repository.projectViewModelRepository.setCompileResultForSegment(
                        segmentIndex,
                        {
                            text: segmentText,
                            type: segmentType,
                        } as TextOutputSegment
                    );
                });
            }
        }

        this.repository.ideViewModelRepository.setUndoEnabled(
            this.programService.canUndo()
        );
        this.repository.ideViewModelRepository.setRedoEnabled(
            this.programService.canRedo()
        );
    };

    private findUnusedFileLinks = (
        program: Program,
        files: LabkeeperFile[]
    ) => {
        return files.filter(
            (file) =>
                !program.segments.find((s) => s.text.includes(file.fileName))
        );
    };

    calculateFilesToDelete = (program: Program) => {
        if (
            this.repository.userViewModelRepository.isAuthenticated() &&
            this.repository.projectViewModelRepository.project() &&
            !this.repository.projectViewModelRepository.projectIsReadonly()
        ) {
            return this.findUnusedFileLinks(
                program,
                this.repository.projectViewModelRepository.files()
            );
        }
        return [];
    };

    onProgramUpdated = () => {
        this.flushPreviewUpdate();
        const program = this.programService.getCurrentProgram();

        this.repository.projectViewModelRepository.setCurrentProgram(program);
        if (
            !this.repository.userViewModelRepository.isAuthenticated() &&
            !this.repository.projectViewModelRepository.projectIsReadonly()
        ) {
            this.repository.persistenceViewModelRepository.setLastProgram(
                structuredClone(program)
            );
        } else {
            this.repository.persistenceViewModelRepository.clearLastProgram();
        }

        this.repository.projectViewModelRepository.setCompileResultSegmentsSize(
            program.segments.length
        );
        for (let i = 0; i < program.segments.length; i++) {
            let output =
                this.repository.projectViewModelRepository.compileSuccessResult()
                    .segments[i];
            if (
                !this.repository.projectViewModelRepository.compileSuccessResult()
                    .segments[i]
            ) {
                if (
                    this.isRenderedOnServer(program.segments[i]) ||
                    dollarPattern.test(program.segments[i].text)
                ) {
                    if (program.segments[i].parameters.visible) {
                        output = {
                            type: 'computational',
                            statements: [{ type: 'no_result' }],
                        } as ComputationalOutputSegment;
                    } else {
                        output = {
                            type: 'empty',
                        };
                    }
                } else {
                    output = {
                        type: program.segments[i].type,
                        text: program.segments[i].text,
                    } as TextOutputSegment;
                }
            } else if (
                !this.isRenderedOnServer(program.segments[i]) &&
                !dollarPattern.test(program.segments[i].text)
            ) {
                output = {
                    type: program.segments[i].type,
                    text: program.segments[i].text,
                } as TextOutputSegment;
            } else if (
                ((program.segments[i].type === 'computational' &&
                    this.repository.projectViewModelRepository.compileSuccessResult()
                        .segments[i].type !== 'computational') ||
                    (program.segments[i].type === 'latex' &&
                        this.repository.projectViewModelRepository.compileSuccessResult()
                            .segments[i].type !== 'md')) &&
                program.segments[i].parameters.visible
            ) {
                output = {
                    type: 'computational',
                    statements: [{ type: 'no_result' }],
                } as ComputationalOutputSegment;
            } else if (!program.segments[i].parameters.visible) {
                output = {
                    type: 'empty',
                };
            }

            if (
                JSON.stringify(output) !==
                JSON.stringify(
                    this.repository.projectViewModelRepository.compileSuccessResult()
                        .segments[i]
                )
            ) {
                this.repository.projectViewModelRepository.setCompileResultForSegment(
                    i,
                    output
                );
            }
        }

        this.repository.ideViewModelRepository.setUndoEnabled(
            this.programService.canUndo()
        );
        this.repository.ideViewModelRepository.setRedoEnabled(
            this.programService.canRedo()
        );
    };

    setNewProgram = (program: Program, result?: CompileSuccessResult) => {
        this.flushPreviewUpdate();
        this.programService.setNewProgram(program);
        if (result) {
            this.repository.projectViewModelRepository.setCompileResult(result);
        }
        this.onProgramUpdated();
    };

    replaceProgram = (program: Program) => {
        this.flushPreviewUpdate();
        this.programService.replaceWithNewProgram(program);
        this.onProgramUpdated();
    };
}
