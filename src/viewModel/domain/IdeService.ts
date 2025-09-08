import { ViewModelRepository } from '../repository';
import { ProgramService } from '../../model/service/ProgramService.ts';
import {
    CompileSuccessResult,
    ComputationalOutputSegment,
    Program,
    TextOutputSegment,
} from '../../model/domain.ts';
import { ResetService } from './ResetService.ts';

const dollarPattern = /\$\{[\w|\p{Script=Cyrillic}]+\}/u;

export class IdeService {
    repository: ViewModelRepository;
    programService: ProgramService;
    resetService: ResetService;

    constructor(
        repository: ViewModelRepository,
        programService: ProgramService,
        resetService: ResetService
    ) {
        this.repository = repository;
        this.programService = programService;
        this.resetService = resetService;
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
        this.resetService.resetAll();
    };

    onSegmentUpdate = (segmentIndex: number, segmentText: string) => {
        if (
            this.programService.getCurrentProgram().segments[segmentIndex]
                .type !== 'computational'
        ) {
            if (dollarPattern.test(segmentText)) {
                this.repository.projectViewModelRepository.setCompileResultForSegment(
                    segmentIndex,
                    {
                        type: 'computational',
                        statements: [{ type: 'no_result' }],
                    } as ComputationalOutputSegment
                );
            } else {
                this.repository.projectViewModelRepository.setCompileResultForSegment(
                    segmentIndex,
                    {
                        text: segmentText,
                        type: this.programService.getCurrentProgram().segments[
                            segmentIndex
                        ].type,
                    } as TextOutputSegment
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

    onProgramUpdated = () => {
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
                    program.segments[i].type === 'computational' ||
                    dollarPattern.test(program.segments[i].text)
                ) {
                    output = {
                        type: 'computational',
                        statements: [{ type: 'no_result' }],
                    } as ComputationalOutputSegment;
                } else {
                    output = {
                        type: program.segments[i].type,
                        text: program.segments[i].text,
                    } as TextOutputSegment;
                }
            } else if (
                program.segments[i].type !== 'computational' &&
                !dollarPattern.test(program.segments[i].text)
            ) {
                output = {
                    type: program.segments[i].type,
                    text: program.segments[i].text,
                } as TextOutputSegment;
            } else if (
                program.segments[i].type === 'computational' &&
                this.repository.projectViewModelRepository.compileSuccessResult()
                    .segments[i].type !== 'computational' &&
                program.segments[i].parameters.visible
            ) {
                output = {
                    type: 'computational',
                    statements: [{ type: 'no_result' }],
                } as ComputationalOutputSegment;
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
        this.programService.setNewProgram(program);
        if (result) {
            this.repository.projectViewModelRepository.setCompileResult(result);
        }
        this.onProgramUpdated();
    };
}
