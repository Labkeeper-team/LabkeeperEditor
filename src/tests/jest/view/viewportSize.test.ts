import {
    isPinchZoomed,
    unzoomedViewportHeight,
} from '../../../view/utils/viewportSize.ts';

// Замеры из Chrome 124 на эмуляторе Android 15, Chromium с эмуляцией Pixel 7 и Safari симулятора iOS 26.5
const ANDROID = { width: 412.1905, height: 783.2381, scale: 1 };
const ANDROID_KEYBOARD = { width: 412.19, height: 471.238, scale: 1 };
const ANDROID_PINCH_2X = { width: 206.095, height: 391.619, scale: 2 };
const ANDROID_PINCH_2X_KEYBOARD = { width: 206.095, height: 235.619, scale: 2 };
const PIXEL_7_PINCH_2X = {
    width: 205.99996948242188,
    height: 419.49993896484375,
    scale: 2.000000238418579,
};
const IPHONE_PINCH_2X = { width: 201, height: 357, scale: 2 };
const DESKTOP_SITE = { width: 980.00006, height: 1995.6796875, scale: 0.4204 };
const DESKTOP_SITE_PINCH_2X = {
    width: 490.00006,
    height: 997.84,
    scale: 0.8408,
};
const IPHONE_WIDTH_980 = { width: 980, height: 1741, scale: 0.4102 };
// расчётный случай: 1080 пикселей при DPR 2.75 дают 392.73, а clientWidth округлён вверх
const ROUNDED_UP_LAYOUT = { width: 392.727, height: 800.4, scale: 1 };

describe('unzoomedViewportHeight', () => {
    test.each([
        ['Android без клавиатуры', ANDROID, 412, 783, 783],
        ['Android, клавиатура сжала вьюпорт', ANDROID_KEYBOARD, 412, 471, 471],
        ['Android, щипок 2x', ANDROID_PINCH_2X, 412, 783, 783],
        [
            'Android, щипок 2x и клавиатура',
            ANDROID_PINCH_2X_KEYBOARD,
            412,
            471,
            471,
        ],
        ['эмуляция Pixel 7, щипок 2x', PIXEL_7_PINCH_2X, 412, 839, 839],
        [
            'iOS, щипок 2x, innerHeight тоже сжат',
            IPHONE_PINCH_2X,
            402,
            357,
            714,
        ],
        ['«Версия для ПК», раскладка 980', DESKTOP_SITE, 980, 1996, 1996],
        ['щипок 2x в «Версии для ПК»', DESKTOP_SITE_PINCH_2X, 980, 1996, 1996],
        ['iOS, раскладка 980', IPHONE_WIDTH_980, 980, 1741, 1741],
        ['clientWidth округлён вверх', ROUNDED_UP_LAYOUT, 393, 800, 800],
    ])('%s', (_name, visualViewport, layoutWidth, innerHeight, expected) => {
        expect(
            unzoomedViewportHeight(visualViewport, layoutWidth, innerHeight)
        ).toBe(expected);
    });

    test('без visualViewport берёт innerHeight', () => {
        expect(unzoomedViewportHeight(undefined, 412, 700.4)).toBe(700);
        expect(unzoomedViewportHeight(null, 412, 700.6)).toBe(701);
    });

    test('неактивный документ отдаёт нули, тогда тоже innerHeight', () => {
        expect(unzoomedViewportHeight({ width: 0, height: 0 }, 412, 839)).toBe(
            839
        );
    });
});

// от этого решения зависит сброс прокрутки: при зуме он отдёргивал бы панораму на iOS
describe('isPinchZoomed', () => {
    test.each([
        ['Android в покое', ANDROID, 412, false],
        ['Android, клавиатура', ANDROID_KEYBOARD, 412, false],
        ['Android, щипок 2x', ANDROID_PINCH_2X, 412, true],
        [
            'Android, щипок 2x и клавиатура',
            ANDROID_PINCH_2X_KEYBOARD,
            412,
            true,
        ],
        ['лёгкий щипок 1.05x', { width: 392.38, height: 746 }, 412, true],
        ['iOS, щипок 2x', IPHONE_PINCH_2X, 402, true],
        ['«Версия для ПК» в покое', DESKTOP_SITE, 980, false],
        ['щипок 2x в «Версии для ПК»', DESKTOP_SITE_PINCH_2X, 980, true],
        ['clientWidth округлён вверх', ROUNDED_UP_LAYOUT, 393, false],
        ['без visualViewport', undefined, 412, false],
    ])('%s', (_name, visualViewport, layoutWidth, expected) => {
        expect(isPinchZoomed(visualViewport, layoutWidth)).toBe(expected);
    });
});
