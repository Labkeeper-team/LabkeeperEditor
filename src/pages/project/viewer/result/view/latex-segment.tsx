import classNames from 'classnames';
import { useIsSegmentIsActive } from '../../../../../store/selectors/program';
import { useSelector } from 'react-redux';
import { forwardRef, useRef } from 'react';
import { TextOutputSegment } from '../../../../../shared/models/project.ts';
import { MathJax } from 'better-react-mathjax';

export const LatexSegment = forwardRef<
    HTMLDivElement,
    { segment: TextOutputSegment }
>(({ segment }, ref) => {
    const activeIndex = useSelector(useIsSegmentIsActive(segment.id));
    const segmentRef = useRef<HTMLDivElement>(null);

    return (
        <div
            ref={ref ?? segmentRef}
            className={classNames({
                'active-result-block-container': activeIndex,
                'markdown-body': true,
                'result-segment': true,
            })}
        >
            <MathJax>{segment.text}</MathJax>
        </div>
    );
});
