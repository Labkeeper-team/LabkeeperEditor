// components/ScaleWrapper.jsx
import { useRef } from 'react';
import { useScaleToMinWidth } from '../../hooks/useScaleToMinWidth';

export default function ScaleWrapper({ minWidth = 1024, children }) {
    const ref = useRef(null);
    useScaleToMinWidth(ref, minWidth);

    return (
        <div
            ref={ref}
            style={{ transition: 'transform .2s ease, width .2s ease' }}
        >
            {children}
        </div>
    );
}
