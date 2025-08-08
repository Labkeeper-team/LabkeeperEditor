import classNames from 'classnames';
import { useIsSegmentIsActive } from '../../../../../../viewModel/store/selectors/program';
import { useSelector } from 'react-redux';
import { forwardRef, useRef } from 'react';
import { TextOutputSegment } from '../../../../../../model/domain.ts';
import { MathJax } from 'better-react-mathjax';

export const LatexSegment = forwardRef<
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
            {segment.text
                .replaceAll('\\begin{equation}', '')
                .replaceAll('\\end{equation}', '')
                .split(/\\newline|\\\\/i)
                .map((line, index) => (
                    <MathJax key={index}>{`\\begin{equation}${line
                        .replaceAll('\\begin{equation}', '')
                        .replaceAll(
                            '\\end{equation}',
                            ''
                        )}\\end{equation}`}</MathJax>
                ))}
        </div>
    );
});
