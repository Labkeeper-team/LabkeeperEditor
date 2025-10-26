import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useIsSegmentIsActive } from '../store/selectors/program';

const timeoutMs = 10;

export const useIsDelayedSegmentIsActive = (index) => {
    const activeIndex = useSelector(useIsSegmentIsActive(index));
    const [internalState, setInternalState] = useState(activeIndex);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timeoutRef = useRef<any>(null);
    const previousValueRef = useRef(activeIndex);

    useEffect(() => {
        // Если значение изменилось
        if (activeIndex !== previousValueRef.current) {
            // Очищаем предыдущий таймаут, если он есть
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }

            // Устанавливаем новый таймаут
            timeoutRef.current = setTimeout(() => {
                setInternalState(activeIndex);
                timeoutRef.current = null;
            }, timeoutMs);

            // Сохраняем текущее значение
            previousValueRef.current = activeIndex;
        }

        // Cleanup function
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [activeIndex]);

    return internalState;
};
