// MathJax на странице один с результатом проекта: определения из ответа агента
// поменяли бы формулы пользователя, а ссылки и стили выводят за пределы формулы
const UNSAFE_COMMAND =
    /\\(?:def|gdef|edef|xdef|let|futurelet|global|newcommand|renewcommand|providecommand|newenvironment|renewenvironment|DeclareMathOperator|DeclarePairedDelimiters?(?:X|XPP)?|newtagform|renewtagform|usetagform|mathtoolsset|Newextarrow|definecolor|require|setOptions|unicode|href|style|class|cssId|data|bbox|mmlToken)(?![a-zA-Z])/;

/** TeX из ответа агента, который можно отдать MathJax, или null: такую формулу показываем кодом */
export function agentTex(tex: string): string | null {
    // обратная кавычка запускает AsciiMath, а тот пропускает id и class
    if (tex.includes('`') || UNSAFE_COMMAND.test(tex)) {
        return null;
    }
    return tex;
}
