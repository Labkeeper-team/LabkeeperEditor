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

        updateInnerHeight();

        window.addEventListener('resize', updateInnerHeight);
        return () => {
            window.removeEventListener('resize', updateInnerHeight);
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
