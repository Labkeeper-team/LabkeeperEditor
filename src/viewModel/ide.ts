import { ViewModelState } from './viewModelState';
import { ProgramService } from '../model/service/program.ts';
import {
    CompileSuccessResult,
    ComputationalOutputSegment,
    Program,
    TextOutputSegment,
} from '../model/domain.ts';

const dollarPattern = /\${\w+}/i;

export class IdeService {
    vms: ViewModelState;
    programService: ProgramService;

    constructor(vms: ViewModelState, programService: ProgramService) {
        this.vms = vms;
        this.programService = programService;
    }

    setActiveSegmentIndexAndPreviousSegmentIndex = (activeIndex: number) => {
        if (this.vms.ideViewModelState.activeSegmentIndex() !== -1) {
            this.vms.ideViewModelState.setPreviousActiveSegmentIndex(
                this.vms.ideViewModelState.activeSegmentIndex()
            );
        } else if (activeIndex !== -1) {
            this.vms.ideViewModelState.setPreviousActiveSegmentIndex(
                activeIndex
            );
        }
        this.vms.ideViewModelState.setActiveSegmentIndex(activeIndex);
    };

    resetEditor = () => {
        this.vms.resetToInitialState();
        this.programService.clearHistory();
    };

    onSegmentUpdate = (segmentIndex: number, segmentText: string) => {
        if (
            this.programService.getCurrentProgram().segments[segmentIndex]
                .type !== 'computational'
        ) {
            if (dollarPattern.test(segmentText)) {
                this.vms.projectViewModelState.setCompileResultForSegment(
                    segmentIndex,
                    {
                        type: 'computational',
                        statements: [{ type: 'no_result' }],
                    } as ComputationalOutputSegment
                );
            } else {
                this.vms.projectViewModelState.setCompileResultForSegment(
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
    };

    onProgramUpdated = () => {
        const program = this.programService.getCurrentProgram();
        this.vms.projectViewModelState.setCurrentProgram(program);
        if (
            !this.vms.userViewModelState.isAuthenticated() &&
            !this.vms.projectViewModelState.projectIsReadonly()
        ) {
            this.vms.persistenceViewModelState.setLastProgram(
                structuredClone(program)
            );
        } else {
            this.vms.persistenceViewModelState.clearLastProgram();
        }

        this.vms.projectViewModelState.setCompileResultSegmentsSize(
            program.segments.length
        );
        for (let i = 0; i < program.segments.length; i++) {
            let output =
                this.vms.projectViewModelState.compileSuccessResult().segments[
                    i
                ];
            if (
                !this.vms.projectViewModelState.compileSuccessResult().segments[
                    i
                ]
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
                this.vms.projectViewModelState.compileSuccessResult().segments[
                    i
                ].type !== 'computational' &&
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
                    this.vms.projectViewModelState.compileSuccessResult()
                        .segments[i]
                )
            ) {
                this.vms.projectViewModelState.setCompileResultForSegment(
                    i,
                    output
                );
            }
        }
    };

    setNewProgram = (program: Program, result?: CompileSuccessResult) => {
        this.programService.setNewProgram(program);
        if (result) {
            this.vms.projectViewModelState.setCompileResult(result);
        }
        this.onProgramUpdated();
    };
}
