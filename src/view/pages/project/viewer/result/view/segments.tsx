import { memo, useCallback } from 'react';
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
import { controller } from '../../../../../../controller.ts';
import useClickOutside from '../../../../../hooks/useClickOutside.ts';
import { useIsDelayedSegmentIsActive } from '../../../../../hooks/useIsDelayedSegmentIsActive.ts';

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
    const dispatch = useDispatch<AppDispatch>();
    const segment = useSelector(useSegment(index));
    const activeIndex = useIsDelayedSegmentIsActive(index);
    const onOutisde = useCallback(() => {
        dispatch(
            controller.onBlurSegmentRequest({
                segmentIndex: index,
            })
        );
    }, [dispatch, index]);

    const ref = useClickOutside(
        onOutisde,
        [`#ide-segment-${index}`],
        activeIndex
    );

    useScrollableToActive(ref, 'compile-result', index);

    const onClick = useCallback(() => {
        dispatch(
            controller.onFocusSegmentRequest({
                segmentIndex: index,
            })
        );
    }, [dispatch, index]);

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
                    key={`${index}-${JSON.stringify(segment)}`}
                    ref={ref}
                />
            );
        }
        case 'md': {
            return (
                <MdSegment
                    onClick={onClick}
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
                    onClick={onClick}
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
                    onClick={onClick}
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
