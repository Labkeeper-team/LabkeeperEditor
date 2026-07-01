import { useLayoutEffect } from 'react';
import { refreshCodeMirrorLayout } from '../utils/refreshCodeMirrorLayout';

/**
 * Масштабирует node так, чтобы вся вёрстка влезала
 * при ширине окна < minWidth.
 * @param {React.RefObject<HTMLElement>} ref
 * @param {number} minWidth
 */
export function useScaleToMinWidth(ref, minWidth = 1024, disabled = false) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const rescale = () => {
            const k = Math.min(1, window.innerWidth / minWidth);
            if (k < 1 && !disabled) {
                el.style.transform = `scale(${k})`;
                el.style.transformOrigin = 'top left';
                el.style.width = 100 / k + '%';
                el.style.height = 100 / k + '%';
            } else {
                el.style.transform = el.style.width = el.style.height = '';
            }
            document.documentElement.style.setProperty(
                '--mobile-scale',
                (disabled ? 1 : k).toString()
            );
            refreshCodeMirrorLayout();
        };

        //вызываем сразу — важно для «первой загрузки» на мобильном
        rescale();
        window.addEventListener('resize', rescale);
        return () => window.removeEventListener('resize', rescale);
    }, [ref, minWidth, disabled]);
}
