import type { Segment } from '../../../model/domain.ts';
import {
    isTexDocumentPart,
    texEntryNoteKind,
    texIncludeLine,
} from '../../../viewModel/utils/texEntryPoint.ts';

/**
 * GH-246: подсказка над файлом .tex. Над main.tex в корне она предупреждает,
 * что сегменты не учитываются, а подключить файл предлагает только новичку:
 * в проекте нет main.tex, и сегменты не подключают ни одного файла
 */

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

test('root-main-tex-warns-that-segments-are-ignored', () => {
    expect(
        texEntryNoteKind([latex('\\input{chapter}')], ['main.tex'], 'main.tex')
    ).toBe('mainIgnoresSegments');
    expect(texEntryNoteKind([], ['/main.tex'], '/main.tex')).toBe(
        'mainIgnoresSegments'
    );
    // в папке это обычный файл, сервер собирает документ не из него
    expect(texEntryNoteKind([], ['parts/main.tex'], 'parts/main.tex')).toBe(
        'suggestInclude'
    );
});

test('a-beginner-is-offered-to-include-the-file', () => {
    expect(
        texEntryNoteKind(
            [latex('Введение\n\\end{document}'), md('\\input{chapter}')],
            ['chapter.tex', 'figure.png'],
            'chapter.tex'
        )
    ).toBe('suggestInclude');
});

test('with-root-main-tex-other-files-get-no-note', () => {
    expect(
        texEntryNoteKind(
            [latex('Введение')],
            ['main.tex', 'chapter.tex'],
            'chapter.tex'
        )
    ).toBeNull();
    expect(
        texEntryNoteKind(
            [latex('Введение')],
            ['/main.tex', 'chapter.tex'],
            'chapter.tex'
        )
    ).toBeNull();
});

test.each([
    '\\input{other.tex}',
    '\\input other',
    '\\include{ ./parts/intro }',
    '\\subfile{parts/intro.tex}',
    '\\InputIfFileExists{figure.tikz}{}{}',
])('any-include-in-segments-hides-the-note-%s', (command) => {
    expect(
        texEntryNoteKind(
            [latex('Введение'), latex(`a\n${command}`)],
            ['chapter.tex', 'other.tex'],
            'chapter.tex'
        )
    ).toBeNull();
});

test('commands-that-include-nothing-keep-the-note', () => {
    const segments = [
        md('\\input{chapter}'),
        latex(
            '% \\input{chapter}\nтекст % и \\include{chapter}\n\\includegraphics{a.png}\n\\includeonly{x}\n\\inputencoding{utf8}'
        ),
    ];
    expect(texEntryNoteKind(segments, ['chapter.tex'], 'chapter.tex')).toBe(
        'suggestInclude'
    );
    // экранированный процент комментарий не начинает
    expect(
        texEntryNoteKind(
            [latex('50\\% \\input{chapter}')],
            ['chapter.tex'],
            'chapter.tex'
        )
    ).toBeNull();
});

test('files-that-are-not-document-parts-get-no-note', () => {
    expect(texEntryNoteKind([], ['my.sty'], 'my.sty')).toBeNull();
    expect(texEntryNoteKind([], ['notes.txt'], 'notes.txt')).toBeNull();
});

test('include-line-keeps-the-project-path', () => {
    expect(texIncludeLine('/parts/intro.tex')).toBe('\\input{parts/intro.tex}');
});
