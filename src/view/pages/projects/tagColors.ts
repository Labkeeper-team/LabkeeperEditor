import { TAG_COLORS } from '../../../viewModel/domain/projectsFilter.ts';

/**
 * Цвета метки для вида. Цвет с сервера может быть любым CSS-цветом, а для
 * полупрозрачного фона и яркости нужен #rrggbb: не-hex цвета разбирает сам
 * браузер через canvas, поэтому это живёт в виде, а не в домене
 */

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const SHORT_HEX_COLOR = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const NEUTRAL_BORDER = '#bfc8de';
const DARK_TEXT = '#0e1621';

let colorContext: CanvasRenderingContext2D | null | undefined;
const hexCache = new Map<string, string | null>();

/**
 * Любой CSS-цвет с сервера в вид #rrggbb: так от него можно взять
 * полупрозрачный фон и яркость. Не-hex цвета разбирает сам браузер через
 * canvas; что он не понял, считается отсутствующим цветом
 */
export const toHexColor = (color: string): string | null => {
    const value = color.trim();
    if (HEX_COLOR.test(value)) {
        return value.toLowerCase();
    }
    const short = SHORT_HEX_COLOR.exec(value);
    if (short) {
        return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
    }
    if (!value) {
        return null;
    }
    if (hexCache.has(value)) {
        return hexCache.get(value)!;
    }
    if (colorContext === undefined) {
        try {
            colorContext =
                typeof document === 'undefined' ||
                /jsdom/i.test(navigator.userAgent)
                    ? null
                    : document.createElement('canvas').getContext('2d');
        } catch {
            colorContext = null;
        }
    }
    let hex: string | null = null;
    if (colorContext) {
        // два разных начальных цвета: если строка не цвет, fillStyle не меняется
        colorContext.fillStyle = '#010203';
        colorContext.fillStyle = value;
        const first = String(colorContext.fillStyle);
        colorContext.fillStyle = '#030201';
        colorContext.fillStyle = value;
        const second = String(colorContext.fillStyle);
        hex = first === second && HEX_COLOR.test(first) ? first : null;
    }
    hexCache.set(value, hex);
    return hex;
};

/** Относительная яркость по WCAG: 0 чёрный, 1 белый */
const luminance = (hex: string) => {
    const channel = (offset: number) => {
        const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

/**
 * Цвета метки: точка, светлый фон, рамка и текст выбранной (залитой) метки.
 * У очень светлых цветов рамка нейтральная, иначе метка сливается с белым,
 * а текст на заливке тёмный, иначе его не прочесть
 */
export const tagColors = (color: string) => {
    const hex = toHexColor(color) ?? TAG_COLORS[7];
    const light = luminance(hex) > 0.7;
    return {
        dot: hex,
        background: `${hex}1f`,
        border: light ? NEUTRAL_BORDER : `${hex}55`,
        activeBorder: light ? NEUTRAL_BORDER : hex,
        activeText: luminance(hex) > 0.45 ? DARK_TEXT : '#ffffff',
    };
};
