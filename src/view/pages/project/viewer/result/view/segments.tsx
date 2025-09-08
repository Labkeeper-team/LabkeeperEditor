import { createRef, memo, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import {
    useCompiledSegmentsSize,
    useIsSegmentIsActive,
    useSegment,
} from '../../../../../store/selectors/program';
import { CodeSegment } from './code-segment';
import { MdSegment } from './md-segment';
import { LatexSegment } from './latex-segment.tsx';
import { AsciimathSegment } from './asciimath-segment.tsx';
import {
    ComputationalOutputSegment,
    TextOutputSegment,
} from '../../../../../../model/domain.ts';

export const Segments = memo(() => {
    const segmentsSize = useSelector(useCompiledSegmentsSize);

    return (
        <>
            {Array.from(Array(segmentsSize).keys()).map((_, index) => {
                return <SegmentWrapper index={index} key={index} />;
            })}
        </>
    );
});

const SegmentWrapper = memo(({ index }: { index: number }) => {
    const segment = useSelector(useSegment(index));
    const isActive = useSelector(useIsSegmentIsActive(index));
    const [prevIsActive, setPrevIsActive] = useState(false);
    const ref = createRef<HTMLDivElement>();

    const isElementVisible = useCallback(() => {
        if (!ref?.current) return false;

        const container = document.getElementById('compile-result');
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
    }, [ref]);

    const handleClick = useCallback(() => {
        const container = ref?.current?.parentElement; // Родительский scroll-контейнер
        const element = ref?.current;

        if (!container || !element) return;

        const scaleFactor =
            +document.documentElement.style.getPropertyValue('--mobile-scale');
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();

        // Корректируем позицию с учётом scale
        const offsetY = (rect.top - containerRect.top) * (1 / scaleFactor);

        // Прокручиваем контейнер
        if (container.scrollTo) {
            container.scrollTo({
                top: container.scrollTop + offsetY,
                behavior: 'smooth',
            });
        }
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
    }, [isActive]);

    if (!segment) {
        return <div key={index} />;
    }

    switch (segment.type) {
        case 'computational': {
            return (
                <CodeSegment
                    segment={segment as ComputationalOutputSegment}
                    index={index}
                    key={`${index}-${JSON.stringify(segment)}`}
                    ref={ref}
                />
            );
        }
        case 'md': {
            return (
                <MdSegment
                    key={`${index}-${JSON.stringify(segment)}`}
                    index={index}
                    ref={ref}
                    segment={segment as TextOutputSegment}
                />
            );
        }
        case 'latex': {
            return (
                <LatexSegment
                    key={`${index}-${JSON.stringify(segment)}`}
                    index={index}
                    ref={ref}
                    segment={segment as TextOutputSegment}
                />
            );
        }
        case 'asciimath': {
            return (
                <AsciimathSegment
                    key={`${index}-${JSON.stringify(segment)}`}
                    segment={segment as TextOutputSegment}
                    index={index}
                    ref={ref}
                />
            );
        }
        default:
            return <div />;
    }
});
