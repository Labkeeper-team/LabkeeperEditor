import { ExistingHotkey, HotkeyCode } from './catalog.ts';

export const HINT_SELECTOR = '[data-hotkey]';

export type HintCode = HotkeyCode | ExistingHotkey;

/**
 * Атрибуты кнопки, у которой есть сочетание: при наведении всплывает подсказка с клавишами.
 * label для кнопок-значков; у кнопки с текстом подсказка показывает только клавиши.
 * place: 'top', если под кнопкой подсказка закрыла бы что-то нужное
 */
export const hotkeyHint = (code: HintCode, label?: string, place?: 'top') => ({
    'data-hotkey': code,
    'data-hotkey-label': label,
    'data-hotkey-place': place,
});
