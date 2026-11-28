import { useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import type { Ref } from 'react';
import { createPortal } from 'react-dom';

export interface AgentMarkHintHandle {
    show: (clientX: number, clientY: number) => void;
    hide: () => void;
}

/** Отступ подсказки от указателя и от краёв окна, px */
const POINTER_GAP = 14;
const EDGE_GAP = 8;

/**
 * GH-190: подсказка у указателя над отметкой правки агента: отметка это
 * часть интерфейса, а не PDF. Показывает её pdf.tsx через ref, чтобы движение
 * мыши не перерисовывало весь просмотр PDF
 */
export const AgentMarkHint = ({
    text,
    ref,
}: {
    text: string;
    ref: Ref<AgentMarkHintHandle>;
}) => {
    const [pointer, setPointer] = useState<{ x: number; y: number } | null>(
        null
    );
    const elementRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(
        ref,
        () => ({
            show: (x, y) => setPointer({ x, y }),
            hide: () => setPointer(null),
        }),
        []
    );

    // справа снизу от указателя, а у края окна по другую сторону от него
    useLayoutEffect(() => {
        const element = elementRef.current;
        if (!element || !pointer) {
            return;
        }
        const { width, height } = element.getBoundingClientRect();
        const left =
            pointer.x + POINTER_GAP + width + EDGE_GAP > window.innerWidth
                ? pointer.x - POINTER_GAP - width
                : pointer.x + POINTER_GAP;
        const top =
            pointer.y + POINTER_GAP + height + EDGE_GAP > window.innerHeight
                ? pointer.y - POINTER_GAP - height
                : pointer.y + POINTER_GAP;
        element.style.left = `${Math.max(EDGE_GAP, left)}px`;
        element.style.top = `${Math.max(EDGE_GAP, top)}px`;
    }, [pointer]);

    if (!pointer) {
        return null;
    }
    return createPortal(
        <div ref={elementRef} className="pdf-agent-mark-hint" role="tooltip">
            {text}
        </div>,
        document.body
    );
};
