// components/ScaleWrapper.jsx
import { useEffect, useRef } from 'react';
import { useScaleToMinWidth } from '../../hooks/useScaleToMinWidth';

export default function ScaleWrapper({ minWidth = 1024, children }) {
    const ref = useRef(null);
    useScaleToMinWidth(ref, minWidth);

    useEffect(() => {
        // Здесь долждны быть логика с калькулируемой высотой.но пока оставим так
        const setVh = () => {
            document.documentElement.style.setProperty(
                '--inner-height',
                `100dvh`
            );
        };

        setVh();

        /*window.addEventListener('resize', setVh);
        window.addEventListener('orientationchange', setVh);

        return () => {
            window.removeEventListener('resize', setVh);
            window.removeEventListener('orientationchange', setVh);
        };*/
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
