import {
    Program,
    ProgramRoundStrategy,
    Segment,
    SegmentType,
} from '../domain.ts';
import {
    createEmptyProgram,
    ProgramChangeAction,
    ProgramRepository,
} from '../repository/ProgramRepository.ts';

const historyLimit = 50;

export class ProgramService {
    programRepository: ProgramRepository;

    constructor(programRepository: ProgramRepository) {
        this.programRepository = programRepository;
    }

    getCurrentProgram = (): Program => {
        return this.programRepository.program;
    };

    setNewProgram = (program: Program) => {
        this.clearHistory();
        this.programRepository.program = structuredClone(program);
    };

    private applyChange = (action: ProgramChangeAction) => {
        action.apply(this.programRepository.program);
        this.programRepository.history.push(action);
        this.programRepository.redoHistory = [];

        if (this.programRepository.history.length > historyLimit) {
            this.programRepository.history.shift();
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

    replaceAllInProgram = (from: string, to: string) => {
        this.programRepository.history = [];
        this.programRepository.redoHistory = [];
        this.programRepository.program.segments.forEach(
            (s) => (s.text = s.text.replaceAll(from, to))
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
            new AddSegmentAction(
                this.programRepository.program.segments.length,
                {
                    parameters: {
                        visible: true,
                    },
                    text: '',
                    type: segmentType,
                }
            )
        );
    };

    moveSegment = (segmentIndex: number, direction: 'up' | 'down') => {
        const upperSegment =
            direction === 'down' ? segmentIndex : segmentIndex - 1;
        this.applyChange(new MoveSegmentsAction(upperSegment));
    };

    gap = () => {
        const last =
            this.programRepository.history[
                this.programRepository.history.length - 1
            ];
        if (!last) {
            return;
        }
        if (last instanceof GapAction) {
            return;
        }
        const gap = new GapAction();
        this.applyChange(gap);
    };

    private getLineDiff(text1: string, text2: string) {
        let count1 = 0;
        let count2 = 0;
        for (const c of text1) {
            if (c === '\n') {
                count1++;
            }
        }
        for (const c of text2) {
            if (c === '\n') {
                count2++;
            }
        }
        if (count1 !== count2) {
            return Math.abs(count1 - count2);
        }

        let diff = 0;
        for (
            let index1 = 0, index2 = 0;
            index1 < text1.length && index2 < text2.length;
            index1++, index2++
        ) {
            const c1 = text1[index1];
            const c2 = text2[index2];

            if (c1 !== c2 || c1 === '\n' || c2 === '\n') {
                if (c1 !== c2) {
                    diff++;
                }
                while (index2 < text2.length && text2[index2] !== '\n') {
                    index2++;
                }
                while (index1 < text1.length && text1[index1] !== '\n') {
                    index1++;
                }
            }
        }

        if (diff === 0 && text1.length !== text2.length) {
            return 1;
        }

        return diff;
    }

    changeSegmentTextByPositionIndex = (index: number, text: string) => {
        const last: ProgramChangeAction | undefined =
            this.programRepository.history[
                this.programRepository.history.length - 1
            ];
        if (
            !last ||
            !(last instanceof SegmentTextChangedAction) ||
            (last as SegmentTextChangedAction).segmentIndex !== index
        ) {
            if (this.programRepository.program.segments[index].text === text) {
                return;
            }
            this.applyChange(new SegmentTextChangedAction(index, text));
        } else {
            const lastTextChangeAction = last as SegmentTextChangedAction;
            if (lastTextChangeAction.oldValue === undefined) {
                throw new Error('missing old value');
            }
            if (
                this.getLineDiff(lastTextChangeAction.newValue, text) > 1 ||
                this.getLineDiff(lastTextChangeAction.oldValue, text) > 1
            ) {
                this.gap();
                this.changeSegmentTextByPositionIndex(index, text);
                return;
            }
            lastTextChangeAction.newValue = text;
            this.programRepository.program.segments[index].text = text;
            if (
                lastTextChangeAction.oldValue === lastTextChangeAction.newValue
            ) {
                this.programRepository.history.pop();
                return;
            }
        }
    };

    undo = () => {
        while (true) {
            const last = this.programRepository.history.pop();
            if (!last) {
                break;
            }
            last.revert(this.programRepository.program);
            this.programRepository.redoHistory.push(last);

            if (!(last instanceof GapAction)) {
                break;
            }
        }
    };

    canUndo = () => {
        return (
            this.programRepository.history.length > 0 &&
            !!this.programRepository.history.find(
                (h) => !(h instanceof GapAction)
            )
        );
    };

    redo = () => {
        while (true) {
            const redo = this.programRepository.redoHistory.pop();
            if (!redo) {
                break;
            }
            redo.apply(this.programRepository.program);
            this.programRepository.history.push(redo);
            if (this.programRepository.history.length > historyLimit) {
                this.programRepository.history.shift();
            }

            if (!(redo instanceof GapAction)) {
                break;
            }
        }
    };

    canRedo = () => {
        return (
            this.programRepository.redoHistory.length > 0 &&
            !!this.programRepository.redoHistory.find(
                (h) => !(h instanceof GapAction)
            )
        );
    };

    changeRoundStrategy = (strategy: ProgramRoundStrategy) => {
        this.programRepository.program.parameters.roundStrategy = strategy;
    };

    clearHistory = () => {
        this.programRepository.history = [];
        this.programRepository.redoHistory = [];
        this.programRepository.program = createEmptyProgram();
    };
}

class GapAction implements ProgramChangeAction {
    apply = () => {};

    revert = () => {};
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
