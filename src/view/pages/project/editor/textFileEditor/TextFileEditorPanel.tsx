import {
    PointerEvent as ReactPointerEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { TextFileEditor } from './index.tsx';

const MIN_WIDTH = 360;
const MIN_HEIGHT = 200;
const DEFAULT_WIDTH_RATIO = 0.55;
const DEFAULT_MAX_WIDTH = 960;
const MARGIN = 12;
const BOTTOM_OFFSET = 12;

type PanelSize = { width: number; height: number };
type PanelPosition = { x: number; y: number };

const clampPanel = (
    size: PanelSize,
    position: PanelPosition,
    bounds: { width: number; height: number }
): { size: PanelSize; position: PanelPosition } => {
    const maxWidth = Math.max(MIN_WIDTH, bounds.width - MARGIN * 2);
    const maxHeight = Math.max(
        MIN_HEIGHT,
        bounds.height - MARGIN - BOTTOM_OFFSET
    );

    const width = Math.min(Math.max(size.width, MIN_WIDTH), maxWidth);
    const height = Math.min(Math.max(size.height, MIN_HEIGHT), maxHeight);

    const maxX = Math.max(MARGIN, bounds.width - width - MARGIN);
    const maxY = Math.max(MARGIN, bounds.height - height - BOTTOM_OFFSET);

    return {
        size: { width, height },
        position: {
            x: Math.min(Math.max(position.x, MARGIN), maxX),
            y: Math.min(Math.max(position.y, MARGIN), maxY),
        },
    };
};

export const TextFileEditorPanel = () => {
    const panelRef = useRef<HTMLDivElement>(null);
    const dragStateRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originX: number;
        originY: number;
    } | null>(null);
    const resizeStateRef = useRef<{
        pointerId: number;
        startX: number;
        startY: number;
        originWidth: number;
        originHeight: number;
    } | null>(null);

    const [size, setSize] = useState<PanelSize>({
        width: DEFAULT_MAX_WIDTH,
        height: 420,
    });
    const [position, setPosition] = useState<PanelPosition>({
        x: MARGIN,
        y: MARGIN,
    });
    const panelStateRef = useRef({ size, position });
    panelStateRef.current = { size, position };

    const getBounds = useCallback(() => {
        const container = panelRef.current?.closest(
            '.project-container'
        ) as HTMLElement | null;
        return {
            width: container?.clientWidth ?? window.innerWidth,
            height: container?.clientHeight ?? window.innerHeight,
        };
    }, []);

    useEffect(() => {
        const frame = requestAnimationFrame(() => {
            const bounds = getBounds();
            const width = Math.min(
                DEFAULT_MAX_WIDTH,
                Math.max(
                    MIN_WIDTH,
                    Math.round(bounds.width * DEFAULT_WIDTH_RATIO)
                )
            );
            const height = Math.max(
                MIN_HEIGHT,
                bounds.height - MARGIN - BOTTOM_OFFSET
            );
            const next = clampPanel(
                { width, height },
                {
                    x: Math.round((bounds.width - width) / 2),
                    y: Math.round((bounds.height - height) / 2),
                },
                bounds
            );
            setSize(next.size);
            setPosition(next.position);
        });

        return () => cancelAnimationFrame(frame);
    }, [getBounds]);

    useEffect(() => {
        const onResize = () => {
            const bounds = getBounds();
            const next = clampPanel(
                panelStateRef.current.size,
                panelStateRef.current.position,
                bounds
            );
            setSize(next.size);
            setPosition(next.position);
        };

        window.addEventListener('resize', onResize);
        return () => window.removeEventListener('resize', onResize);
    }, [getBounds]);

    const onHeaderPointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) {
                return;
            }
            const target = event.target as HTMLElement;
            if (target.closest('.text-file-editor-close')) {
                return;
            }

            event.preventDefault();
            dragStateRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originX: position.x,
                originY: position.y,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        [position.x, position.y]
    );

    const onHeaderPointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const dragState = dragStateRef.current;
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }

            const bounds = getBounds();
            const next = clampPanel(
                size,
                {
                    x: dragState.originX + (event.clientX - dragState.startX),
                    y: dragState.originY + (event.clientY - dragState.startY),
                },
                bounds
            );
            setPosition(next.position);
        },
        [getBounds, size]
    );

    const onHeaderPointerUp = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const dragState = dragStateRef.current;
            if (!dragState || dragState.pointerId !== event.pointerId) {
                return;
            }
            dragStateRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
        },
        []
    );

    const onResizePointerDown = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            resizeStateRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                originWidth: size.width,
                originHeight: size.height,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
        },
        [size.height, size.width]
    );

    const onResizePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const resizeState = resizeStateRef.current;
            if (!resizeState || resizeState.pointerId !== event.pointerId) {
                return;
            }

            const bounds = getBounds();
            const next = clampPanel(
                {
                    width:
                        resizeState.originWidth +
                        (event.clientX - resizeState.startX),
                    height:
                        resizeState.originHeight +
                        (event.clientY - resizeState.startY),
                },
                position,
                bounds
            );
            setSize(next.size);
            setPosition(next.position);
        },
        [getBounds, position]
    );

    const onResizePointerUp = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            const resizeState = resizeStateRef.current;
            if (!resizeState || resizeState.pointerId !== event.pointerId) {
                return;
            }
            resizeStateRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
        },
        []
    );

    return (
        <div
            ref={panelRef}
            className="text-file-editor-panel"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
            }}
        >
            <TextFileEditor
                draggableHeader
                onHeaderPointerDown={onHeaderPointerDown}
                onHeaderPointerMove={onHeaderPointerMove}
                onHeaderPointerUp={onHeaderPointerUp}
            />
            <div
                className="text-file-editor-resize-handle"
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
                aria-hidden
            />
        </div>
    );
};
