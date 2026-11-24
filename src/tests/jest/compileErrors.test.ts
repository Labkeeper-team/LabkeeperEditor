import { CompileError, CompileErrorResult } from '../../model/domain.ts';
import { en } from '../../viewModel/dictionaries/en.ts';
import {
    compileErrorsPrompt,
    describeCompileError,
    requiresXelatex,
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

test('incorrect-argument-appends-english-description', () => {
    expect(
        describeCompileError(
            error(CompileError.INCORRECT_ARGUMENT, {
                segmentId: 3,
                line: 4,
                functionName: 'plot',
                description: 'x and y must have the same size',
            }),
            en
        )
    ).toBe(
        'Incorrect argument size in function plot: x and y must have the same size'
    );
});

test('function-error-without-description-stays-unchanged', () => {
    expect(
        describeCompileError(
            error(CompileError.NO_SUCH_FUNCTION, {
                segmentId: 1,
                functionName: 'biba',
            }),
            en
        )
    ).toBe('No such function biba');
});

// GH-278: тексты сняты с сервера сборки (-file-line-error, max_print_line=10000)
describe('requiresXelatex', () => {
    const latexError = (latexErrorMessage: string): CompileErrorResult => ({
        code: CompileError.LATEX_ERROR,
        payload: {
            line: 101,
            position: 0,
            segmentId: null,
            latexFile:
                'usr/local/texlive/2025/texmf-dist/tex/latex/fontspec/fontspec.sty',
            latexErrorMessage,
        } as unknown as CompileErrorResult['payload'],
    });

    test.each([
        'Fatal Package fontspec Error: The fontspec package requires either XeTeX or',
        'Package unicode-math Error: Cannot be run with pdftex!',
        'LaTeX Error: *** this package currently works only with XeTeX ***',
        'Package fontsetup Error: Use Unicode-compliant TeX-engines.',
    ])('%s', (message) => {
        expect(
            requiresXelatex([
                latexError('Undefined control sequence'),
                latexError(message),
            ])
        ).toBe(true);
    });

    test('other errors do not ask for XeLaTeX', () => {
        expect(requiresXelatex(undefined)).toBe(false);
        expect(requiresXelatex([])).toBe(false);
        expect(
            requiresXelatex([
                latexError("LaTeX Error: File `missing.sty' not found."),
                // LuaLaTeX на сервере нет, XeLaTeX ему не поможет
                latexError('Package luacode Error: LuaTeX is required'),
            ])
        ).toBe(false);
        // тот же текст не в ошибке LaTeX, а, например, в описании функции
        expect(
            requiresXelatex([
                {
                    code: CompileError.INCORRECT_ARGUMENT,
                    payload: {
                        line: 0,
                        position: 0,
                        segmentId: 1,
                        description: 'requires either XeTeX or',
                        latexErrorMessage: 'requires either XeTeX or',
                    } as unknown as CompileErrorResult['payload'],
                },
            ])
        ).toBe(false);
    });
});
