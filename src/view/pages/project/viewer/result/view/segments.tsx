import { createRef, memo, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import {
    useActiveElement,
    useCompiledSegments,
} from '../../../../../../viewModel/store/selectors/program';
import { CodeSegment } from './code-segment';
import { MdSegment } from './md-segment';
import {
    ComputationalOutputSegment,
    TextOutputSegment,
} from '../../../../../../model/domain.ts';
import { LatexSegment } from './latex-segment.tsx';
import { AsciimathSegment } from './asciimath-segment.tsx';

export const Segments = memo(() => {
    const [prevActiveIndex, setPrevActiveIndex] = useState(-1);
    const segments = useSelector(useCompiledSegments);
    const activeIndex = useSelector(useActiveElement);
    const refs = (segments || []).reduce((prv, _, index) => {
        prv[index] = createRef();
        return prv;
    }, {});

    const isElementVisible = useCallback(
        (elementRef: React.RefObject<HTMLElement>) => {
            if (!elementRef?.current) return false;

            const container = document.getElementById('compile-result');
            if (!container) return false;

            const containerRect = container.getBoundingClientRect();
            const elementRect = elementRef.current.getBoundingClientRect();

            // Проверяем, что элемент виден на 30% или больше
            const visibleTop = Math.max(elementRect.top, containerRect.top);
            const visibleBottom = Math.min(
                elementRect.bottom,
                containerRect.bottom
            );
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);

            const visibilityRatio = visibleHeight / elementRect.height;

            return visibilityRatio >= 0.3;
        },
        []
    );

    const handleClick = useCallback(
        (index: number) => {
            const container = refs[index]?.current.parentElement; // Родительский scroll-контейнер
            const element = refs[index]?.current;

            if (!container || !element) return;

            const scaleFactor =
                +document.documentElement.style.getPropertyValue(
                    '--mobile-scale'
                );
            const rect = element.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();

            // Корректируем позицию с учётом scale
            const offsetY = (rect.top - containerRect.top) * (1 / scaleFactor);

            // Прокручиваем контейнер
            container.scrollTo({
                top: container.scrollTop + offsetY,
                behavior: 'smooth',
            });
        },
        [refs]
    );

    useEffect(() => {
        if (activeIndex > -1) {
            const shouldScroll =
                prevActiveIndex !== activeIndex ||
                !isElementVisible(refs[activeIndex]);

            if (shouldScroll) {
                setPrevActiveIndex(activeIndex);
                handleClick(activeIndex);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeIndex, refs, handleClick, isElementVisible]);

    return (
        <>
            {segments?.map((segment, index) => {
                switch (segment.type) {
                    case 'computational': {
                        const comp = segment as ComputationalOutputSegment;
                        return (
                            <CodeSegment
                                ref={refs[index]}
                                index={index}
                                key={`${segment.id}_${index}_${JSON.stringify(comp.statements)}`}
                                segment={comp}
                            />
                        );
                    }
                    case 'md': {
                        const text = segment as TextOutputSegment;
                        return (
                            <MdSegment
                                ref={refs[index]}
                                key={`${segment.id}_${index}_${text.text}`}
                                segment={text}
                                index={index}
                            />
                        );
                    }
                    case 'latex': {
                        const text = segment as TextOutputSegment;
                        return (
                            <LatexSegment
                                ref={refs[index]}
                                key={`${segment.id}_${index}_${text.text}`}
                                segment={text}
                                index={index}
                            />
                        );
                    }
                    case 'asciimath': {
                        const text = segment as TextOutputSegment;
                        return (
                            <AsciimathSegment
                                ref={refs[index]}
                                key={`${segment.id}_${index}_${text.text}`}
                                segment={text}
                                index={index}
                            />
                        );
                    }
                    default:
                        return <div />;
                }
            })}
        </>
    );
});
