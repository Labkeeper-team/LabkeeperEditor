import {
    RefObject,
    useCallback,
    useEffect,
    useLayoutEffect,
    useState,
} from 'react';
import {
    DropdownPlacement,
    getDropdownPlacement,
} from './getDropdownPlacement';

type UseDropdownPlacementParams = {
    triggerRef: RefObject<HTMLElement | null>;
    dropdownRef: RefObject<HTMLElement | null>;
    boundaryRef?: RefObject<HTMLElement | null>;
    /** Re-run placement when this value changes (e.g. dropdown content). */
    contentKey?: string | number;
};

type UseDropdownPlacementResult = {
    placement: DropdownPlacement;
    isReady: boolean;
};

export const useDropdownPlacement = ({
    triggerRef,
    dropdownRef,
    boundaryRef,
    contentKey,
}: UseDropdownPlacementParams): UseDropdownPlacementResult => {
    const [placement, setPlacement] = useState<DropdownPlacement>('bottom');
    const [isReady, setIsReady] = useState(false);

    const recalculate = useCallback(() => {
        const triggerElement = triggerRef.current;
        if (!triggerElement) {
            return;
        }
        const triggerRect = triggerElement.getBoundingClientRect();
        const dropdownHeight =
            dropdownRef.current?.getBoundingClientRect().height ?? 250;
        const viewport = window.visualViewport;
        const viewportHeight = viewport?.height ?? window.innerHeight;
        const boundaryRect =
            boundaryRef?.current?.getBoundingClientRect() ?? null;
        const nextPlacement = getDropdownPlacement({
            triggerRect,
            dropdownHeight,
            boundaryRect,
            viewportHeight,
        });
        setPlacement((prev) => (prev === nextPlacement ? prev : nextPlacement));
        setIsReady(true);
    }, [triggerRef, dropdownRef, boundaryRef]);

    useLayoutEffect(() => {
        setIsReady(false);
        recalculate();
    }, [recalculate, contentKey]);

    useEffect(() => {
        const updatePlacement = () => recalculate();
        const viewport = window.visualViewport;
        const resizeObserver =
            typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(updatePlacement)
                : null;
        if (resizeObserver) {
            resizeObserver.observe(document.documentElement);
            if (dropdownRef.current) {
                resizeObserver.observe(dropdownRef.current);
            }
        }
        window.addEventListener('resize', updatePlacement);
        window.addEventListener('scroll', updatePlacement, true);
        viewport?.addEventListener('resize', updatePlacement);
        viewport?.addEventListener('scroll', updatePlacement);
        return () => {
            resizeObserver?.disconnect();
            window.removeEventListener('resize', updatePlacement);
            window.removeEventListener('scroll', updatePlacement, true);
            viewport?.removeEventListener('resize', updatePlacement);
            viewport?.removeEventListener('scroll', updatePlacement);
        };
    }, [recalculate, dropdownRef]);

    return { placement, isReady };
};
