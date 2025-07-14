import { useState, useEffect } from 'react';

export const useIsMobile = (maxWidth = 1024) => {
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
