import { useEffect, useRef } from 'react';
import { useScaleToMinWidth } from '../../hooks/useScaleToMinWidth';

function syncInnerHeight() {
    const vv = window.visualViewport;
    const height = vv?.height ?? window.innerHeight;
    document.documentElement.style.setProperty(
        '--inner-height',
        `${Math.round(height)}px`
    );
}

function resetWindowScroll() {
    // iOS often shifts the layout viewport when the keyboard opens,
    // leaving an empty strip under the app chrome.
    if (window.scrollY !== 0 || window.scrollX !== 0) {
        window.scrollTo(0, 0);
    }
    if (document.documentElement.scrollTop !== 0) {
        document.documentElement.scrollTop = 0;
    }
    if (document.body.scrollTop !== 0) {
        document.body.scrollTop = 0;
    }
}

export default function ScaleWrapper({ minWidth = 1024, children }) {
    const ref = useRef(null);
    useScaleToMinWidth(ref, minWidth);

    useEffect(() => {
        const onViewportChange = () => {
            syncInnerHeight();
            resetWindowScroll();
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
