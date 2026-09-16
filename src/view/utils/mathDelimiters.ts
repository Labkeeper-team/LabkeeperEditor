type MathGroups = {
    display?: string;
    inline?: string;
    indent?: string;
    dollars?: string;
};

// Код идёт первым, чтобы скобки в нём остались текстом программы. Двойной
// обратный слеш тоже: иначе \\[2pt] внутри формулы откроет новую формулу.
// Формула не заходит в код и в следующую скобку, иначе непарная \[ в тексте
// утащила бы в формулу всё до чужой \]. Каждый символ разбирается одним
// способом, иначе на незакрытой скобке перебор растёт экспоненциально
const MATH_PATTERN =
    /^[ \t]*(?<fence>`{3,}(?!`)|~{3,}(?!~))[^\n]*(?:\n[\s\S]*?)?(?:\n[ \t]*\k<fence>[`~]*[ \t]*$|(?![\s\S]))|(?<ticks>`+)(?!`)(?:[^`\n]|\n(?![ \t]*\n))*?\k<ticks>(?!`)|`+|\\\\|\\\[(?<display>(?:\\[^[\]]|(?!```|~~~)[^\\])+?)\\\]|\\\((?<inline>(?:\\[^(`\n)]|[^\\`\n])+?)\\\)|^(?<indent>[ \t]*)\$\$(?<dollars>[^$\n]+)\$\$[ \t]*$/gm;

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
    const { display, inline, indent, dollars } = (found.groups ??
        {}) as MathGroups;
    const start = found.index ?? 0;
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
 * Формула одна на строке становится блоком, иначе $$ x $$ рисуется мелко, как строчная
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
