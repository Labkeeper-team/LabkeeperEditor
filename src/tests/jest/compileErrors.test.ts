import { CompileError, CompileErrorResult } from '../../model/domain.ts';
import { en } from '../../viewModel/dictionaries/en.ts';
import {
    compileErrorsPrompt,
    describeCompileError,
} from '../../viewModel/utils/compileErrors.ts';

const error = (
    code: CompileError,
    payload: Partial<CompileErrorResult['payload']> & Record<string, unknown>
): CompileErrorResult =>
    ({
        code,
        payload: { line: 0, position: 0, segmentId: null, ...payload },
    }) as CompileErrorResult;

test('errors-prompt-lists-every-error-with-its-place-in-panel-order', () => {
    const prompt = compileErrorsPrompt(
        [
            error(CompileError.CODE_NO_END_QUOTES, {
                segmentId: null,
                line: Number.NaN,
            }),
            error(CompileError.LATEX_ERROR, {
                latexFile: 'main.tex',
                line: 10,
                position: undefined,
                latexErrorMessage: 'Undefined control sequence',
            }),
            error(CompileError.NO_SUCH_VARIABLE, {
                segmentId: 3,
                line: 1,
                position: 4,
                variable: 'y',
            }),
            error(CompileError.NO_SUCH_VARIABLE, {
                segmentId: 2,
                line: 0,
                position: 2,
                variable: 'x',
            }),
        ],
        en
    );

    // порядок как в панели: сегменты по номеру, потом файлы, потом общие
    expect(prompt).toBe(
        [
            'Fix the compilation errors:',
            '- Segment №2, line 1.2: No such variable x',
            '- Segment №3, line 2.4: No such variable y',
            '- File main.tex, line 10: Latex error: Undefined control sequence',
            '- General errors: No closing quotes',
        ].join('\n')
    );
});

test('error-text-is-the-same-as-in-the-panel', () => {
    // квота собирается из трёх кусков, её легче всего сломать при переносе
    expect(
        describeCompileError(
            error(CompileError.QUOTA_EXCEEDED, {
                segmentId: 1,
                quotaIndex: 1,
                value: '3',
                limit: '3',
            }),
            en
        )
    ).toBe('Quota exceeded. Too many segments. Now: 3; Max: 3');
});
