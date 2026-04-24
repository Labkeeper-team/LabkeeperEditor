import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';

// Обходим package "exports": только index.js; тянем .aff/.dic напрямую из node_modules.
import enAffUrl from '../../../../../../../../node_modules/dictionary-en/index.aff?url';
import enDicUrl from '../../../../../../../../node_modules/dictionary-en/index.dic?url';
import ruAffUrl from '../../../../../../../../node_modules/dictionary-ru/index.aff?url';
import ruDicUrl from '../../../../../../../../node_modules/dictionary-ru/index.dic?url';

import nspellFactory from 'nspell';

type NSpell = {
    correct: (word: string) => boolean;
};

const nspell = nspellFactory as unknown as (aff: string, dic: string) => NSpell;

const latinWordRe = /[A-Za-z]+(?:'[A-Za-z]+)?/g;
const cyrillicWordRe = /[\u0400-\u04FFЁё]+(?:-[\u0400-\u04FFЁё]+)*/g;

const utf8 = new TextDecoder('utf-8');

async function fetchAsUtf8(url: string): Promise<string> {
    const buf = await fetch(url).then((r) => r.arrayBuffer());
    return utf8.decode(buf);
}

let spellPromise: Promise<{ en: NSpell; ru: NSpell }> | null = null;

function loadSpellers(): Promise<{ en: NSpell; ru: NSpell }> {
    if (!spellPromise) {
        spellPromise = (async () => {
            const [enAff, enDic, ruAff, ruDic] = await Promise.all([
                fetchAsUtf8(enAffUrl),
                fetchAsUtf8(enDicUrl),
                fetchAsUtf8(ruAffUrl),
                fetchAsUtf8(ruDicUrl),
            ]);
            return {
                en: nspell(enAff, enDic),
                ru: nspell(ruAff, ruDic),
            };
        })();
    }
    return spellPromise;
}

function isWordOk(spell: NSpell, word: string): boolean {
    if (spell.correct(word)) {
        return true;
    }
    const lower = word.toLowerCase();
    if (lower !== word && spell.correct(lower)) {
        return true;
    }
    if (word.length > 1) {
        const titled =
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        if (titled !== word && spell.correct(titled)) {
            return true;
        }
    }
    return false;
}

function collectDiagnostics(
    text: string,
    en: NSpell,
    ru: NSpell
): Diagnostic[] {
    const out: Diagnostic[] = [];

    const pushIfBad = (word: string, from: number, spell: NSpell) => {
        if (word.length < 2) {
            return;
        }
        if (isWordOk(spell, word)) {
            return;
        }
        out.push({
            from,
            to: from + word.length,
            severity: 'error',
            message: '',
            markClass: '',
        });
    };

    latinWordRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = latinWordRe.exec(text)) !== null) {
        pushIfBad(m[0], m.index, en);
    }

    cyrillicWordRe.lastIndex = 0;
    while ((m = cyrillicWordRe.exec(text)) !== null) {
        pushIfBad(m[0], m.index, ru);
    }

    out.sort((a, b) => a.from - b.from);
    return out;
}

async function spellLintSource(
    view: EditorView
): Promise<readonly Diagnostic[]> {
    try {
        const { en, ru } = await loadSpellers();
        return collectDiagnostics(view.state.doc.toString(), en, ru);
    } catch {
        return [];
    }
}

let cachedMdSpellLint: Extension | null = null;
let cachedLatexSpellLint: Extension | null = null;
let cachedComputationalSpellLint: Extension | null = null;

function maskRange(chars: string[], from: number, to: number) {
    const safeFrom = Math.max(0, from);
    const safeTo = Math.min(chars.length, to);
    for (let i = safeFrom; i < safeTo; i++) {
        if (chars[i] !== '\n') {
            chars[i] = ' ';
        }
    }
}

function maskByRegex(chars: string[], text: string, re: RegExp) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        maskRange(chars, m.index, m.index + m[0].length);
        if (m[0].length === 0) {
            re.lastIndex += 1;
        }
    }
}

