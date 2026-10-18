import classNames from 'classnames';
import { forwardRef, memo, useEffect, useRef, useState } from 'react';
import { DrawIoEmbed, UrlParameters } from 'react-drawio';
import { TextOutputSegment } from '../../../../../../model/domain.ts';
import { renderMermaid, renderPlantuml, svgToImageSource } from './diagrams.ts';

interface DiagramSegmentProps {
    segment: TextOutputSegment;
    index: number;
    onClick: () => void;
}

interface DiagramImage {
    image?: string;
    error?: string;
}

/** Пока исходник правят, неудачный рендер не стирает последнюю удачную картинку. */
const useDiagramImage = (
    source: string,
    render: (source: string) => Promise<string>
): DiagramImage => {
    const [state, setState] = useState<DiagramImage>({});
    const blank = !source.trim();
    useEffect(() => {
        if (blank) {
            return;
        }
        let actual = true;
        render(source).then(
            (svg) => {
                if (actual) {
                    setState({ image: svgToImageSource(svg) });
                }
            },
            (error: unknown) => {
                if (actual) {
                    setState((previous) => ({
                        image: previous.image,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    }));
                }
            }
        );
        return () => {
            actual = false;
        };
    }, [source, blank, render]);
    return blank ? {} : state;
};

const DiagramSegmentContainer = forwardRef<
    HTMLDivElement,
    DiagramSegmentProps & { children: React.ReactNode }
>(({ index, onClick, children }, ref) => {
    const segmentRef = useRef<HTMLDivElement>(null);
    const onClickTimeout = () => {
        setTimeout(onClick, 1);
    };
    return (
        <div
            id={`result-segment-${index}`}
            onMouseDown={onClickTimeout}
            ref={ref ?? segmentRef}
            className={classNames({
                'markdown-body': true,
                'result-segment': true,
                'diagram-segment': true,
            })}
        >
            {children}
        </div>
    );
});

const SvgDiagramSegment = forwardRef<
    HTMLDivElement,
    DiagramSegmentProps & { render: (source: string) => Promise<string> }
>(({ render, ...props }, ref) => {
    const { image, error } = useDiagramImage(props.segment.text, render);
    return (
        <DiagramSegmentContainer {...props} ref={ref}>
            {image && (
                <img
                    className="diagram-segment-image"
                    src={image}
                    alt={props.segment.type}
                />
            )}
            {error && <pre className="diagram-segment-error">{error}</pre>}
        </DiagramSegmentContainer>
    );
});

export const MermaidSegment = memo(
    forwardRef<HTMLDivElement, DiagramSegmentProps>((props, ref) => (
        <SvgDiagramSegment {...props} render={renderMermaid} ref={ref} />
    ))
);

export const PlantumlSegment = memo(
    forwardRef<HTMLDivElement, DiagramSegmentProps>((props, ref) => (
        <SvgDiagramSegment {...props} render={renderPlantuml} ref={ref} />
    ))
);

/** Встроенный просмотрщик draw.io без панелей редактора. */
const DRAWIO_VIEWER: UrlParameters = {
    ui: 'min',
    chrome: false,
    spin: true,
};

export const DrawioSegment = memo(
    forwardRef<HTMLDivElement, DiagramSegmentProps>((props, ref) => (
        <DiagramSegmentContainer {...props} ref={ref}>
            {props.segment.text.trim() && (
                <div className="diagram-segment-drawio">
                    <DrawIoEmbed
                        xml={props.segment.text}
                        urlParameters={DRAWIO_VIEWER}
                    />
                </div>
            )}
        </DiagramSegmentContainer>
    ))
);
