import { RefObject, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useIsSegmentIsActive } from '../store/selectors/program';

export const useScrollableToActive = (
    ref: RefObject<HTMLDivElement>,
    mainContainerid: string,
    index: number
) => {
    const isActive = useSelector(useIsSegmentIsActive(index));
    const [prevIsActive, setPrevIsActive] = useState(false);

    const isElementVisible = useCallback(() => {
        if (!ref?.current) return false;

        const container = document.getElementById(mainContainerid);
        if (!container) return false;

        const containerRect = container.getBoundingClientRect();
        const elementRect = ref.current.getBoundingClientRect();

        // Проверяем, что элемент виден на 30% или больше
        const visibleTop = Math.max(elementRect.top, containerRect.top);
        const visibleBottom = Math.min(
            elementRect.bottom,
            containerRect.bottom
        );
        const visibleHeight = Math.max(0, visibleBottom - visibleTop);

        const visibilityRatio = visibleHeight / elementRect.height;

        return visibilityRatio >= 0.3;
    }, [ref, mainContainerid]);

    const handleClick = useCallback(() => {
        const container = ref?.current?.parentElement; // Родительский scroll-контейнер
        const element = ref?.current;

        if (!container || !element) return;
        const scaleFactor =
            +document.documentElement.style.getPropertyValue('--mobile-scale');
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Корректируем позицию с учётом scale
        const offsetY1 = (rect.top - containerRect.top) * (1 / scaleFactor);
        const offsetY2 =
            (rect.bottom - containerRect.bottom) * (1 / scaleFactor);

        const offsetY =
            Math.abs(offsetY1) > Math.abs(offsetY2) ? offsetY2 : offsetY1;
        const top = container.scrollTop + offsetY;
        container?.scrollTo?.({
            top,
            behavior: 'smooth',
        });
    }, [ref]);

    useEffect(() => {
        if (isActive) {
            const shouldScroll =
                isActive !== prevIsActive || !isElementVisible();

            if (shouldScroll) {
                setPrevIsActive(isActive);
                handleClick();
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isActive]);
};
