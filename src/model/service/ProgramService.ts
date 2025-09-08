import {
    Program,
    ProgramRoundStrategy,
    Segment,
    SegmentType,
} from '../domain.ts';

const historyLimit = 50;

function createEmptyProgram(): Program {
    return {
        segments: [],
        parameters: {
            roundStrategy: 'firstMeaningDigit',
        },
    };
}

export class ProgramService {
    history: ProgramChangeAction[];
    redoHistory: ProgramChangeAction[];
    program: Program;

    constructor() {
        this.history = [];
        this.redoHistory = [];
        this.program = createEmptyProgram();
    }

    /*
    System operations
     */

    getCurrentProgram = (): Program => {
        return this.program;
    };

    setNewProgram = (program: Program) => {
        this.clearHistory();
        this.program = structuredClone(program);
    };

    private applyChange = (action: ProgramChangeAction) => {
        action.apply(this.program);
        this.history.push(action);
        this.redoHistory = [];

        if (this.history.length > historyLimit) {
            this.history.shift();
        }
    };

    changeSegmentVisibility = (
        visible: boolean,
        parameterName: string,
        segmentIndex: number
    ) => {
        this.applyChange(
            new VisibilityChangeAction(visible, segmentIndex, parameterName)
        );
    };

    deleteSegmentByIndex = (segmentIndex: number) => {
        this.applyChange(new DeleteSegmentAction(segmentIndex));
    };

    addSegmentAfterIndex = (segmentType: SegmentType, after: number) => {
        this.applyChange(
            new AddSegmentAction(after + 1, {
                parameters: {
                    visible: true,
                },
                text: '',
                type: segmentType,
            })
        );
    };

    addSegmentToLastPosition = (segmentType: SegmentType) => {
        this.applyChange(
            new AddSegmentAction(this.program.segments.length, {
                parameters: {
                    visible: true,
                },
                text: '',
                type: segmentType,
            })
        );
    };

    moveSegment = (segmentIndex: number, direction: 'up' | 'down') => {
        const upperSegment =
            direction === 'down' ? segmentIndex : segmentIndex - 1;
        this.applyChange(new MoveSegmentsAction(upperSegment));
    };

    changeSegmentTextByPositionIndex = (index: number, text: string) => {
        const last: ProgramChangeAction | undefined =
            this.history[this.history.length - 1];
        if (
            !last ||
            !(last instanceof SegmentTextChangedAction) ||
            (last as SegmentTextChangedAction).segmentIndex !== index
        ) {
            if (this.program.segments[index].text === text) {
                return;
            }
            this.applyChange(new SegmentTextChangedAction(index, text));
        } else {
            const lastTextChangeAction = last as SegmentTextChangedAction;
            lastTextChangeAction.newValue = text;
            this.program.segments[index].text = text;
            if (
                lastTextChangeAction.oldValue === lastTextChangeAction.newValue
            ) {
                this.history.pop();
                return;
            }
        }
    };

    undo = () => {
        const last = this.history.pop();
        if (!last) {
            return;
        }
        last.revert(this.program);
        this.redoHistory.push(last);
    };

    canUndo = () => {
        return this.history.length > 0;
    };

    redo = () => {
        const redo = this.redoHistory.pop();
        if (!redo) {
            return;
        }
        redo.apply(this.program);
        this.history.push(redo);
        if (this.history.length > historyLimit) {
            this.history.shift();
        }
    };

    canRedo = () => {
        return this.redoHistory.length > 0;
    };

    changeRoundStrategy = (strategy: ProgramRoundStrategy) => {
        this.program.parameters.roundStrategy = strategy;
    };

    clearHistory = () => {
        this.history = [];
        this.redoHistory = [];
        this.program = createEmptyProgram();
    };
}

interface ProgramChangeAction {
    apply: (program: Program) => void;
    revert: (program: Program) => void;
}

class VisibilityChangeAction implements ProgramChangeAction {
    newValue: boolean;
    segmentIndex: number;
    parameterName: string;

    constructor(
        newValue: boolean,
        segmentIndex: number,
        parameterName: string
    ) {
        this.newValue = newValue;
        this.segmentIndex = segmentIndex;
        this.parameterName = parameterName;
    }

    apply = (program: Program) => {
        program.segments[this.segmentIndex].parameters[this.parameterName] =
            this.newValue;
    };

    revert = (program: Program) => {
        program.segments[this.segmentIndex].parameters[this.parameterName] =
            !this.newValue;
    };
}

class DeleteSegmentAction implements ProgramChangeAction {
    segmentIndex: number;
    segment?: Segment;

    constructor(segmentIndex: number) {
        this.segmentIndex = segmentIndex;
    }

    apply = (program: Program) => {
        this.segment = program.segments[this.segmentIndex];
        program.segments.splice(this.segmentIndex, 1);
    };

    revert = (program: Program) => {
        if (!this.segment) {
            throw new Error('No segment data!');
        }
        program.segments.splice(this.segmentIndex, 0, this.segment);
    };
}

class AddSegmentAction implements ProgramChangeAction {
    afterIndex: number;
    segment: Segment;

    constructor(afterIndex: number, segment: Segment) {
        this.afterIndex = afterIndex;
        this.segment = segment;
    }

    apply = (program: Program) => {
        program.segments.splice(this.afterIndex, 0, this.segment);
    };

    revert = (program: Program) => {
        program.segments.splice(this.afterIndex, 1);
    };
}

class MoveSegmentsAction implements ProgramChangeAction {
    upperSegment: number;

    constructor(upperSegment: number) {
        this.upperSegment = upperSegment;
    }

    apply = (program: Program) => {
        this.permute(program, this.upperSegment);
    };

    revert = (program: Program) => {
        this.permute(program, this.upperSegment);
    };

    private permute = (program: Program, upperSegment: number) => {
        const first: Segment = program.segments[upperSegment];
        const second: Segment = program.segments[upperSegment + 1];

        program.segments[upperSegment] = second;
        program.segments[upperSegment + 1] = first;
    };
}

class SegmentTextChangedAction implements ProgramChangeAction {
    segmentIndex: number;
    newValue: string;
    oldValue?: string;

    constructor(segmentIndex: number, newValue: string) {
        this.segmentIndex = segmentIndex;
        this.newValue = newValue;
    }

    apply = (program: Program) => {
        this.oldValue = program.segments[this.segmentIndex].text;
        program.segments[this.segmentIndex].text = this.newValue;
    };

    revert = (program: Program) => {
        if (this.oldValue === undefined) {
            throw new Error('No old text value');
        }

        program.segments[this.segmentIndex].text = this.oldValue;
    };
}
