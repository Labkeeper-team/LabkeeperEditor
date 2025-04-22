export type ProgramRoundStrategy =
    | 'noRound'
    | 'fixedDigits'
    | 'firstMeaningDigit';
export type SegmentType = 'md' | 'computational' | 'latex' | 'asciimath';
export type StatementType =
    | 'assignment'
    | 'calculation'
    | 'file'
    | 'table'
    | 'plot';
export type PlotType = 'line' | 'scatter' | 'histogram';

export interface Segment {
    id: number;
    type: SegmentType;
    parameters: {
        visible?: boolean;
        hideAssignmentWithValues?: boolean;
        hideArray?: boolean;
        hideGeneralFormula?: boolean;
        hideInflAssignment?: boolean;
        hideInflAssignmentWithValues?: boolean;
    };
    text: string;
}

export interface CompileSuccessResult {
    segments: OutputSegment[];
}

export interface OutputSegment {
    type: SegmentType;
    id: number;
}

export interface ComputationalOutputSegment extends OutputSegment {
    statements: Statement[];
}

export interface TextOutputSegment extends OutputSegment {
    text: string;
}

export interface Statement {
    type: StatementType;
}

export interface ProgramParameters {
    roundStrategy: ProgramRoundStrategy;
}

export interface Program {
    segments: Segment[];
    parameters: ProgramParameters;
}

export interface Project {
    projectId: string;
    userId: number;
    title: string;
    lastModified?: string;
    program: Program;
    isPublic: boolean;
}

export interface ProjectShort {
    projectId?: number;
    userId?: number;
    title: string;
    lastModified?: string;
}

export enum CompileError {
    // TOKENIZER
    CODE_NO_END_QUOTES = 100,
    UNKNOWN_SYMBOL = 102,
    QUOTA_EXCEEDED = 103,

    // PARSER
    OPERATOR_EXPECTED = 202,
    NUMBER_EXPECTED = 203,
    NAME_EXPECTED = 204,

    // INTERPRETER
    NO_SUCH_VARIABLE = 301,
    ARITHMETIC_ERROR = 305,
    CANCELED = 306,
    NOT_ENOUGH_WORKERS = 307,
    FILE_USAGE_NOT_ALLOWED = 308,
    TOO_MUCH_FILES = 310,

    // FUNCTIONS
    INCORRECT_ARGUMENT_SIZE = 401,
    INCORRECT_ARGUMENTS_COUNT = 402,
    INCORRECT_ARGUMENT = 403,
    STRING_ARGUMENT_EXPECTED = 302,
    ARRAY_ARGUMENT_EXPECTED = 303,
    NO_SUCH_FUNCTION = 304,
    FUNCTION_HAS_NO_RETURN_VALUE = 407,

    // MD
    VARIABLE_INSERT_ERROR = 501,

    // OTHER
    MULTIPLE_ERROR = 600,
    LOGIN_REQUIRED = 700, // USED ONLY AT FRONTEND
}

export interface CalcStatement extends Statement {
    array: { array: { value: number; infl: number }[] };
    assignment: string;
    assignmentWithValues: string[];
    inflAssignment: string;
    inflAssignmentGeneralFormula: string;
    inflAssignmentWithValues: string[];
    variable: string;
}

export interface PlotStatement extends Statement {
    plotName: string;
    plotXAxisName: string;
    plotYAxisName: string;
    plots: PlotDto[];
    legendVisible: boolean;
}

export interface FileStatement extends Statement {
    url: string;
}

export interface TableStatement extends Statement {
    table: string[][];
}

export interface PlotDto {
    x: number[];
    y: number[];
    name: string;
    type: PlotType;
    color: string;
    xInfl: number[];
    yInfl: number[];
}

export interface CompileErrorResultList {
    errors: CompileErrorResult[];
}

export interface CompileErrorResult {
    code: CompileError;
    payload: {
        line: number;
        position: number;
        segmentId: number;
    };
}

export interface QuotaPayload {
    limit: string;
    quotaIndex: number;
    value: string;
}

export interface NoSuchVariablePayload {
    variable: string;
}

export interface FunctionErrorPayload {
    functionName: string;
}

export interface OperatorExcepctedpayload {
    operators: string[];
}
