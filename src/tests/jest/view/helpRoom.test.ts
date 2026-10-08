import { helpRoomFor } from '../../../view/pages/project/viewer/useHelpRoom.ts';

// Высоты колонки результата сняты с настоящей вёрстки: шапка 50, зазор 8,
// помощь 258 развёрнутая и 26 свёрнутая
test.each([
    // окно 1360x900 и выше
    [840, 'any'],
    // 1360x700: чату с перепиской хватает впритык
    [640, 'any'],
    [632, 'any'],
    [631, 'empty'],
    // айфон с панелями браузера, 390x664
    [563, 'empty'],
    [548, 'empty'],
    [547, 'none'],
    // телефон с открытой клавиатурой и телефон на боку
    [399, 'none'],
    [332, 'none'],
])(
    'колонке в %ipx под развёрнутой помощью хватит места: %s',
    (height, room) => {
        expect(helpRoomFor(height, true)).toBe(room);
    }
);

test.each([
    [400, 'any'],
    [399, 'empty'],
    [316, 'empty'],
    [315, 'none'],
])('свёрнутая помощь занимает только полосу: %ipx, %s', (height, room) => {
    expect(helpRoomFor(height, false)).toBe(room);
});
