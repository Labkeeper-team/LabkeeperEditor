import { useEffect, useState, useTransition } from 'react';
import { useSelector } from 'react-redux';
import { useIsSegmentIsActive } from '../store/selectors/program';

const timeoutMs = 10;

export const useIsDelayedSegmentIsActive = (index: number) => {
    const activeIndex = useSelector(useIsSegmentIsActive(index));
    const [delayedActive, setDelayedActive] = useState(activeIndex);
    const [, startTransition] = useTransition();

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            startTransition(() => {
                setDelayedActive(activeIndex);
            });
        }, timeoutMs);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [activeIndex, startTransition]);

    return delayedActive;
};
