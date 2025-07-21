// components/ScaleWrapper.jsx
import { useEffect, useRef } from 'react';
import { useScaleToMinWidth } from '../../hooks/useScaleToMinWidth';

export default function ScaleWrapper({ minWidth = 1024, children }) {
    const ref = useRef(null);
    useScaleToMinWidth(ref, minWidth);

    useEffect(() => {
        // Здесь долждны быть логика с калькулируемой высотой.но пока оставим так
        // Вместо 100dvh ставить window.innerHeight
        const setVh = () => {
            document.documentElement.style.setProperty(
                '--inner-height',
                `100dvh`
            );
        };

        setVh();

        // Для более точного рассчета  надо производить калькуляции с window.innerHeight
        // это нужно для поддержки старых браузеров
        // так же надо добавить какие то ивенЛистенеры для появвления.исчезновения клавиатуры. focusIn focusOut не отработал
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
