/**
 * Протокол общения с воркером проверки орфографии.
 * Отдельным файлом, чтобы главный поток не тянул за типами сам воркер.
 */

/** Чем текст отличается для проверки: в latex и в вычислениях часть надо скрыть */
export type SpellcheckMode = 'md' | 'latex' | 'computational';

export type SpellcheckRequest = {
    id: number;
    mode: SpellcheckMode;
    text: string;
};

/** Границы слова с ошибкой в исходном тексте */
export type SpellcheckRange = { from: number; to: number };

export type SpellcheckAnswer = {
    id: number;
    ranges: SpellcheckRange[];
};
