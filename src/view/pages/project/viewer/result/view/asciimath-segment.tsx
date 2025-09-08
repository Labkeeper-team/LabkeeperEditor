import classNames from 'classnames';
import { useIsSegmentIsActive } from '../../../../../store/selectors/program';
import { useSelector } from 'react-redux';
import { forwardRef, memo, useRef } from 'react';
import { MathJax } from 'better-react-mathjax';
import { TextOutputSegment } from '../../../../../../model/domain.ts';
import { parser } from './utils.tsx';

const SPLIT_REGEX = /[\n|\r]/;

export const AsciimathSegment = memo(
    forwardRef<HTMLDivElement, { segment: TextOutputSegment; index: number }>(
        ({ segment, index }, ref) => {
            const activeIndex = useSelector(useIsSegmentIsActive(index));
            const segmentRef = useRef<HTMLDivElement>(null);

            if (!segment?.text) {
                return <div />;
            }

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
                        .split(SPLIT_REGEX)
                        .filter((s) => s.length > 0)
                        .map((part, index) => (
                            <MathJax key={index}>
                                {`\\begin{equation}\n${parser.parse(part)}\n\\end{equation}\n`}
                            </MathJax>
                        ))}
                </div>
            );
        }
    )
);
