import { forwardRef, memo, useCallback, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import classNames from 'classnames';

import {
    useCompiledSegmentsSize,
    useSegment,
} from '../../../../../store/selectors/program';
import { CodeSegment } from './code-segment';
import { MdSegment } from './md-segment';
import { LatexSegment } from './latex-segment.tsx';
import { AsciimathSegment } from './asciimath-segment.tsx';
import { useScrollableToActive } from '../../../../../hooks/useScrollableToActive.ts';
import { AppDispatch } from '../../../../../store/index.ts';
import { controller } from '../../../../../../main.tsx';
import useClickOutside from '../../../../../hooks/useClickOutside.ts';
import { useIsDelayedSegmentIsActive } from '../../../../../hooks/useIsDelayedSegmentIsActive.ts';
import { OutputSegment } from '../../../../../../model/domain.ts';

interface IActiveSegmentWrapperProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Component: any;
    segment?: OutputSegment;
    index: number;
    onClick: () => void;
}

export const Segments = memo(() => {
    const segmentsSize = useSelector(useCompiledSegmentsSize);
    const segmentIndexes = useMemo(
        () => Array.from({ length: segmentsSize || 0 }, (_, i) => i),
        [segmentsSize]
    );
    return (
        <>
            {segmentIndexes.map((_, index) => {
                return <SegmentWrapper index={index} key={index} />;
            })}
        </>
    );
});

const SegmentWrapper = memo(({ index }: { index: number }) => {
    const dispatch = useDispatch<AppDispatch>();
    const segment = useSelector(useSegment(index));
    const onClick = useCallback(() => {
        dispatch(controller.onFocusSegmentRequest({ segmentIndex: index }));
    }, [dispatch, index]);

    const key = useMemo(() => {
        return `${index}-${segment?.type}`;
    }, [segment, index]);

    const Component = useMemo(() => {
        if (!segment) return <div key={index} />;

        switch (segment.type) {
            case 'computational':
                return CodeSegment;
            case 'md':
                return MdSegment;
            case 'latex':
                return LatexSegment;
            case 'asciimath':
                return AsciimathSegment;
            default:
                return () => <div />;
        }
    }, [segment, index]);

    return (
        <SegmentContent
            Component={Component}
            segment={segment}
            index={index}
            onClick={onClick}
            key={key}
        />
    );
});

const SegmentContent = memo(
    forwardRef<
        HTMLDivElement,
        IActiveSegmentWrapperProps
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
    >(({ Component, segment, index, onClick }, _) => {
        const dispatch = useDispatch<AppDispatch>();
        const activeIndex = useIsDelayedSegmentIsActive(index);

        const ignoreSelectors = useMemo(
            () => [`#ide-segment-${index}`],
            [index]
        );
        const onOutisde = useCallback(() => {
            dispatch(controller.onBlurSegmentRequest({ segmentIndex: index }));
        }, [dispatch, index]);

        const activeWrapperRef = useRef<HTMLDivElement>(null);
        const ref = useClickOutside(onOutisde, ignoreSelectors, activeIndex);
        useScrollableToActive(activeWrapperRef, 'compile-result', index);
        return (
            <div
                ref={activeWrapperRef}
                className={classNames('result-segment-container', {
                    'active-result-block-container': activeIndex,
                })}
            >
                <Component
                    segment={segment}
                    index={index}
                    onClick={onClick}
                    ref={ref}
                />
            </div>
        );
    })
);
