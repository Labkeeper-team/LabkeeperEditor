import { forwardRef, memo } from 'react';

import { TextOutputSegment } from '../../../../../../model/domain.ts';
import { DiagramFrame } from './diagram-segment.tsx';
import {
    DiagramPicture,
    useBrowserDiagramText,
    useDiagram,
} from './diagram.ts';

type MermaidApi = (typeof import('mermaid'))['default'];

let mermaidReady: Promise<MermaidApi> | null = null;
let renderCount = 0;

/** Библиотека большая: грузим, только когда в проекте появилась схема */
const loadMermaid = (): Promise<MermaidApi> => {
    mermaidReady ??= import('mermaid')
        .then(({ default: mermaid }) => {
            // strict: исходник из чужого публичного проекта не выполнит скрипт и не откроет ссылку
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
            return mermaid;
        })
        .catch((error: unknown) => {
            mermaidReady = null;
            throw error;
        });
    return mermaidReady;
};

const drawMermaid = async (text: string): Promise<DiagramPicture> => {
    const mermaid = await loadMermaid();
    // parse бросает понятную ошибку, а render на неверном исходнике оставляет в документе картинку ошибки
    await mermaid.parse(text);
    const id = `result-mermaid-${(renderCount += 1)}`;
    try {
        const { svg } = await mermaid.render(id, text);
        return { kind: 'svg', markup: svg };
    } finally {
        document.getElementById(`d${id}`)?.remove();
    }
};

/** GH-171: сегмент mermaid в результате markdown-проекта */
export const MermaidSegment = memo(
    forwardRef<
        HTMLDivElement,
        { segment: TextOutputSegment; index: number; onClick: () => void }
    >(({ segment, index, onClick }, ref) => {
        const state = useDiagram(
            useBrowserDiagramText(segment.text),
            drawMermaid
        );
        return (
            <DiagramFrame
                ref={ref}
                index={index}
                onClick={onClick}
                state={state}
            />
        );
    })
);
