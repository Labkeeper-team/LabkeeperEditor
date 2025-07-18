// components/ScaleWrapper.jsx
import { useEffect, useRef } from 'react';
import { useScaleToMinWidth } from '../../hooks/useScaleToMinWidth';

export default function ScaleWrapper({ minWidth = 1024, children }) {
    const ref = useRef(null);
    useScaleToMinWidth(ref, minWidth);

    useEffect(() => {
        const updateInnerHeight = () => {
            document.documentElement.style.setProperty(
                '--inner-height',
                `${window.innerHeight}px`
            );
        };

        const timeoutUpdateInnterHeight = () => {
            // Немного задержки, чтобы дать системе "устаканиться"
            setTimeout(updateInnerHeight, 100);
        };

        updateInnerHeight();

        window.addEventListener('resize', updateInnerHeight);
        window.addEventListener('orientationchange', updateInnerHeight);
        window.addEventListener('focusout', timeoutUpdateInnterHeight);
        window.addEventListener('focusin', updateInnerHeight);

        return () => {
            window.removeEventListener('resize', updateInnerHeight);
            window.removeEventListener('focusout', timeoutUpdateInnterHeight);
            window.removeEventListener('orientationchange', updateInnerHeight);
            window.removeEventListener('focusin', updateInnerHeight);
        };
    }, []);
    return (
        <div
            ref={ref}
            style={{ transition: 'transform .2s ease, width .2s ease' }}
        >
            {children}
        </div>
    );
}
