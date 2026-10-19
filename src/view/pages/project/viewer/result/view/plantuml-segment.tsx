import { forwardRef, memo } from 'react';
import vizUrl from '@plantuml/core/viz-global.js?url';

import { TextOutputSegment } from '../../../../../../model/domain.ts';
import { DiagramFrame } from './diagram-segment.tsx';
import {
    DiagramPicture,
    plantUmlErrorText,
    plantUmlLines,
    svgImage,
    useBrowserDiagramText,
    useDiagram,
} from './diagram.ts';

type PlantUmlApi = typeof import('@plantuml/core');

let plantUmlReady: Promise<PlantUmlApi> | null = null;

/**
 * viz-global.js (Graphviz) по README пакета подключается классическим скриптом
 * до движка: как модуль сборщик мог бы обернуть его в CommonJS, и Viz не попал
 * бы в globalThis. Оба файла весят мегабайты, поэтому грузятся с первой схемой
 */
const loadPlantUml = (): Promise<PlantUmlApi> => {
    plantUmlReady ??= new Promise<void>((resolve, reject) => {
        if ('Viz' in globalThis) {
            resolve();
            return;
        }
        const script = document.createElement('script');
        script.src = vizUrl;
        script.onload = () => resolve();
        script.onerror = () =>
            reject(new Error(`Graphviz did not load: ${vizUrl}`));
        document.head.appendChild(script);
    })
        .then(() => import('@plantuml/core'))
        .catch((error: unknown) => {
            plantUmlReady = null;
            throw error;
        });
    return plantUmlReady;
};

// движок рисует по одной схеме: из двух вызовов подряд ответ приходит только последнему
let queue: Promise<unknown> = Promise.resolve();

const drawPlantUml = (text: string): Promise<DiagramPicture> => {
    const drawing = queue.then(async () => {
        const { renderToString } = await loadPlantUml();
        const { lines, wrapped } = plantUmlLines(text);
        const svg = await new Promise<string>((resolve, reject) =>
            renderToString(lines, resolve, (message) =>
                reject(new Error(message))
            )
        );
        const error = plantUmlErrorText(svg, wrapped);
        if (error !== null) {
            throw new Error(error);
        }
        return svgImage(svg);
    });
    queue = drawing.catch(() => undefined);
    return drawing;
};

/** GH-171: сегмент plantuml в результате markdown-проекта, без запроса на сервер PlantUML */
export const PlantUmlSegment = memo(
    forwardRef<
        HTMLDivElement,
        { segment: TextOutputSegment; index: number; onClick: () => void }
    >(({ segment, index, onClick }, ref) => {
        const state = useDiagram(
            useBrowserDiagramText(segment.text),
            drawPlantUml
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
