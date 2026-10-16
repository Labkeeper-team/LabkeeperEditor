/**
 * GH-172: сочетания страницы проекта. Код уходит в OpenPanel параметром
 * hotkey события hotkey_used, поэтому он стабильный и не зависит от платформы:
 * Cmd на macOS и Ctrl на остальных дают один и тот же код
 */
export type HotkeyCode =
    | 'compile'
    | 'search_open'
    | 'search_next'
    | 'search_prev'
    | 'file_manager'
    | 'sync_to_pdf'
    | 'sync_to_editor'
    | 'segment_prev'
    | 'segment_next'
    | 'add_latex'
    | 'send_errors_to_agent'
    | 'viewer_pdf'
    | 'viewer_chat'
    | 'agent_mode';

/** Запись react-hotkeys-hook: mod это Cmd на macOS и Ctrl на остальных, клавиша по event.code */
export const PROJECT_HOTKEYS: Record<HotkeyCode, string> = {
    search_open: 'mod+f',
    search_next: 'f3',
    search_prev: 'shift+f3',
    file_manager: 'mod+shift+e',
    sync_to_pdf: 'mod+alt+j',
    sync_to_editor: 'mod+alt+k',
    segment_prev: 'alt+arrowup',
    segment_next: 'alt+arrowdown',
    add_latex: 'mod+shift+l',
    compile: 'mod+enter',
    send_errors_to_agent: 'mod+period',
    viewer_pdf: 'mod+alt+p',
    viewer_chat: 'mod+alt+c',
    agent_mode: 'mod+shift+i',
};

/** Сочетания, которые работали и до GH-172: в плашке они стоят рядом с новыми */
export type ExistingHotkey =
    | 'escape'
    | 'save'
    | 'undo'
    | 'redo'
    | 'chat_send'
    | 'chat_newline'
    | 'chat_mode';

export const EXISTING_HOTKEYS: Record<ExistingHotkey, readonly string[]> = {
    escape: ['escape'],
    save: ['mod+s'],
    undo: ['mod+z'],
    // повтор висит на ctrl+y и на macOS: там это Control, а не Cmd
    redo: ['ctrl+y', 'mod+shift+z'],
    chat_send: ['enter'],
    chat_newline: ['shift+enter'],
    chat_mode: ['shift+tab'],
};

export const isMacPlatform = (
    userAgent: string = typeof navigator === 'undefined'
        ? ''
        : navigator.userAgent
): boolean => /mac/i.test(userAgent) && !/iphone|ipad|ipod/i.test(userAgent);

const KEY_LABELS: Record<string, { mac: string; other: string }> = {
    mod: { mac: '⌘', other: 'Ctrl' },
    ctrl: { mac: '⌃', other: 'Ctrl' },
    alt: { mac: '⌥', other: 'Alt' },
    shift: { mac: '⇧', other: 'Shift' },
    enter: { mac: 'Enter', other: 'Enter' },
    escape: { mac: 'Esc', other: 'Esc' },
    tab: { mac: 'Tab', other: 'Tab' },
    period: { mac: '.', other: '.' },
    arrowup: { mac: '↑', other: '↑' },
    arrowdown: { mac: '↓', other: '↓' },
};

/** Подпись сочетания для человека: клавиши по отдельности, в порядке записи */
export const hotkeyLabel = (hotkey: string, mac: boolean): string[] =>
    hotkey.split('+').map((key) => {
        const label = KEY_LABELS[key];
        if (label) {
            return mac ? label.mac : label.other;
        }
        return key.toUpperCase();
    });
