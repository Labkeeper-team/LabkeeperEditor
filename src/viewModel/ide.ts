import { ViewModelState } from './viewModelState';
import { ProgramService } from '../model/service/program.ts';

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
}
