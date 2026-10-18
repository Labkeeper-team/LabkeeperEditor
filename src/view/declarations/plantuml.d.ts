declare module '@plantuml/core' {
    export function renderToString(
        lines: string[],
        onSuccess: (svg: string) => void,
        onError: (message: string) => void,
        options?: { dark?: boolean; maxSvgSize?: number } | null
    ): void;
}

declare module '@plantuml/core/viz-global.js';
