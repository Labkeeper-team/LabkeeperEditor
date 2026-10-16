import {
    EXISTING_HOTKEYS,
    hotkeyLabel,
    isMacPlatform,
    PROJECT_HOTKEYS,
} from '../../../view/pages/project/hotkeys/catalog.ts';

const MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15';
const IPAD =
    'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const WINDOWS =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36';

test('hotkey-codes-are-the-ones-analytics-expects', () => {
    // коды уходят в OpenPanel параметром hotkey: переименование сломало бы отчёты
    expect(Object.keys(PROJECT_HOTKEYS).sort()).toEqual(
        [
            'compile',
            'search_open',
            'search_next',
            'search_prev',
            'file_manager',
            'sync_to_pdf',
            'sync_to_editor',
            'segment_prev',
            'segment_next',
            'add_latex',
            'send_errors_to_agent',
            'viewer_pdf',
            'viewer_chat',
            'agent_mode',
        ].sort()
    );
});

test('every-hotkey-is-bound-once', () => {
    const all = [
        ...Object.values(PROJECT_HOTKEYS),
        ...Object.values(EXISTING_HOTKEYS).flat(),
    ];
    expect(new Set(all).size).toBe(all.length);
});

test('mac-is-told-from-other-platforms', () => {
    expect([
        isMacPlatform(MAC),
        isMacPlatform(IPAD),
        isMacPlatform(WINDOWS),
    ]).toEqual([true, false, false]);
});

test('hotkey-label-uses-cmd-on-mac-and-ctrl-elsewhere', () => {
    // сочетания с Alt на macOS на Control: Cmd+Option+J это консоль DevTools в Chrome
    expect(hotkeyLabel(PROJECT_HOTKEYS.sync_to_pdf, true)).toEqual([
        '⌃',
        '⌥',
        'J',
    ]);
    expect(hotkeyLabel(PROJECT_HOTKEYS.search_open, true)).toEqual(['⌘', 'F']);
    expect(hotkeyLabel(PROJECT_HOTKEYS.sync_to_pdf, false)).toEqual([
        'Ctrl',
        'Alt',
        'J',
    ]);
    expect(hotkeyLabel(PROJECT_HOTKEYS.send_errors_to_agent, false)).toEqual([
        'Ctrl',
        '.',
    ]);
    expect(hotkeyLabel(PROJECT_HOTKEYS.search_prev, false)).toEqual([
        'Shift',
        'F3',
    ]);
    expect(hotkeyLabel(PROJECT_HOTKEYS.segment_prev, true)).toEqual(['⌥', '↑']);
    // повтор на macOS остаётся на Control
    expect(hotkeyLabel(EXISTING_HOTKEYS.redo[0], true)).toEqual(['⌃', 'Y']);
});
