import { useEffect, useRef } from 'react';
import { useScaleToMinWidth } from '../../hooks/useScaleToMinWidth';
import { isTokensLandingPath } from '../../hooks/viewportScale';
import { resetLockedViewportScroll } from '../../utils/resetLockedViewportScroll';

function syncInnerHeight() {
    const vv = window.visualViewport;
    const height = vv?.height ?? window.innerHeight;
    document.documentElement.style.setProperty(
        '--inner-height',
        `${Math.round(height)}px`
    );
}

export default function ScaleWrapper({ minWidth = 1024, children }) {
    const ref = useRef(null);
    useScaleToMinWidth(ref, minWidth);

    useEffect(() => {
        const onViewportChange = () => {
            syncInnerHeight();
            // /tokens uses document scroll; visualViewport resize/scroll
            // (URL bar, etc.) must not yank the page back to the top.
            if (!isTokensLandingPath()) {
                resetLockedViewportScroll();
            }
        };

        onViewportChange();

        const vv = window.visualViewport;
        vv?.addEventListener('resize', onViewportChange);
        vv?.addEventListener('scroll', onViewportChange);
        window.addEventListener('resize', onViewportChange);
        window.addEventListener('orientationchange', onViewportChange);

        return () => {
            vv?.removeEventListener('resize', onViewportChange);
            vv?.removeEventListener('scroll', onViewportChange);
            window.removeEventListener('resize', onViewportChange);
            window.removeEventListener('orientationchange', onViewportChange);
        };
    }, []);

    return (
        <div
            ref={ref}
            className="scale-wrapper"
            style={{ transition: 'transform .2s ease, width .2s ease' }}
        >
            {children}
        </div>
    );
}
