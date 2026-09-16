import { normalizeMathDelimiters } from '../../view/utils/mathDelimiters.ts';

test('display formula on its own lines becomes a math block', () => {
    expect(
        normalizeMathDelimiters(
            'Вот формула:\n\n\\[\n\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1\n\\]\n\nГотово'
        )
    ).toBe(
        'Вот формула:\n\n$$\n\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1\n$$\n\nГотово'
    );
});

test('one-line display formula on its own line becomes a math block', () => {
    expect(normalizeMathDelimiters('\\[ E = mc^2 \\]')).toBe(
        '$$\nE = mc^2\n$$'
    );
});

test('display formula inside a list keeps the item indentation', () => {
    expect(normalizeMathDelimiters('1. Площадь:\n   \\[ S = a b \\]')).toBe(
        '1. Площадь:\n   $$\n   S = a b\n   $$'
    );
});

test('display formula in the middle of a line stays on that line', () => {
    expect(normalizeMathDelimiters('Итог \\[ a +\n b \\] и дальше')).toBe(
        'Итог $$a + b$$ и дальше'
    );
});

test('display formula that starts a line but has text after it stays inline', () => {
    expect(normalizeMathDelimiters('\\[ x \\] это x')).toBe('$$x$$ это x');
});

test('inline formula uses single dollars', () => {
    expect(normalizeMathDelimiters('где \\( a^2 \\) и \\(b\\)')).toBe(
        'где $a^2$ и $b$'
    );
});

test('line break with spacing inside a formula is not a delimiter', () => {
    expect(
        normalizeMathDelimiters(
            '$$\n\\begin{aligned} a \\\\[2pt] b \\end{aligned}\n$$\n\nи ещё \\[ y \\]'
        )
    ).toBe(
        '$$\n\\begin{aligned} a \\\\[2pt] b \\end{aligned}\n$$\n\nи ещё $$y$$'
    );
});

test('code keeps backslash brackets as they are', () => {
    const text =
        '```latex\n\\[ x \\]\n```\n\nи `\\(y\\)` в строке, а тут \\(z\\)';
    expect(normalizeMathDelimiters(text)).toBe(
        '```latex\n\\[ x \\]\n```\n\nи `\\(y\\)` в строке, а тут $z$'
    );
});

test('unclosed code fence protects the rest of the text', () => {
    const text = '```\n\\[ x \\]';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('own-line double dollar formula becomes a math block', () => {
    expect(normalizeMathDelimiters('Итак:\n$$ x^2 $$\nвсё')).toBe(
        'Итак:\n$$\nx^2\n$$\nвсё'
    );
});

test('double dollars inside a sentence stay inline', () => {
    const text = 'цена $$x$$ в тексте';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('unpaired bracket in text does not reach into a code block', () => {
    const text =
        'Замените \\[ на доллары:\n\n```latex\n\\[\nE = mc^2\n\\]\n```\n\nИ дальше **жирный**';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('line break with spacing inside a bracket formula stays in it', () => {
    expect(normalizeMathDelimiters('\\[ a \\\\[2pt] b \\]')).toBe(
        '$$\na \\\\[2pt] b\n$$'
    );
});

test('code span of several backticks keeps brackets', () => {
    const text = 'пишите `` \\(x\\) `` как есть';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('longer fence keeps a nested fence with brackets', () => {
    const text = '````md\n```\n\\[ x \\]\n```\n````';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('indented fence in a list keeps brackets', () => {
    const text = '- пример:\n  ```\n  \\( x \\)\n  ```';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('windows line breaks do not turn a block into an inline formula', () => {
    expect(normalizeMathDelimiters('a\r\n\\[ x \\]\r\nb')).toBe(
        'a\n$$\nx\n$$\nb'
    );
});

test('multi-line formula in a list indents every line', () => {
    expect(
        normalizeMathDelimiters(
            '- Система:\n  \\[\n\\begin{cases}\nx = 1\n\\end{cases}\n  \\]\n- Дальше'
        )
    ).toBe(
        '- Система:\n  $$\n  \\begin{cases}\n  x = 1\n  \\end{cases}\n  $$\n- Дальше'
    );
});

test('many unpaired brackets take linear time', () => {
    const text = '\\['.repeat(100000) + ' \\('.repeat(100000);
    const started = performance.now();

    expect(normalizeMathDelimiters(text)).toBe(text);
    // на квадратичном разборе это секунды
    expect(performance.now() - started).toBeLessThan(1000);
});

test('unclosed bracket before many line breaks takes linear time', () => {
    const texts = [
        '\\[\n' + 'a & b \\\\\n'.repeat(30),
        '\\(' + '\\'.repeat(40),
        '`'.repeat(200000),
        '```'.repeat(70000),
    ];
    const started = performance.now();

    for (const text of texts) {
        expect(normalizeMathDelimiters(text)).toBe(text);
    }
    // с неоднозначным разбором одна такая строка вешала вкладку на секунды
    expect(performance.now() - started).toBeLessThan(1000);
});

test('formula with a dollar inside stays as it is', () => {
    const text = 'Цена \\(x = \\$5\\) и $y$ дальше';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('formula across quote lines stays as it is', () => {
    const text = '> \\[\n> a = b\n> \\]';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('empty delimiters are left alone', () => {
    const text = 'пустые \\( \\) и \\[ \\] скобки';
    expect(normalizeMathDelimiters(text)).toBe(text);
});

test('unpaired delimiters are left alone', () => {
    const text = 'скобка \\[ без пары и \\( тоже';
    expect(normalizeMathDelimiters(text)).toBe(text);
});
