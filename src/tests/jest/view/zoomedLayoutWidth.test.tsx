import { act, renderHook } from '@testing-library/react';
import { useIsMobile } from '../../../view/hooks/useMobile.ts';
import { useScaleToMinWidth } from '../../../view/hooks/useScaleToMinWidth.tsx';
import { isNativeMobileLayoutPath } from '../../../view/hooks/viewportScale.ts';
import { layoutViewportWidth } from '../../../view/utils/viewportSize.ts';

// пересчёт CodeMirror после масштабирования здесь не нужен, а на давних ошибках типов его модуля ts-jest падает
jest.mock('../../../view/utils/refreshCodeMirrorLayout.ts', () => ({
    refreshCodeMirrorLayout: () => {},
}));

// Safari на iPad (A16), 820 пикселей в ширину: при щипке 2x innerWidth падает до 410, раскладка остаётся 820
function setWidths(innerWidth: number, clientWidth: number) {
    Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: innerWidth,
    });
    Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        value: clientWidth,
    });
}

describe('раскладка при щипковом зуме на iOS', () => {
    const initialInnerWidth = window.innerWidth;

    beforeEach(() => {
        window.history.pushState({}, '', '/project/2cd18704');
    });

    afterEach(() => {
        setWidths(initialInnerWidth, 0);
        document.documentElement.style.removeProperty('--mobile-scale');
        window.history.pushState({}, '', '/');
    });

    test('ширина раскладки берётся у документа, а не у увеличенного окна', () => {
        setWidths(410, 820);
        expect(layoutViewportWidth()).toBe(820);
    });

    test('полоса прокрутки считается, как в media queries', () => {
        setWidths(784, 767);
        expect(layoutViewportWidth()).toBe(784);
    });

    test('увеличенный iPad не становится телефоном ни на первом кадре, ни после resize', () => {
        setWidths(410, 820);
        const rendered: boolean[] = [];
        renderHook(() => {
            rendered.push(useIsMobile());
        });
        act(() => {
            window.dispatchEvent(new Event('resize'));
        });
        expect(rendered).not.toContain(true);
        expect(isNativeMobileLayoutPath()).toBe(false);
    });

    test('масштаб вёрстки на увеличенном iPad прежний', () => {
        setWidths(410, 820);
        const ref = { current: document.createElement('div') };
        renderHook(() => useScaleToMinWidth(ref, 1024));
        expect(
            document.documentElement.style.getPropertyValue('--mobile-scale')
        ).toBe(String(820 / 1024));
        expect(ref.current.style.transform).toBe(`scale(${820 / 1024})`);
    });

    test('телефон без зума остаётся телефоном', () => {
        setWidths(402, 402);
        expect(renderHook(() => useIsMobile()).result.current).toBe(true);
        expect(isNativeMobileLayoutPath()).toBe(true);
    });
});
