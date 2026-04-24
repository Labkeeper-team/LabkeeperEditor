import { RefObject, useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useIsSegmentIsActive } from '../store/selectors/program';

const SUBPIXEL = 2;

export const useScrollableToActive = (
    ref: RefObject<HTMLDivElement>,
    mainContainerid: string,
    index: number
) => {
    const isActive = useSelector(useIsSegmentIsActive(index));

    /** Сегмент целиком в видимой области скролл-контейнера (или для высоких — центр контейнера внутри сегмента). */
    const isFullyInViewport = useCallback(() => {
        if (!ref?.current) return false;

        const container = document.getElementById(mainContainerid);
        if (!container) return false;

        const containerRect = container.getBoundingClientRect();
        const elementRect = ref.current.getBoundingClientRect();

        if (elementRect.height > containerRect.height) {
            const containerCenter =
                containerRect.top + containerRect.height / 2;
            return (
                elementRect.top <= containerCenter + SUBPIXEL &&
                elementRect.bottom >= containerCenter - SUBPIXEL
            );
        }

        return (
            elementRect.top >= containerRect.top - SUBPIXEL &&
            elementRect.bottom <= containerRect.bottom + SUBPIXEL &&
            elementRect.left >= containerRect.left - SUBPIXEL &&
            elementRect.right <= containerRect.right + SUBPIXEL
        );
    }, [ref, mainContainerid]);

    const scrollIntoViewIfNeeded = useCallback(() => {
        const container = ref?.current?.parentElement;
        const element = ref?.current;

        if (!container || !element) return;
        const scaleFactor =
            +document.documentElement.style.getPropertyValue('--mobile-scale');
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

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
        if (!isActive) {
            return;
        }
        if (isFullyInViewport()) {
            return;
        }
        scrollIntoViewIfNeeded();
    }, [isActive, isFullyInViewport, scrollIntoViewIfNeeded]);
};
