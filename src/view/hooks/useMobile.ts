import { useState, useEffect } from 'react';

export const MOBILE_BREAKPOINT = 767;

export const useIsMobile = (maxWidth = MOBILE_BREAKPOINT) => {
    const [isMobile, setIsMobile] = useState(
        () => window.innerWidth <= maxWidth
    );

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= maxWidth);
        };

        window.addEventListener('resize', handleResize);

        handleResize();

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, [maxWidth]);

    return isMobile;
};
