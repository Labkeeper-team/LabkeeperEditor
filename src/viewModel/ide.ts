import { ViewModelState } from './viewModelState';

export class IdeService {
    vms: ViewModelState;

    constructor(vms: ViewModelState) {
        this.vms = vms;
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
}
