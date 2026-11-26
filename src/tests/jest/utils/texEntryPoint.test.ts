import type { Segment } from '../../../model/domain.ts';
import {
    isTexDocumentPart,
    texEntryPointStatus,
    texIncludeLine,
} from '../../../viewModel/utils/texEntryPoint.ts';

/** GH-246: попадёт ли файл .tex в PDF, который собирается из сегментов */

const latex = (text: string): Segment => ({
    type: 'latex',
    text,
    parameters: { visible: true },
});

const md = (text: string): Segment => ({
    type: 'md',
    text,
    parameters: { visible: true },
});

test.each([
    ['chapter.tex', true],
    ['parts/intro.TEX', true],
    ['figure.tikz', true],
    ['styles/my.sty', false],
    ['thesis.cls', false],
    ['notes.txt', false],
    ['.tex', false],
] as const)('%s-is-a-document-part-%s', (path, expected) => {
    expect(isTexDocumentPart(path)).toBe(expected);
});

test('root-main-tex-is-replaced-by-the-one-built-from-segments', () => {
    expect(texEntryPointStatus([latex('\\input{main}')], 'main.tex')).toEqual({
        kind: 'replacedByMain',
    });
    expect(texEntryPointStatus([], '/Main.tex')).toEqual({
        kind: 'replacedByMain',
    });
    // в папке это обычный файл, сервер его не трогает
    expect(texEntryPointStatus([], 'parts/main.tex')).toEqual({
        kind: 'notIncluded',
    });
});

test.each([
    ['\\input{chapter.tex}', 'chapter.tex'],
    ['\\input{chapter}', 'chapter.tex'],
    ['\\include{ ./parts/intro }', 'parts/intro.tex'],
    ['\\subfile{parts/intro.tex}', 'parts/intro.tex'],
    ['\\InputIfFileExists{figure.tikz}', 'figure.tikz'],
])('%s-includes-%s', (command, path) => {
    expect(
        texEntryPointStatus(
            [md('\\input{other}'), latex(`a\n${command}`)],
            path
        )
    ).toEqual({ kind: 'included', segmentIndex: 1, line: 2 });
});

test('include-in-a-comment-or-another-segment-type-does-not-count', () => {
    const segments = [
        md('\\input{chapter}'),
        latex('% \\input{chapter}\nтекст % и \\include{chapter}'),
    ];
    expect(texEntryPointStatus(segments, 'chapter.tex')).toEqual({
        kind: 'notIncluded',
    });
    // экранированный процент комментарий не начинает
    expect(
        texEntryPointStatus([latex('50\\% \\input{chapter}')], 'chapter.tex')
    ).toEqual({ kind: 'included', segmentIndex: 0, line: 1 });
});

test('another-file-with-the-same-start-is-not-included', () => {
    expect(
        texEntryPointStatus([latex('\\input{chapter2}')], 'chapter.tex')
    ).toEqual({ kind: 'notIncluded' });
    expect(
        texEntryPointStatus([latex('\\input{intro}')], 'parts/intro.tex')
    ).toEqual({ kind: 'notIncluded' });
});

test('include-line-keeps-the-project-path', () => {
    expect(texIncludeLine('/parts/intro.tex')).toBe('\\input{parts/intro.tex}');
});
