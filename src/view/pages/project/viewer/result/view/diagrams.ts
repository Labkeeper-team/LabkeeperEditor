import type { Mermaid } from 'mermaid';

type PlantumlEngine = typeof import('@plantuml/core');

let mermaidEngine: Promise<Mermaid> | null = null;
let plantumlEngine: Promise<PlantumlEngine> | null = null;
let mermaidRenderCount = 0;

// Движки весят мегабайты: грузятся отдельными чанками, только когда на странице есть такая диаграмма
const loadMermaid = (): Promise<Mermaid> => {
    mermaidEngine ??= import('mermaid').then(({ default: mermaid }) => {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            suppressErrorRendering: true,
        });
        return mermaid;
    });
    return mermaidEngine;
};

const loadPlantuml = (): Promise<PlantumlEngine> => {
    plantumlEngine ??= import('@plantuml/core/viz-global.js').then((viz) => {
        // UMD-сборка graphviz кладёт Viz либо в globalThis, либо в экспорт модуля
        const scope = globalThis as { Viz?: unknown; PLANTUML_VIZ?: unknown };
        scope.PLANTUML_VIZ = scope.Viz ?? viz.default ?? viz;
        return import('@plantuml/core');
    });
    return plantumlEngine;
};

export const renderMermaid = async (source: string): Promise<string> => {
    const mermaid = await loadMermaid();
    mermaidRenderCount += 1;
    const { svg } = await mermaid.render(
        `mermaid-segment-${mermaidRenderCount}`,
        source
    );
    return svg;
};

export const renderPlantuml = async (source: string): Promise<string> => {
    const plantuml = await loadPlantuml();
    return new Promise((resolve, reject) =>
        plantuml.renderToString(
            source.split(/\r\n|\r|\n/),
            resolve,
            (message) => reject(new Error(message))
        )
    );
};

/**
 * SVG показывается картинкой: скрипты и ссылки из диаграммы в ней не работают,
 * а SVG plantuml ничем не очищается.
 */
export const svgToImageSource = (svg: string): string => {
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const root = parsed.documentElement;
    // mermaid ставит width="100%": у картинки без размера в пикселях нет своей ширины
    const viewBox = root
        .getAttribute('viewBox')
        ?.trim()
        .split(/[\s,]+/);
    if (viewBox?.length === 4 && !root.getAttribute('width')?.endsWith('px')) {
        root.setAttribute('width', viewBox[2]);
        root.setAttribute('height', viewBox[3]);
    }
    const serialized = new XMLSerializer().serializeToString(parsed);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(serialized)}`;
};
