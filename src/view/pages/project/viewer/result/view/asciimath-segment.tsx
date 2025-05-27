import classNames from 'classnames';
import { useIsSegmentIsActive } from '../../../../../../viewModel/store/selectors/program';
import { useSelector } from 'react-redux';
import { forwardRef, useRef } from 'react';
import { MathJax } from 'better-react-mathjax';
import { TextOutputSegment } from '../../../../../../model/domain.ts';
import AsciiMathParser from 'asciimath2tex';

export const parser = new AsciiMathParser();

export const AsciimathSegment = forwardRef<
    HTMLDivElement,
    { segment: TextOutputSegment; index: number }
>(({ segment, index }, ref) => {
    const activeIndex = useSelector(useIsSegmentIsActive(index));
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
            <MathJax>{`\\begin{equation}${parser.parse(segment.text)}\\end{equation}`}</MathJax>
        </div>
    );
});
