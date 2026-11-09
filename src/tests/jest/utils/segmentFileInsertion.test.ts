import {
    insertOnOwnLine,
    segmentAcceptedFileKinds,
    segmentFileKind,
    segmentFileSnippet,
} from '../../../viewModel/utils/segmentFileInsertion.ts';

/** GH-230: что значит файл, вставленный или брошенный в сегмент */

test.each([
    ['photo.png', 'image/png', 'image'],
    ['scan.JPG', 'image/jpeg', 'image'],
    ['data.csv', 'text/csv', 'csv'],
    ['DATA.CSV', '', 'csv'],
    ['chapter.tex', 'application/x-tex', 'tex'],
    ['chapter.tex', '', 'tex'],
    ['notes.txt', 'text/plain', null],
    ['report.pdf', 'application/pdf', null],
    ['archive', '', null],
] as const)('file-%s-of-type-%s-is-%s', (name, type, kind) => {
    expect(segmentFileKind(name, type)).toBe(kind);
});

test('computation-takes-images-and-csv-but-not-tex', () => {
    expect(segmentAcceptedFileKinds('computational', 'latex')).toEqual([
        'image',
        'csv',
    ]);
});

test('latex-segment-takes-tex-only-in-a-latex-project', () => {
    expect(segmentAcceptedFileKinds('latex', 'latex')).toEqual([
        'image',
        'tex',
    ]);
    // в проекте Markdown LaTeX не компилируется, и \input там ничего не подключит
    expect(segmentAcceptedFileKinds('latex', 'markdown')).toEqual(['image']);
});

test('markdown-takes-images-and-other-segments-take-nothing', () => {
    expect(segmentAcceptedFileKinds('md', 'markdown')).toEqual(['image']);
    expect(segmentAcceptedFileKinds('asciimath', 'latex')).toEqual([]);
    expect(segmentAcceptedFileKinds('mermaid', 'latex')).toEqual([]);
    expect(segmentAcceptedFileKinds(undefined, 'latex')).toEqual([]);
});

test('snippet-of-each-kind', () => {
    const url = 'https://files.labkeeper.test/a.png';
    expect(segmentFileSnippet('tex', 'latex', url, 'file_seg2_ab.tex')).toBe(
        '\\input{file_seg2_ab.tex}'
    );
    expect(
        segmentFileSnippet('csv', 'computational', url, 'file_seg3_cd.csv')
    ).toBe('load_csv("file_seg3_cd.csv")');
    expect(segmentFileSnippet('image', 'md', url, 'x.png')).toBe(
        `!['image.png'](${url})`
    );
    expect(segmentFileSnippet('image', 'latex', url, 'x.png')).toBe(
        `\\begin{center}\n\\includegraphics{${url}}\n\\end{center}`
    );
    expect(segmentFileSnippet('image', 'computational', url, 'x.png')).toBe(
        `image("${url}")`
    );
});

test('snippet-in-an-empty-segment-has-no-blank-lines', () => {
    expect(insertOnOwnLine('', 0, '\\input{a.tex}')).toEqual({
        text: '\\input{a.tex}',
        cursor: '\\input{a.tex}'.length,
    });
});

test('snippet-in-the-middle-of-a-line-gets-its-own-line', () => {
    expect(insertOnOwnLine('abcdef', 3, 'X')).toEqual({
        text: 'abc\nX\ndef',
        cursor: 5,
    });
});

test('snippet-at-a-line-boundary-adds-no-extra-breaks', () => {
    // курсор в начале второй строки: перевод перед ним уже есть, а после вставки нужен один
    expect(insertOnOwnLine('one\ntwo', 4, 'X')).toEqual({
        text: 'one\nX\ntwo',
        cursor: 5,
    });
    // курсор в конце первой строки: перевод после вставки уже есть
    expect(insertOnOwnLine('one\ntwo', 3, 'X')).toEqual({
        text: 'one\nX\ntwo',
        cursor: 5,
    });
    expect(insertOnOwnLine('one\n', 4, 'X')).toEqual({
        text: 'one\nX',
        cursor: 5,
    });
});

test('cursor-beyond-the-text-inserts-at-the-end', () => {
    expect(insertOnOwnLine('one', 99, 'X')).toEqual({
        text: 'one\nX',
        cursor: 5,
    });
});
