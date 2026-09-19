import {
    history,
    insertNewlineAndIndent,
    redo,
    standardKeymap,
    undo,
} from '@codemirror/commands';
import {
    EditorState,
    Prec,
    Transaction,
    type AnnotationType,
    type Extension,
} from '@codemirror/state';
import { EditorView, keymap, type KeyBinding } from '@codemirror/view';
import { ExternalChange } from '@uiw/react-codemirror';

export type PromptEditorOptions = {
    /** Текст плейсхолдера, он же доступное имя: у contenteditable aria-placeholder имени не даёт. */
    label: string;
    onSubmit: () => void;
};

/**
 * Откат чата не должен доезжать до отката проекта: глобальный mod+z в шапке
 * слушает document и включён для contenteditable, поэтому событие гасим здесь.
 * preventDefault нужен не ради браузера: без него событие уходит наверх, когда
 * undo вернул false, то есть при пустой истории и на время работы агента.
 */
const PROMPT_HISTORY_KEYMAP: KeyBinding[] = [
    { key: 'Mod-z', run: undo, preventDefault: true, stopPropagation: true },
    {
        key: 'Mod-y',
        mac: 'Mod-Shift-z',
        run: redo,
        preventDefault: true,
        stopPropagation: true,
    },
    {
        linux: 'Ctrl-Shift-z',
        run: redo,
        preventDefault: true,
        stopPropagation: true,
    },
];

/**
 * Этой аннотацией @uiw метит запись value снаружи.
 * Приводим тип руками: ts-jest берёт объявления @uiw из cjs, а @codemirror/state
 * из esm, и один и тот же тип аннотации приезжает двумя несовместимыми копиями.
 */
export const externalValueWrite =
    ExternalChange as unknown as AnnotationType<boolean>;

/** Внешняя подстановка значения (очистка после отправки, промпт с ошибками, возврат при PromptTooLong) не её история. */
const KEEP_EXTERNAL_CHANGES_OUT_OF_HISTORY = EditorState.transactionExtender.of(
    (transaction) =>
        transaction.annotation(externalValueWrite)
            ? { annotations: Transaction.addToHistory.of(false) }
            : null
);

export const promptEditorExtensions = (
    options: PromptEditorOptions
): Extension[] => [
    history(),
    KEEP_EXTERNAL_CHANGES_OUT_OF_HISTORY,
    // highest, иначе Enter достался бы standardKeymap и вместо отправки переносил строку
    Prec.highest(
        keymap.of([
            ...PROMPT_HISTORY_KEYMAP,
            {
                key: 'Enter',
                run: (view) => {
                    // пустой запрос никуда не идёт, а на время прогона поле только на чтение;
                    // preventDefault всё равно съест Enter, и переноса строки не будет
                    if (
                        view.state.readOnly ||
                        !view.state.doc.toString().trim()
                    ) {
                        return false;
                    }
                    options.onSubmit();
                    return true;
                },
                shift: insertNewlineAndIndent,
                preventDefault: true,
            },
        ])
    ),
    // без стандартной раскладки поле теряет Mod-A, удаление слова и переходы в начало и конец строки
    keymap.of(standardKeymap),
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({
        // в CodeMirror проверка орфографии выключена по умолчанию, а в textarea её давал браузер
        spellcheck: 'true',
        'aria-label': options.label,
        // по атрибуту плейсхолдера поле ищут существующие тесты, aria-placeholder им не подходит
        placeholder: options.label,
    }),
];
