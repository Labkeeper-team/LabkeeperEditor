import classNames from 'classnames';
import Markdown from 'react-markdown';
import { forwardRef, memo, useCallback, useRef } from 'react';
import remarkMath from 'remark-math';

import remarkBreaks from 'remark-breaks';
import { MathJax } from 'better-react-mathjax';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { TextOutputSegment } from '../../../../../../model/domain.ts';

const MD_COMPONENTS = {
    // GH-176: картинка в своём размере, широкая ужимается по сегменту, а размер из тега <img width> соблюдается
    img(props: React.ImgHTMLAttributes<HTMLImageElement>) {
        return (
            <img
                className="result-markdown__image"
                src={props.src}
                alt={props.alt}
                title={props.title}
                width={props.width}
                height={props.height}
            />
        );
    },
    code(props: React.HTMLAttributes<HTMLElement> & { node?: unknown }) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { children, className, node, ...rest } = props as {
            children?: React.ReactNode;
            className?: string;
            node?: unknown;
        };

        if (className === 'language-math math-inline' && children) {
            return <MathJax inline>{`$${children}$`}</MathJax>;
        }
        if (className === 'language-math math-display' && children) {
            return (
                <MathJax
                    style={{ fontSize: '17.8px' }}
                >{`$$${children}$$`}</MathJax>
            );
        }

        return (
            <code {...rest} className={className}>
                {children}
            </code>
        );
    },
} as const;

const MdContent = memo(({ text }: { text: string }) => (
    <div className="result-markdown">
        <Markdown
            remarkPlugins={[remarkBreaks, remarkMath, remarkGfm]}
            rehypePlugins={[rehypeRaw]}
            components={MD_COMPONENTS}
        >
            {text}
        </Markdown>
    </div>
));

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
                <MdContent text={segment.text} />
            </div>
        );
    })
);
