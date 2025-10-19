import classNames from 'classnames';
import { forwardRef, memo, useRef } from 'react';
import { TextOutputSegment } from '../../../../../../model/domain.ts';
import { MathJax } from 'better-react-mathjax';
import { useIsDelayedSegmentIsActive } from '../../../../../hooks/useIsDelayedSegmentIsActive.ts';

export const LatexSegment = memo(
    forwardRef<
        HTMLDivElement,
        { segment: TextOutputSegment; index: number; onClick: () => void }
    >(({ segment, index, onClick }, ref) => {
        const activeIndex = useIsDelayedSegmentIsActive(index);
        const segmentRef = useRef<HTMLDivElement>(null);

        return (
            <div
                onClick={onClick}
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
    })
);
