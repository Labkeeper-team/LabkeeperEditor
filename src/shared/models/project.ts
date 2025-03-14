export type ProgramRoundStrategy =
  | 'noRound'
  | 'fixedDigits'
  | 'firstMeaningDigit';
export interface Segment {
  id?: number;
  type: 'computational' | 'md';
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

export interface ProgramParameters {
  roundStrategy: ProgramRoundStrategy;
}

export interface Program {
  segments: Segment[];
  parameters: ProgramParameters;
}

export interface Project {
  projectId?: number;
  userId?: number;
  title: string;
  lastModified?: string;
  program: Program;
}

export interface ProjectShort {
  projectId?: number;
  userId?: number;
  title: string;
  lastModified?: string;
}

export enum CompileError {
  CODE_NO_END_QUOTES = 100,
  UNKNOWN_SYMBOL = 102,
  QUOTA_EXCEEDED = 103,
  OPERATOR_EXPECTED = 202,
  NUMBER_EXPECTED = 203,
  NAME_EXPECTED = 204,
  NO_SUCH_VARIABLE = 301,
  STRING_ARGUMENT_EXPECTED = 302,
  ARRAY_ARGUMENT_EXPECTED = 303,
  NO_SUCH_FUNCTION = 304,
  ARITHMETIC_ERROR = 305,
  CANCELED = 306,
  NOT_ENOUGH_WORKERS = 307,
  INCORRECT_LEAST_SQUARES_ARGUMENT_SIZE = 401,
  VARIABLE_INSERT_ERROR = 501,
}

interface Statement {
  type: 'calculation' | 'md';
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

export interface QuotaCompileError extends Omit<CompileErrorResult, 'payload'> {
  payload: QuotaPayload;
}

export interface OperatorExcepctedpayload {
  operators: string[]
}

export interface OperatorExcepctedError extends Omit<CompileErrorResult, 'payload'> {
  payload: OperatorExcepctedpayload;
}
