/**
 * Шаблон без групп (?<=…) и (?<!…): скобки считаются с учётом экранирования и
 * классов символов, потому что внутри [] скобка это просто символ
 */
export const stripLookbehind = (pattern: string): string => {
    let result = '';
    let inClass = false;
    let index = 0;
    while (index < pattern.length) {
        const char = pattern[index];
        const opensLookbehind =
            !inClass &&
            (pattern.startsWith('(?<=', index) ||
                pattern.startsWith('(?<!', index));
        if (!opensLookbehind) {
            if (char === '\\') {
                result += pattern.slice(index, index + 2);
                index += 2;
                continue;
            }
            if (char === '[') {
                inClass = true;
            } else if (char === ']') {
                inClass = false;
            }
            result += char;
            index += 1;
            continue;
        }
        index = skipGroup(pattern, index);
    }
    return result;
};

/** Позиция сразу за группой, которая открывается на start */
const skipGroup = (pattern: string, start: number): number => {
    let depth = 0;
    let inClass = false;
    for (let index = start; index < pattern.length; index += 1) {
        const char = pattern[index];
        if (char === '\\') {
            index += 1;
        } else if (inClass) {
            inClass = char !== ']';
        } else if (char === '[') {
            inClass = true;
        } else if (char === '(') {
            depth += 1;
        } else if (char === ')') {
            depth -= 1;
            if (depth === 0) {
                return index + 1;
            }
        }
    }
    return pattern.length;
};

/** Литерал с lookbehind как выражение, которое старый Safari разбирает */
export const guardedRegExp = (pattern: string, flags: string): string => {
    const fallback = JSON.stringify(stripLookbehind(pattern));
    return `(() => { try { return new RegExp(${JSON.stringify(pattern)}, ${JSON.stringify(flags)}); } catch { return new RegExp(${fallback}, ${JSON.stringify(flags)}); } })()`;
};
