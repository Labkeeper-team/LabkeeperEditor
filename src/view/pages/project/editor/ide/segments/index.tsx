import { memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SegmentEditor } from './segment';

import './style.scss';
import { useInputSegmentsSize } from '../../../../../../viewModel/store/selectors/program';
import { useEffect, useRef } from 'react';
import { AppDispatch, StorageState } from '../../../../../../viewModel/store';
import { setScrollEditorToBottom } from '../../../../../../viewModel/store/slices/callback';
import { SegmentDivider } from './segment-divider';
import React from 'react';

export const Segments = () => {
    const scrollEditorToBottom = useSelector(
        (state: StorageState) => state.callback.scrollEditorToBottom
    );
    const ref = useRef<HTMLDivElement>(null);
    const dispatch = useDispatch<AppDispatch>();
    const segmentsSize = useSelector(useInputSegmentsSize);

    useEffect(() => {
        if (ref?.current && scrollEditorToBottom) {
            setTimeout(
                () =>
                    ref.current?.scrollTo({
                        top: 10000000,
                        behavior: 'smooth',
                    }),
                1000
            );
            dispatch(setScrollEditorToBottom(false));
        }
    }, [scrollEditorToBottom, dispatch]);

    return (
        <div ref={ref} className="segments-container">
            {Array.from(Array(segmentsSize).keys()).map((_, index) => {
                return (
                    <SegmentEditorWrapper
                        index={index}
                        key={index}
                        isLast={index + 1 === segmentsSize}
                    />
                );
            })}
        </div>
    );
};

const SegmentEditorWrapper = memo(
    ({ index, isLast }: { index: number; isLast: boolean }) => {
        return (
            <React.Fragment key={index}>
                <SegmentEditor index={index} isLast={isLast} />
                <SegmentDivider index={index} showDivider={!isLast} />
            </React.Fragment>
        );
    }
);
