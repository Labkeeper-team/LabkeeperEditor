type MathGroups = {
    display?: string;
    inline?: string;
    indent?: string;
    dollars?: string;
    substitution?: string;
    lone?: string;
};

// Код идёт первым, чтобы скобки в нём остались текстом программы. Двойной
// обратный слеш тоже: иначе \\[2pt] внутри формулы откроет новую формулу.
// Формула не заходит в код и в следующую скобку, иначе непарная \[ в тексте
// утащила бы в формулу всё до чужой \]. Каждый символ разбирается одним
// способом, иначе на незакрытой скобке перебор растёт экспоненциально.
//
// GH-282: одиночный доллар remark-math считает началом формулы до любого
// следующего доллара. Формулой остаётся только пара по правилу pandoc: за
// открывающим долларом не пробел, перед закрывающим не пробел, а за ним не
// цифра. Так $x^2$ и $\{1, 2\}$ остаются формулами, а «$5 и $10» и шаблон
// «${a + b}» текстом. Доллары без пары экранируются. Экранированный доллар
// и подряд идущие доллары формул-блоков не трогаем
const MATH_PATTERN =
    /^[ \t]*(?<fence>`{3,}(?!`)|~{3,}(?!~))[^\n]*(?:\n[\s\S]*?)?(?:\n[ \t]*\k<fence>[`~]*[ \t]*$|(?![\s\S]))|(?<ticks>`+)(?!`)(?:[^`\n]|\n(?![ \t]*\n))*?\k<ticks>(?!`)|`+|\\\\|\\\[(?<display>(?:\\[^[\]]|(?!```|~~~)[^\\])+?)\\\]|\\\((?<inline>(?:\\[^(`\n)]|[^\\`\n])+?)\\\)|^(?<indent>[ \t]*)\$\$(?<dollars>[^$\n]+)\$\$[ \t]*$|(?<!\\)(?<substitution>\$\{[\wА-яЁё]+\})|\\\$|\${2,}|\$(?=[^\s$])(?:\\[\s\S]|[^$\\\n]|\n(?![ \t]*\n))*?(?:\\\S|[^\s$\\])\$(?![$\d])|(?<lone>\$)/gm;

// в пункте списка каждая строка блока нужна с отступом пункта, иначе блок оборвётся
const mathBlock = (indent: string, tex: string) =>
    [
        '$$',
        ...tex
            .trim()
            .split('\n')
            .map((line) => line.trimStart()),
        '$$',
    ]
        .map((line) => indent + line)
        .join('\n')
        .slice(indent.length);

/** Отступ строки, если на ней нет ничего, кроме формулы */
function ownLineIndent(text: string, start: number, end: number) {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = text.indexOf('\n', end);
    const before = text.slice(lineStart, start);
    const after = text.slice(end, lineEnd === -1 ? text.length : lineEnd);
    return /^[ \t]*$/.test(before) && /^[ \t]*$/.test(after) ? before : null;
}

function convert(text: string, found: RegExpMatchArray): string {
    const { display, inline, indent, dollars, substitution, lone } =
        (found.groups ?? {}) as MathGroups;
    const start = found.index ?? 0;
    // GH-257: подстановка ${имя} из markdown-сегмента. Её доллар remark-math
    // принимал за начало формулы до следующего доллара, и строка ломалась
    if (substitution !== undefined) {
        return `\\${substitution}`;
    }
    // GH-282: доллар без пары остаётся знаком доллара
    if (lone !== undefined) {
        return '\\$';
    }
    // доллар внутри сбил бы remark-math, а маркер цитаты попал бы в саму формулу
    if (/\$|\n[ \t]*>/.test(display ?? inline ?? '')) {
        return found[0];
    }
    if (inline?.trim()) {
        return `$${inline.trim()}$`;
    }
    if (dollars !== undefined) {
        return `${indent}${mathBlock(indent ?? '', dollars)}`;
    }
    if (display?.trim()) {
        const lineIndent = ownLineIndent(text, start, start + found[0].length);
        // перенос строки в строчной формуле опасен: $$ в начале строки открыл бы блок до конца ответа
        return lineIndent === null
            ? `$$${display.replace(/\s*\n\s*/g, ' ').trim()}$$`
            : mathBlock(lineIndent, display);
    }
    return found[0];
}

/**
 * DeepSeek пишет формулы в \[ \] и \( \), а remark-math понимает только доллары.
 * Формула одна на строке становится блоком, иначе $$ x $$ рисуется мелко, как строчная.
 * Подстановки ${имя} и доллары без пары вне кода экранируются, чтобы остаться текстом
 */
export function normalizeMathDelimiters(source: string): string {
    const text = source.replace(/\r\n?/g, '\n');
    let result = '';
    let last = 0;
    for (const found of text.matchAll(MATH_PATTERN)) {
        const start = found.index ?? 0;
        result += text.slice(last, start) + convert(text, found);
        last = start + found[0].length;
    }
    return result + text.slice(last);
}
