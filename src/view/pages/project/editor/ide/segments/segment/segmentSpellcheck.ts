import { linter, type Diagnostic } from '@codemirror/lint';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import SpellcheckWorker from './spellcheckWorker.ts?worker';
import type {
    SpellcheckAnswer,
    SpellcheckMode,
    SpellcheckRange,
} from './spellcheckProtocol.ts';

/**
 * Клиент воркера проверки орфографии. Сами словари и разбор слов живут в
 * воркере: на главном потоке их сборка занимала несколько секунд, и всё это
 * время страница не отвечала. Здесь остаётся только переписка и разметка.
 */

const pending = new Map<number, (ranges: SpellcheckRange[]) => void>();
let requestId = 0;
/** undefined значит ещё не создавали, null значит создать не вышло */
let worker: Worker | null | undefined;

function forgetPending() {
    for (const resolve of pending.values()) {
        resolve([]);
    }
    pending.clear();
}

function spellcheckWorker(): Worker | null {
    if (worker !== undefined) {
        return worker;
    }
    try {
        const created = new SpellcheckWorker();
        created.onmessage = (event: MessageEvent<SpellcheckAnswer>) => {
            const resolve = pending.get(event.data.id);
            if (!resolve) {
                return;
            }
            pending.delete(event.data.id);
            resolve(event.data.ranges);
        };
        created.onerror = () => {
            // воркер умер: подчёркивать нечем, но редактор должен работать
            worker = null;
            forgetPending();
        };
        worker = created;
    } catch {
        worker = null;
    }
    return worker;
}

function checkText(
    mode: SpellcheckMode,
    text: string
): Promise<SpellcheckRange[]> {
    const target = spellcheckWorker();
    if (!target) {
        return Promise.resolve([]);
    }
    requestId += 1;
    const id = requestId;
    return new Promise((resolve) => {
        pending.set(id, resolve);
        target.postMessage({ id, mode, text });
    });
}

function toDiagnostic(range: SpellcheckRange): Diagnostic {
    return {
        from: range.from,
        to: range.to,
        severity: 'error',
        message: '',
        markClass: '',
    };
}

function spellLintSource(mode: SpellcheckMode) {
    return async (view: EditorView): Promise<readonly Diagnostic[]> => {
        const ranges = await checkText(mode, view.state.doc.toString());
        return ranges.map(toDiagnostic);
    };
}

function spellLinter(mode: SpellcheckMode): Extension {
    return linter(spellLintSource(mode), {
        delay: 550,
        tooltipFilter: (diagnostics) =>
            diagnostics.filter((d) => d.markClass !== 'cm-lint-spell'),
    });
}

let cachedMdSpellLint: Extension | null = null;
let cachedLatexSpellLint: Extension | null = null;
let cachedComputationalSpellLint: Extension | null = null;

/**
 * Hunspell (en + ru) через nspell + @codemirror/lint.
 * Включается только для markdown-сегментов: в code/LaTeX будет много ложных срабатываний.
 */
export function getMarkdownSpellcheckLint(): Extension {
    if (!cachedMdSpellLint) {
        cachedMdSpellLint = spellLinter('md');
    }
    return cachedMdSpellLint;
}

/**
 * Hunspell (en + ru) для LaTeX. Маскируем команды/формулы/комментарии,
 * чтобы проверять только обычный текст.
 */
export function getLatexSpellcheckLint(): Extension {
    if (!cachedLatexSpellLint) {
        cachedLatexSpellLint = spellLinter('latex');
    }
    return cachedLatexSpellLint;
}

/**
 * Hunspell (en + ru) для вычислительных сегментов. Маскируем формульный
 * и служебный синтаксис, проверяем только обычный текст.
 */
export function getComputationalSpellcheckLint(): Extension {
    if (!cachedComputationalSpellLint) {
        cachedComputationalSpellLint = spellLinter('computational');
    }
    return cachedComputationalSpellLint;
}
