import { Program } from '../domain.ts';

export interface ProgramChangeAction {
    apply: (program: Program) => void;
    revert: (program: Program) => void;
}

export interface ProgramRepository {
    history: ProgramChangeAction[];
    redoHistory: ProgramChangeAction[];
    program: Program;
}

export function createEmptyProgram(): Program {
    return {
        segments: [],
        parameters: {
            roundStrategy: 'firstMeaningDigit',
        },
    };
}

export class InMemoryProgramRepository implements ProgramRepository {
    history: ProgramChangeAction[];
    redoHistory: ProgramChangeAction[];
    program: Program;

    constructor() {
        this.history = [];
        this.redoHistory = [];
        this.program = createEmptyProgram();
    }
}
