import { memo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { SegmentEditor } from './segment';

import './style.scss';
import { useInputSegmentsSize } from '../../../../../store/selectors/program';
import { useEffect, useRef } from 'react';
import { AppDispatch, StorageState } from '../../../../../store';
import { setScrollEditorToBottom } from '../../../../../store/slices/callback';
import { SegmentDivider } from './segment-divider';
import {
    LatexFooterBoundaryCard,
    LatexHeaderBoundaryCard,
} from './latex-boundary-card';
import React from 'react';
import {
    deactivateIdeSegment,
    getIdeSegmentIndexFromTarget,
    isClickOutsideAllIdeSegments,
} from './ideSegmentDeactivate';

export const Segments = () => {
    const scrollEditorToBottom = useSelector(
        (state: StorageState) => state.callback.scrollEditorToBottom
    );
    const ref = useRef<HTMLDivElement>(null);
    const dispatch = useDispatch<AppDispatch>();
    const segmentsSize = useSelector(useInputSegmentsSize);
    const activeSegmentIndex = useSelector(
        (state: StorageState) => state.ide.activeSegmentIndex
    );
    const activeSegmentIndexRef = useRef(activeSegmentIndex);
    activeSegmentIndexRef.current = activeSegmentIndex;

    useEffect(() => {
        const container = ref.current;
        if (!container) {
            return;
        }
        const onMouseDownCapture = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element)) {
                return;
            }

            const active = activeSegmentIndexRef.current;
            const clickedIndex = getIdeSegmentIndexFromTarget(target);

            // Переключение на другой сегмент — только снять старый активный, фокус не блокировать
            if (
                active >= 0 &&
                clickedIndex !== null &&
                clickedIndex !== active
            ) {
                deactivateIdeSegment(active, dispatch);
                return;
            }

            if (active < 0) {
                return;
            }

            // Снять выделение только при клике вне блока сегмента (LaTeX footer, padding списка)
            if (isClickOutsideAllIdeSegments(target)) {
                event.preventDefault();
                event.stopPropagation();
                deactivateIdeSegment(active, dispatch);
            }
        };

        container.addEventListener('mousedown', onMouseDownCapture, true);
        return () => {
            container.removeEventListener(
                'mousedown',
                onMouseDownCapture,
                true
            );
        };
    }, [dispatch]);

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
        <div ref={ref} id="segments-container" className="segments-container">
            <LatexHeaderBoundaryCard />
            {Array.from(Array(segmentsSize).keys()).map((_, index) => {
                return (
                    <SegmentEditorWrapper
                        index={index}
                        key={index}
                        isLast={index + 1 === segmentsSize}
                    />
                );
            })}
            <LatexFooterBoundaryCard />
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
