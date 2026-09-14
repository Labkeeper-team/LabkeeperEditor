import {
    CompileError,
    CompileErrorResult,
    FunctionErrorPayload,
    LatexErrorPayload,
    NoSuchVariablePayload,
    OperatorExcepctedpayload,
    QuotaPayload,
} from '../../model/domain.ts';
import { Translations } from '../dictionaries';

export type CompileErrorGroup = {
    key: string;
    segmentId: number | null;
    latexFile?: string | null;
    errors: CompileErrorResult[];
};

const FUNCTION_ERRORS = [
    CompileError.INCORRECT_ARGUMENT_SIZE,
    CompileError.INCORRECT_ARGUMENTS_COUNT,
    CompileError.INCORRECT_ARGUMENT,
    CompileError.STRING_ARGUMENT_EXPECTED,
    CompileError.ARRAY_ARGUMENT_EXPECTED,
    CompileError.NO_SUCH_FUNCTION,
    CompileError.FUNCTION_HAS_NO_RETURN_VALUE,
];

/** Текст ошибки без места, тот же, что в панели ошибок */
export const describeCompileError = (
    { code, payload }: CompileErrorResult,
    dictionary: Translations
): string => {
    const text = dictionary.compile_error[code];
    if (code === CompileError.QUOTA_EXCEEDED) {
        const quota = payload as unknown as QuotaPayload;
        return `${text}. ${dictionary.quota_definition[quota.quotaIndex]}. ${dictionary.error_common.now}: ${quota.value}; ${dictionary.error_common.max}: ${quota.limit}`;
    }
    if (code === CompileError.OPERATOR_EXPECTED) {
        const { operators } = payload as unknown as OperatorExcepctedpayload;
        return `${text} ${typeof operators === 'string' ? operators : operators.join(' ')}`;
    }
    if (code === CompileError.NO_SUCH_VARIABLE) {
        return `${text} ${(payload as unknown as NoSuchVariablePayload).variable}`;
    }
    if (FUNCTION_ERRORS.includes(code)) {
        return `${text} ${(payload as unknown as FunctionErrorPayload).functionName}`;
    }
    if (code === CompileError.LATEX_ERROR) {
        return `${text}: ${(payload as unknown as LatexErrorPayload).latexErrorMessage}`;
    }
    return text;
};

/** «строка 3.2», или пусто, если строки у ошибки нет */
export const describeErrorLine = (
    payload: CompileErrorResult['payload'],
    dictionary: Translations
): string => {
    if (Number.isNaN(+payload.line)) {
        return '';
    }
    // в сегментах строки считаются с нуля, в файлах уже с единицы
    const line = payload.latexFile ? payload.line : payload.line + 1;
    const position =
        payload.position !== undefined ? `.${payload.position}` : '';
    return `${dictionary.error_common.line} ${line}${position}`;
};

export const describeErrorGroup = (
    group: Pick<CompileErrorGroup, 'segmentId' | 'latexFile'>,
    dictionary: Translations
): string => {
    if (group.latexFile) {
        return `${dictionary.error_common.file} ${group.latexFile}`;
    }
    return group.segmentId === null
        ? dictionary.error_common.common_errors
        : `${dictionary.error_common.segment} №${group.segmentId}`;
};

const numberOr = (value: number, fallback: number) =>
    Number.isNaN(+value) ? fallback : value;

const compareErrors = (a: CompileErrorResult, b: CompileErrorResult) => {
    const lineA = numberOr(a.payload.line, Number.POSITIVE_INFINITY);
    const lineB = numberOr(b.payload.line, Number.POSITIVE_INFINITY);
    if (lineA !== lineB) {
        return lineA - lineB;
    }
    return numberOr(a.payload.position, 0) - numberOr(b.payload.position, 0);
};

// сегменты по номеру, потом файлы по пути, общие в конце
const compareGroups = (a: CompileErrorGroup, b: CompileErrorGroup) => {
    if (a.segmentId != null && b.segmentId != null) {
        return a.segmentId - b.segmentId;
    }
    if (a.segmentId != null) {
        return -1;
    }
    if (b.segmentId != null) {
        return 1;
    }
    if (a.latexFile && b.latexFile) {
        return a.latexFile.localeCompare(b.latexFile);
    }
    if (a.latexFile) {
        return -1;
    }
    if (b.latexFile) {
        return 1;
    }
    return 0;
};

/** Ошибки по местам в том порядке, в каком их показывает панель */
export const groupCompileErrors = (
    errors: CompileErrorResult[] | undefined
): CompileErrorGroup[] => {
    const groups = new Map<string, CompileErrorGroup>();
    for (const error of errors ?? []) {
        const latexFile = error.payload.latexFile || null;
        const segmentId = latexFile ? null : error.payload.segmentId;
        const key = latexFile
            ? `file:${latexFile}`
            : segmentId == null
              ? 'common'
              : `segment:${segmentId}`;
        const existing = groups.get(key);
        if (existing) {
            existing.errors.push(error);
        } else {
            groups.set(key, { key, segmentId, latexFile, errors: [error] });
        }
    }
    return Array.from(groups.values())
        .map((group) => ({
            ...group,
            errors: [...group.errors].sort(compareErrors),
        }))
        .sort(compareGroups);
};

/** Текст для поля запроса агента: по строке на ошибку, с местом */
export const compileErrorsPrompt = (
    errors: CompileErrorResult[],
    dictionary: Translations
): string => {
    const lines = groupCompileErrors(errors).flatMap((group) =>
        group.errors.map((error) => {
            const place = [
                describeErrorGroup(group, dictionary),
                describeErrorLine(error.payload, dictionary),
            ]
                .filter(Boolean)
                .join(', ');
            return `- ${place}: ${describeCompileError(error, dictionary)}`;
        })
    );
    return [dictionary.agent_chat.errors_prompt, ...lines].join('\n');
};
