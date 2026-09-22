import { useState, useEffect } from 'react';
import { layoutViewportWidth } from '../utils/viewportSize';

export const MOBILE_BREAKPOINT = 767;

export const useIsMobile = (maxWidth = MOBILE_BREAKPOINT) => {
    const [isMobile, setIsMobile] = useState(
        () => layoutViewportWidth() <= maxWidth
    );

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(layoutViewportWidth() <= maxWidth);
        };

        window.addEventListener('resize', handleResize);

        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [maxWidth]);

    return isMobile;
};
