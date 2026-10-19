// GH-171: у @plantuml/core нет своих типов, API по README пакета 1.2026.8
declare module '@plantuml/core' {
    export function renderToString(
        lines: string[],
        onSuccess: (svg: string) => void,
        onError: (message: string) => void
    ): void;
    export function render(
        lines: string[],
        targetId: string,
        options?: { dark?: boolean }
    ): void;
}
