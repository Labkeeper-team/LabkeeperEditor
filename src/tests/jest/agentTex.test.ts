import { agentTex } from '../../view/utils/agentTex.ts';

test('ordinary formula goes to MathJax as it is', () => {
    const tex = '\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1';
    expect(agentTex(tex)).toBe(tex);
});

// MathJax на странице один: определение из ответа агента поменяло бы формулы в результате
test.each([
    ['\\def\\cdot{+}'],
    ['\\gdef\\x{1}'],
    ['\\edef\\x{1}'],
    ['\\xdef\\x{1}'],
    ['\\let\\frac\\sqrt'],
    ['\\futurelet\\a\\b'],
    ['\\global\\def\\x{1}'],
    ['\\newcommand{\\R}{\\mathbb{R}}'],
    ['\\newcommand*{\\R}{\\mathbb{R}}'],
    ['\\renewcommand{\\frac}[2]{#2/#1}'],
    ['\\providecommand{\\R}{x}'],
    ['\\newenvironment{e}{}{}'],
    ['\\renewenvironment{cases}{}{}'],
    ['\\DeclareMathOperator{\\tr}{tr}'],
    ['\\Newextarrow{\\x}{5,5}{0x2192}'],
    ['\\definecolor{red}{rgb}{0,1,0}'],
    ['\\require{setoptions}'],
    ['\\setOptions[tex]{tags}{ams}'],
    ['\\unicode[Wingdings]{x2211}'],
    ['\\DeclarePairedDelimiter\\frac{[}{]}'],
    ['\\DeclarePairedDelimiterX\\sqrt[1]{(}{)}{#1}'],
    ['\\DeclarePairedDelimitersXPP\\x[1]{}{(}{)}{}{#1}'],
    ['\\newtagform{b}{[}{]}'],
    ['\\renewtagform{b}{[}{]}'],
    ['\\usetagform{b}'],
    ['\\mathtoolsset{showonlyrefs}'],
])('definition %s is shown as code', (tex) => {
    expect(agentTex(`a + ${tex} b`)).toBeNull();
});

// эти команды выводят за пределы формулы: ссылка, стиль, запрос за картинкой курсора
test.each([
    ['\\href{https://example.com}{x}'],
    ['\\style{cursor:url(https://example.com/c.png),auto}{x}'],
    ['\\class{agent-chat}{x}'],
    ['\\cssId{root}{x}'],
    ['\\data{x=1}{y}'],
    ['\\bbox[position:fixed]{x}'],
    ['\\mmlToken{mi}[href="https://example.com"]{x}'],
])('command %s is shown as code', (tex) => {
    expect(agentTex(tex)).toBeNull();
});

test('similar longer command names are not blocked', () => {
    const tex = '\\defined + \\letter + \\hrefs + \\unicodes';
    expect(agentTex(tex)).toBe(tex);
});

// обратная кавычка запускает AsciiMath, а тот пропускает id и class
test('formula with a backtick is shown as code', () => {
    expect(agentTex('a `class(agent-chat)(x)` b')).toBeNull();
});
