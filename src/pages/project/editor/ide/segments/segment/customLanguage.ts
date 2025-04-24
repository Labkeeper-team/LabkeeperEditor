import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { parser } from '@lezer/javascript';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import {
    autocompletion,
    CompletionContext,
    CompletionResult,
    Completion,
} from '@codemirror/autocomplete';
import { editorHelpItems } from '../../../../../../shared/help';

// Определяем математические функции
const mathFunctions = [
    'sin',
    'sinh',
    'arcsin',
    'asin',
    'asinh',
    'arcsinh',
    'cos',
    'cosh',
    'arccos',
    'acos',
    'acosh',
    'arccosh',
    'tan',
    'tanh',
    'atan',
    'atanh',
    'arctan',
    'arctanh',
    'cot',
    'arccot',
    'coth',
    'arccoth',
    'sec',
    'asec',
    'arcsec',
    'sech',
    'asech',
    'arcsech',
    'csc',
    'acsc',
    'arccsc',
    'csch',
    'acsch',
    'arccsch',
    'exp',
    'ln',
    'log',
    'sqrt',
    'pow',
    'abs',
];

const customFunctions = [
    'least_squares',
    'plot',
    'graph',
    'min',
    'max',
    'range',
    'table',
    'load_csv',
    'save_csv',
    'slice',
    'value',
    'zeros',
    'sum',
];

// Создаем стили подсветки
const highlighting = HighlightStyle.define([
    { tag: tags.string, color: '#2A00FF' },
    { tag: tags.comment, color: '#3F7F5F' },
    { tag: tags.number, color: '#0000FF' },
    { tag: tags.operator, color: '#000000' },
    { tag: tags.variableName, color: '#000000' },
    { tag: tags.function(tags.variableName), color: '#000000' },
]);

// Создаем функцию автодополнения
const customCompletion = autocompletion({
    activateOnTyping: false,
    override: [
        (context: CompletionContext): CompletionResult | null => {
            const word = context.matchBefore(/\w*/);
            if (!word) return null;

            /*
            TODO https://github.com/Labkeeper-team/TypeThree/issues/167
             */
            const options: Completion[] = [
                ...mathFunctions.map((func) => ({
                    label: func,
                    type: 'function',
                    boost: 1,
                    apply: func + '()',
                })),
                ...customFunctions.map((func) => ({
                    label: func,
                    type: 'function',
                    boost: 1.5,
                    apply: func + '()',
                })),
                ...editorHelpItems.map(item => ({
                    label: item.description,
                    type: 'hint',
                    boost: 2,
                    apply: item.text,
                }))
            ];

            return {
                from: word.from,
                options,
            };
        },
    ],
});

// Создаем определение языка
const customLanguage = LRLanguage.define({
    name: 'customPython',
    parser: parser,
    languageData: {
        closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    },
});

// Экспортируем поддержку языка для использования в редакторе
export const customLanguageSupport = new LanguageSupport(customLanguage, [
    syntaxHighlighting(highlighting),
    customCompletion,
]);
