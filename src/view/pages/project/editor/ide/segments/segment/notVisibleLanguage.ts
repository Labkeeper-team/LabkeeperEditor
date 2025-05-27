import { LRLanguage, LanguageSupport } from '@codemirror/language';
import { parser } from '@lezer/javascript';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorView } from '@uiw/react-codemirror';

// Создаем стили подсветки с светло-серым цветом для всех элементов
const highlighting = HighlightStyle.define([
    // Базовые элементы
    { tag: tags.keyword, color: '#CCCCCC' },
    { tag: tags.atom, color: '#CCCCCC' },
    { tag: tags.name, color: '#CCCCCC' },
    { tag: tags.deleted, color: '#CCCCCC' },
    { tag: tags.inserted, color: '#CCCCCC' },
    { tag: tags.modifier, color: '#CCCCCC' },
    { tag: tags.meta, color: '#CCCCCC' },

    // Операторы и разделители
    { tag: tags.operator, color: '#CCCCCC' },
    { tag: tags.separator, color: '#CCCCCC' },
    { tag: tags.bracket, color: '#CCCCCC' },

    // Переменные и функции
    { tag: tags.variableName, color: '#CCCCCC' },
    { tag: tags.propertyName, color: '#CCCCCC' },
    { tag: tags.function(tags.variableName), color: '#CCCCCC' },
    { tag: tags.typeName, color: '#CCCCCC' },
    { tag: tags.className, color: '#CCCCCC' },
    { tag: tags.namespace, color: '#CCCCCC' },

    // Литералы
    { tag: tags.literal, color: '#CCCCCC' },
    { tag: tags.string, color: '#CCCCCC' },
    { tag: tags.number, color: '#CCCCCC' },
    { tag: tags.bool, color: '#CCCCCC' },
    { tag: tags.regexp, color: '#CCCCCC' },

    // Комментарии и документация
    { tag: tags.comment, color: '#CCCCCC' },
    { tag: tags.lineComment, color: '#CCCCCC' },
    { tag: tags.blockComment, color: '#CCCCCC' },
    { tag: tags.docComment, color: '#CCCCCC' },

    // Специальные элементы
    { tag: tags.invalid, color: '#CCCCCC' },
    { tag: tags.changed, color: '#CCCCCC' },
    { tag: tags.emphasis, color: '#CCCCCC' },
    { tag: tags.strong, color: '#CCCCCC' },
    { tag: tags.link, color: '#CCCCCC' },
    { tag: tags.heading, color: '#CCCCCC' },
]);

// Создаем определение языка
const notVisibleLanguage = LRLanguage.define({
    name: 'notVisible',
    parser: parser,
    languageData: {
        closeBrackets: { brackets: ['(', '[', '{', '"', "'"] },
    },
});

// Базовый стиль для всего текста
const baseTheme = EditorView.theme({
    '&': {
        color: '#CCCCCC !important',
    },
    '.cm-content': {
        color: '#CCCCCC !important',
    },
    '.cm-line': {
        color: '#CCCCCC !important',
    },
    '.cm-gutters': {
        color: '#CCCCCC !important',
    },
    '.cm-activeLineGutter': {
        color: '#CCCCCC !important',
    },
    '.cm-selectionBackground': {
        backgroundColor: 'rgba(204, 204, 204, 0.1) !important',
    },
    '.cm-cursor': {
        borderLeftColor: '#CCCCCC !important',
    },
});

// Экспортируем поддержку языка для использования в редакторе
export const notVisibleLanguageSupport = new LanguageSupport(
    notVisibleLanguage,
    [syntaxHighlighting(highlighting), baseTheme]
);
