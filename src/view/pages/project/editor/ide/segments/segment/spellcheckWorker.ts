/**
 * Проверка орфографии целиком: словари, маскировка и разбор слов.
 * Живёт в воркере, потому что сборка словарей это единственная тяжёлая
 * работа при открытии проекта: три с половиной мегабайта данных держали
 * главный поток несколько секунд, и всё это время страница не отвечала.
 */

// Обходим package "exports": только index.js; тянем .aff/.dic напрямую из node_modules.
import enAffUrl from '../../../../../../../../node_modules/dictionary-en/index.aff?url';
import enDicUrl from '../../../../../../../../node_modules/dictionary-en/index.dic?url';
import ruAffUrl from '../../../../../../../../node_modules/dictionary-ru/index.aff?url';
import ruDicUrl from '../../../../../../../../node_modules/dictionary-ru/index.dic?url';

import nspellFactory from 'nspell';
import type {
    SpellcheckAnswer,
    SpellcheckMode,
    SpellcheckRange,
    SpellcheckRequest,
} from './spellcheckProtocol.ts';

type NSpell = {
    correct: (word: string) => boolean;
};

const nspell = nspellFactory as unknown as (aff: string, dic: string) => NSpell;

/** В воркере нет window, поэтому сужаем глобаль до того, чем пользуемся */
const scope = globalThis as unknown as {
    postMessage: (answer: SpellcheckAnswer) => void;
    addEventListener: (
        type: 'message',
        handler: (event: MessageEvent<SpellcheckRequest>) => void
    ) => void;
};

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

function collectRanges(
    text: string,
    en: NSpell,
    ru: NSpell
): SpellcheckRange[] {
    const out: SpellcheckRange[] = [];

    const pushIfBad = (word: string, from: number, spell: NSpell) => {
        if (word.length < 2) {
            return;
        }
        if (isWordOk(spell, word)) {
            return;
        }
        out.push({ from, to: from + word.length });
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

function prepare(mode: SpellcheckMode, text: string): string {
    if (mode === 'latex') {
        return latexTextForSpellcheck(text);
    }
    if (mode === 'computational') {
        return computationalTextForSpellcheck(text);
    }
    return text;
}

scope.addEventListener('message', (event) => {
    const { id, mode, text } = event.data;
    loadSpellers()
        .then(({ en, ru }) => {
            scope.postMessage({
                id,
                ranges: collectRanges(prepare(mode, text), en, ru),
            });
        })
        .catch(() => {
            // словари не доехали: подчёркивать нечем, но ответить обязаны,
            // иначе линтер будет ждать этот запрос вечно
            scope.postMessage({ id, ranges: [] });
        });
});
