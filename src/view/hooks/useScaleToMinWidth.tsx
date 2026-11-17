import { useLayoutEffect } from 'react';
import { refreshCodeMirrorLayout } from '../utils/refreshCodeMirrorLayout';
import { layoutViewportWidth } from '../utils/viewportSize';
import { VIEWPORT_RESCALE_EVENT, keepsOwnLayout } from './viewportScale';

/**
 * Масштабирует node так, чтобы вся вёрстка влезала при ширине окна
 * < minWidth. Только для страниц без своей телефонной раскладки, см.
 * keepsOwnLayout
 * @param {React.RefObject<HTMLElement>} ref
 * @param {number} minWidth
 */
export function useScaleToMinWidth(ref, minWidth = 1024) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const rescale = () => {
            if (keepsOwnLayout()) {
                el.style.transform = el.style.width = el.style.height = '';
                el.style.maxHeight = '';
                el.style.transformOrigin = '';
                document.documentElement.style.setProperty(
                    '--mobile-scale',
                    '1'
                );
                return;
            }
            const k = Math.min(1, layoutViewportWidth() / minWidth);
            if (k < 1) {
                el.style.transform = `scale(${k})`;
                el.style.transformOrigin = 'top left';
                el.style.width = 100 / k + '%';
                el.style.height = 100 / k + '%';
                // иначе max-height: 100% из стилей не даёт высоте вырасти,
                // и под уменьшенной страницей остаётся пустая полоса
                el.style.maxHeight = 'none';
            } else {
                el.style.transform = el.style.width = el.style.height = '';
                el.style.maxHeight = '';
                el.style.transformOrigin = '';
            }
            document.documentElement.style.setProperty(
                '--mobile-scale',
                k.toString()
            );
            refreshCodeMirrorLayout();
        };

        //вызываем сразу — важно для «первой загрузки» на мобильном
        rescale();
        window.addEventListener('resize', rescale);
        window.addEventListener(VIEWPORT_RESCALE_EVENT, rescale);
        return () => {
            window.removeEventListener('resize', rescale);
            window.removeEventListener(VIEWPORT_RESCALE_EVENT, rescale);
        };
    }, [ref, minWidth]);
}
