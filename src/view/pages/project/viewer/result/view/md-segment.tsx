import classNames from 'classnames';
import Markdown from 'react-markdown';
import { forwardRef, memo, useCallback, useRef } from 'react';
import remarkMath from 'remark-math';

import remarkBreaks from 'remark-breaks';
import { MathJax } from 'better-react-mathjax';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { TextOutputSegment } from '../../../../../../model/domain.ts';

export const MdSegment = memo(
    forwardRef<
        HTMLDivElement,
        { segment: TextOutputSegment; index: number; onClick: () => void }
    >(({ segment, index, onClick }, ref) => {
        const segmentRef = useRef<HTMLDivElement>(null);
        const onClickTimeout = useCallback(() => {
            setTimeout(onClick, 1);
        }, [onClick]);
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
                <Markdown
                    remarkPlugins={[remarkBreaks, remarkMath, remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
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
                            const { children, className, node, ...rest } =
                                props;

                            if (
                                className === 'language-math math-inline' &&
                                children
                            ) {
                                return (
                                    <MathJax inline>{`$${children}$`}</MathJax>
                                );
                            }
                            if (
                                className === 'language-math math-display' &&
                                children
                            ) {
                                return (
                                    <MathJax
                                        style={{
                                            fontSize: '17.8px',
                                        }}
                                    >{`$$${children}$$`}</MathJax>
                                );
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
    })
);
