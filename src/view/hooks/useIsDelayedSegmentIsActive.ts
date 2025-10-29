import { useEffect, useRef, useTransition } from 'react';
import { useSelector } from 'react-redux';
import { useIsSegmentIsActive } from '../store/selectors/program';

const timeoutMs = 10;

export const useIsDelayedSegmentIsActive = (index) => {
    const activeIndex = useSelector(useIsSegmentIsActive(index));
    const [, startTransition] = useTransition();
    const internalStateRef = useRef(activeIndex);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            startTransition(() => {
                internalStateRef.current = activeIndex;
            });
        }, timeoutMs);

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [activeIndex, startTransition]);

    return internalStateRef.current;
};
