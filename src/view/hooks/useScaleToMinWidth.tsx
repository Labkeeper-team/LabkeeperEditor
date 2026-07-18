import { useLayoutEffect } from 'react';
import { Routes } from '../../viewModel/routes.ts';
import { refreshCodeMirrorLayout } from '../utils/refreshCodeMirrorLayout';

const RESCALE_EVENT = 'labkeeper:viewport-rescale';

function isTokensLandingPath() {
    return window.location.pathname === Routes.Tokens;
}

/**
 * Масштабирует node так, чтобы вся вёрстка влезала
 * при ширине окна < minWidth.
 * @param {React.RefObject<HTMLElement>} ref
 * @param {number} minWidth
 */
export function useScaleToMinWidth(ref, minWidth = 1024) {
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return;

        const rescale = () => {
            if (isTokensLandingPath()) {
                el.style.transform = el.style.width = el.style.height = '';
                el.style.transformOrigin = '';
                document.documentElement.style.setProperty(
                    '--mobile-scale',
                    '1'
                );
                return;
            }
            const k = Math.min(1, window.innerWidth / minWidth);
            if (k < 1) {
                el.style.transform = `scale(${k})`;
                el.style.transformOrigin = 'top left';
                el.style.width = 100 / k + '%';
                el.style.height = 100 / k + '%';
            } else {
                el.style.transform = el.style.width = el.style.height = '';
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
        window.addEventListener(RESCALE_EVENT, rescale);
        return () => {
            window.removeEventListener('resize', rescale);
            window.removeEventListener(RESCALE_EVENT, rescale);
        };
    }, [ref, minWidth]);
}

export const VIEWPORT_RESCALE_EVENT = RESCALE_EVENT;
