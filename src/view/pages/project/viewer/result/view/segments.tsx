import { memo, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import {
    useCompiledSegmentsSize,
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
import { useScrollableToActive } from '../../../../../hooks/useScrollableToActive.ts';
import { AppDispatch } from '../../../../../store/index.ts';
import { controller } from '../../../../../../main.tsx';
import useClickOutside from '../../../../../hooks/useClickOutside.ts';
import { useIsDelayedSegmentIsActive } from '../../../../../hooks/useIsDelayedSegmentIsActive.ts';

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
    console.log('rerender index', index, segment);
    const activeIndex = useIsDelayedSegmentIsActive(index);
    const onOutisde = useCallback(() => {
        dispatch(
            controller.onBlurSegmentRequest({
                segmentIndex: index,
            })
        );
    }, [dispatch, index]);

    const ignoreSelectors = useMemo(() => [`#ide-segment-${index}`], [index]);

    const ref = useClickOutside(onOutisde, ignoreSelectors, activeIndex);

    useScrollableToActive(ref, 'compile-result', index);

    const onClick = useCallback(() => {
        dispatch(
            controller.onFocusSegmentRequest({
                segmentIndex: index,
            })
        );
    }, [dispatch, index]);

    const key = useMemo(() => {
        return `${index}-${segment?.type}`;
    }, [segment, index]);

    const Component = useMemo(() => {
        if (!segment) {
            return <div key={index} />;
        }

        switch (segment.type) {
            case 'computational': {
                return (
                    <CodeSegment
                        onClick={onClick}
                        segment={segment as ComputationalOutputSegment}
                        index={index}
                        key={key}
                        ref={ref}
                    />
                );
            }
            case 'md': {
                return (
                    <MdSegment
                        onClick={onClick}
                        key={key}
                        index={index}
                        ref={ref}
                        segment={segment as TextOutputSegment}
                    />
                );
            }
            case 'latex': {
                return (
                    <LatexSegment
                        onClick={onClick}
                        key={key}
                        index={index}
                        ref={ref}
                        segment={segment as TextOutputSegment}
                    />
                );
            }
            case 'asciimath': {
                return (
                    <AsciimathSegment
                        onClick={onClick}
                        key={key}
                        segment={segment as TextOutputSegment}
                        index={index}
                        ref={ref}
                    />
                );
            }
            default:
                return <div />;
        }
    }, [segment, key, index, onClick, ref]);

    return  Component;
});
