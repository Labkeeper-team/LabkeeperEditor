import { Program, ProgramRoundStrategy, Segment } from '../domain.ts';

const emptyProgram: Program = {
    segments: [],
    parameters: {
        roundStrategy: 'firstMeaningDigit',
    },
};

export class ProgramService {
    history: Program[];
    historyActiveIndex: number;
    onProgramChangedCallback?: (currentProgram: Program) => void;

    constructor() {
        this.history = [emptyProgram];
        this.historyActiveIndex = 0;
    }

    /*
    System operations
     */

    setProgramChnagedCallback(callback: (currentProgram: Program) => void) {
        this.onProgramChangedCallback = callback;
    }

    getCurrentProgram = (): Program => {
        return this.history[this.historyActiveIndex];
    };

    setNewProgram = (program: Program) => {
        this.history = [program];
        this.historyActiveIndex = 0;
        if (this.onProgramChangedCallback) {
            this.onProgramChangedCallback(this.getCurrentProgram());
        }
    };

    transformAndAddToHistory(
        transformer: (last: Program) => Program | undefined
    ) {
        const lastProgram = this.getCurrentProgram();
        const lastProgramCopy = JSON.parse(JSON.stringify(lastProgram));

        const newProgram = transformer(lastProgramCopy);

        if (!newProgram) {
            return;
        }

        const newHistory = this.history.filter((_, index) => {
            return index <= this.historyActiveIndex;
        });
        newHistory.push(newProgram);
        this.history = newHistory;
        this.historyActiveIndex = newHistory.length - 1;

        if (this.onProgramChangedCallback) {
            this.onProgramChangedCallback(this.getCurrentProgram());
        }
    }

    changeSegmentVisibility = (
        visible: boolean,
        parameterName: string,
        segmentIndex: number
    ) => {
        this.transformAndAddToHistory((last) => {
            last.segments[segmentIndex].parameters[parameterName] = visible;
            return last;
        });
    };

    // Delete by position index, not by segment ID

    deleteSegmentByIndex = (segmentIndex: number) => {
        this.transformAndAddToHistory((last) => {
            last.segments = last.segments.filter((_: unknown, i: number) => {
                return i !== segmentIndex;
            });
            last.segments.forEach((segment, index) => {
                segment.id = index + 1;
            });
            return last;
        });
    };

    // Add after segment with position index, no with segment ID

    addSegmentAfterIndex = (segment: Segment, after: number) => {
        this.transformAndAddToHistory((last) => {
            const segmentIds = last.segments.map((s) => s.id ?? 0);
            const maxSegmentId = segmentIds.length
                ? (Math.max(...segmentIds) ?? 0)
                : 0;
            segment.id = maxSegmentId + 1;

            // Вставляем новый сегмент после указанной позиции
            last.segments.splice(after + 1, 0, segment);
            last.segments.forEach((segment, index) => {
                segment.id = index + 1;
            });
            return last;
        });
    };

    addSegmentToLastPosition = (segmentToAdd: Segment) => {
        this.transformAndAddToHistory((last) => {
            const segment: Segment = { ...segmentToAdd };
            const segmentIds = last.segments.map((s) => s.id);
            const maxSegmentId = segmentIds.length
                ? (Math.max(...segmentIds) ?? 0)
                : 0;
            segment.id = maxSegmentId + 1;
            last.segments.push(segment);
            last.segments.forEach((segment, index) => {
                segment.id = index + 1;
            });
            return last;
        });
    };

    moveSegment = (segmentIndex: number, direction: 'up' | 'down') => {
        if (segmentIndex === 0 && direction === 'up') {
            return;
        }
        if (
            direction === 'down' &&
            this.getCurrentProgram().segments.length - 1 === segmentIndex
        ) {
            return;
        }
        this.transformAndAddToHistory((last) => {
            const currentSegment = {
                ...last.segments[segmentIndex],
            };
            const currentSegmentId = currentSegment.id;
            const changePositionIndex =
                direction === 'up' ? segmentIndex - 1 : segmentIndex + 1;
            const changesSegment = {
                ...last.segments[changePositionIndex],
            };
            const changesSegmentId = changesSegment.id;

            changesSegment.id = currentSegmentId;
            currentSegment.id = changesSegmentId;

            last.segments[segmentIndex] = changesSegment;
            last.segments[changePositionIndex] = currentSegment;

            last.segments.forEach((segment, index) => {
                segment.id = index + 1;
            });

            return last;
        });
    };

    changeSegmentTextById = (id: number, text: string) => {
        this.transformAndAddToHistory((last) => {
            last.segments = last.segments.map((s) => {
                if (s.id === id && s.text !== text) {
                    s.text = text;
                }
                return s;
            });
            return last;
        });
    };

    changeSegmentTextByPositionIndex = (index: number, text: string) => {
        this.transformAndAddToHistory((last) => {
            if (last.segments[index].text !== text) {
                last.segments[index].text = text;
                return last;
            } else {
                // segment not changed
                return undefined;
            }
        });
    };

    undo = () => {
        if (this.canUndo()) {
            this.historyActiveIndex--;
        }
        if (this.onProgramChangedCallback) {
            this.onProgramChangedCallback(this.getCurrentProgram());
        }
    };

    canUndo = () => {
        return this.historyActiveIndex > 0;
    };

    redo = () => {
        if (this.canRedo()) {
            this.historyActiveIndex++;
        }
        if (this.onProgramChangedCallback) {
            this.onProgramChangedCallback(this.getCurrentProgram());
        }
    };

    canRedo = () => {
        return this.historyActiveIndex < this.history.length - 1;
    };

    changeRoundStrategy = (strategy: ProgramRoundStrategy) => {
        this.history.forEach((p) => (p.parameters.roundStrategy = strategy));
    };
}
