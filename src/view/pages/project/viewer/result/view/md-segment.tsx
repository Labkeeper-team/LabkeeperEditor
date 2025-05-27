import classNames from 'classnames';
import Markdown from 'react-markdown';
import { useIsSegmentIsActive } from '../../../../../../viewModel/store/selectors/program';
import { useSelector } from 'react-redux';
import { forwardRef, useRef } from 'react';
import remarkMath from 'remark-math';

import remarkBreaks from 'remark-breaks';
import { MathJax } from 'better-react-mathjax';
import remarkGfm from 'remark-gfm';
import { TextOutputSegment } from '../../../../../../model/domain.ts';

export const MdSegment = forwardRef<
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
            <Markdown
                remarkPlugins={[remarkBreaks, remarkMath, remarkGfm]}
                components={{
                    img(props) {
                        return (
                            <img
                                src={props.src}
                                alt={props.alt}
                                width="500px"
                                style={{
                                    display: 'block',
                                    marginLeft: 'auto',
                                    marginRight: 'auto',
                                }}
                            />
                        );
                    },
                    code(props) {
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        const { children, className, node, ...rest } = props;

                        if (className === 'language-math math-inline') {
                            return <MathJax inline>{`$${children}$`}</MathJax>;
                        }
                        if (className === 'language-math math-display') {
                            return <MathJax>{`$$${children}$$`}</MathJax>;
                        }

                        return (
                            <code {...rest} className={className}>
                                {children}
                            </code>
                        );
                    },
                }}
                className={'result-markdown'}
            >
                {segment.text}
            </Markdown>
        </div>
    );
});