function latexTextForSpellcheck(text: string): string {
    const chars = text.split('');

    // Комментарии до конца строки.
    maskByRegex(chars, text, /%[^\n]*/g);
    // Математические блоки.
    maskByRegex(chars, text, /\$\$[\s\S]*?\$\$/g);
    maskByRegex(chars, text, /\$[^$\n]*\$/g);
    maskByRegex(chars, text, /\\\([\s\S]*?\\\)/g);
    maskByRegex(chars, text, /\\\[[\s\S]*?\\\]/g);
    // Команды и их "короткие" экранирования (\%, \_, \{ ...).
    maskByRegex(chars, text, /\\[A-Za-z@]+[*]?/g);
    maskByRegex(chars, text, /\\./g);

    return chars.join('');
}

function computationalTextForSpellcheck(text: string): string {
    const chars = text.split('');

    // Комментарии (частые форматы).
    maskByRegex(chars, text, /\/\/[^\n]*/g);
    maskByRegex(chars, text, /#[^\n]*/g);
    maskByRegex(chars, text, /\/\*[\s\S]*?\*\//g);

    // Формульные/инлайновые выражения.
    maskByRegex(chars, text, /\$\{[\s\S]*?\}/g);
    maskByRegex(chars, text, /\$[^$\n]*\$/g);

    // LaTeX-подобные команды, если встречаются в формулах.
    maskByRegex(chars, text, /\\[A-Za-z@]+[*]?/g);
    maskByRegex(chars, text, /\\./g);

    return chars.join('');
}

async function spellLintSourceLatex(
    view: EditorView
): Promise<readonly Diagnostic[]> {
    try {
        const { en, ru } = await loadSpellers();
        const sourceText = view.state.doc.toString();
        const preparedText = latexTextForSpellcheck(sourceText);
        return collectDiagnostics(preparedText, en, ru);
    } catch {
        return [];
    }
}

async function spellLintSourceComputational(
    view: EditorView
): Promise<readonly Diagnostic[]> {
    try {
        const { en, ru } = await loadSpellers();
        const sourceText = view.state.doc.toString();
        const preparedText = computationalTextForSpellcheck(sourceText);
        return collectDiagnostics(preparedText, en, ru);
    } catch {
        return [];
    }
}

/**
 * Hunspell (en + ru) через nspell + @codemirror/lint.
 * Включается только для markdown-сегментов: в code/LaTeX будет много ложных срабатываний.
 */
export function getMarkdownSpellcheckLint(): Extension {
    if (!cachedMdSpellLint) {
        cachedMdSpellLint = linter(spellLintSource, {
            delay: 550,
            tooltipFilter: (diagnostics) =>
                diagnostics.filter((d) => d.markClass !== 'cm-lint-spell'),
        });
    }
    return cachedMdSpellLint;
}

/**
 * Hunspell (en + ru) для LaTeX. Маскируем команды/формулы/комментарии,
 * чтобы проверять только обычный текст.
 */
export function getLatexSpellcheckLint(): Extension {
    if (!cachedLatexSpellLint) {
        cachedLatexSpellLint = linter(spellLintSourceLatex, {
            delay: 550,
            tooltipFilter: (diagnostics) =>
                diagnostics.filter((d) => d.markClass !== 'cm-lint-spell'),
        });
    }
    return cachedLatexSpellLint;
}

/**
 * Hunspell (en + ru) для вычислительных сегментов. Маскируем формульный
 * и служебный синтаксис, проверяем только обычный текст.
 */
export function getComputationalSpellcheckLint(): Extension {
    if (!cachedComputationalSpellLint) {
        cachedComputationalSpellLint = linter(spellLintSourceComputational, {
            delay: 550,
            tooltipFilter: (diagnostics) =>
                diagnostics.filter((d) => d.markClass !== 'cm-lint-spell'),
        });
    }
    return cachedComputationalSpellLint;
}
