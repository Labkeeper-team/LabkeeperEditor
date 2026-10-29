import type { Plugin } from 'vite';

import { guardedRegExp } from './regexLookbehind.ts';

type RegexLiteral = {
    type: string;
    start: number;
    end: number;
    regex?: { pattern: string; flags: string };
};

const LOOKBEHIND = /\(\?<[=!]/;

const collectLookbehindLiterals = (root: unknown): RegexLiteral[] => {
    const found: RegexLiteral[] = [];
    const stack: unknown[] = [root];
    while (stack.length) {
        const value = stack.pop();
        if (!value || typeof value !== 'object') {
            continue;
        }
        if (Array.isArray(value)) {
            stack.push(...value);
            continue;
        }
        const node = value as RegexLiteral;
        if (node.type === 'Literal' && node.regex) {
            if (LOOKBEHIND.test(node.regex.pattern)) {
                found.push(node);
            }
            continue;
        }
        for (const child of Object.values(node)) {
            if (child && typeof child === 'object') {
                stack.push(child);
            }
        }
    }
    return found;
};

/**
 * Lookbehind в регулярных выражениях Safari понимает с 16.4. Литерал с ним
 * старый Safari не может даже разобрать, и падает весь модуль: так на iOS 15
 * не открывалась страница проекта из-за автоссылок на почту в
 * mdast-util-gfm-autolink-literal 2.0.1
 *
 * Литерал заменяется созданием через new RegExp: где lookbehind есть,
 * выражение то же самое, а где нет, без групп lookbehind. Так проверка
 * становится мягче, зато страница открывается. В автоссылках символ перед
 * адресом ещё раз проверяет сама библиотека
 */
export const guardRegexLookbehind = (): Plugin => ({
    name: 'labkeeper:guard-regex-lookbehind',
    apply: 'build',
    enforce: 'post',
    transform(code) {
        if (!LOOKBEHIND.test(code)) {
            return null;
        }
        const literals = collectLookbehindLiterals(this.parse(code));
        if (!literals.length) {
            return null;
        }
        let result = code;
        // с конца, чтобы начала ещё не тронутых литералов не сдвигались
        for (const literal of literals.sort((a, b) => b.start - a.start)) {
            const { pattern, flags } = literal.regex!;
            result = `${result.slice(0, literal.start)}${guardedRegExp(pattern, flags)}${result.slice(literal.end)}`;
        }
        // строки не сдвигаются, поэтому карту модуля не пересчитываем
        return { code: result, map: null };
    },
});
