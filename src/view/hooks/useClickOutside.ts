/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';

const useClickOutside = (
    callback: (event: any) => void,
    ignoreSelectors: string[] = [],
    isActive: boolean
) => {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClick = (event) => {
            if (!isActive) {
                return;
            }
            if (!ref.current || ref.current.contains(event.target)) {
                return;
            }
            const clickedInsideIgnoredContainer = ignoreSelectors.some(
                (selector) => {
                    const element: any = document.querySelector(selector);
                    return element && element.contains(event.target);
                }
            );
            if (clickedInsideIgnoredContainer) {
                return;
            }
            callback(event);
        };

        document.addEventListener('mousedown', handleClick);
        document.addEventListener('touchstart', handleClick);

        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('touchstart', handleClick);
        };
    }, [callback, ignoreSelectors, isActive]);

    return ref;
};

export default useClickOutside;
