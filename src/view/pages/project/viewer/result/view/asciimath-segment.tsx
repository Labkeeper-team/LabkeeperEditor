import classNames from 'classnames';
import { forwardRef, memo, useRef } from 'react';
import { MathJax } from 'better-react-mathjax';
import { TextOutputSegment } from '../../../../../../model/domain.ts';
import { parser } from './utils.tsx';

const SPLIT_REGEX = /[\n|\r]/;

export const AsciimathSegment = memo(
    forwardRef<
        HTMLDivElement,
        { segment: TextOutputSegment; index: number; onClick: () => void }
    >(({ segment, index, onClick }, ref) => {
        const segmentRef = useRef<HTMLDivElement>(null);
        const onClickTimeout = () => {
            setTimeout(onClick, 1);
        };
        if (!segment?.text) {
            return <div />;
        }

        return (
            <div
                id={`result-segment-${index}`}
                onMouseDown={onClickTimeout}
                ref={ref ?? segmentRef}
                className={classNames({
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
    })
);
