import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';

import { StorageState } from '../../../../../store';

/** Схема как картинка (img) или как разметка SVG, которую библиотека уже очистила */
export type DiagramPicture =
    { kind: 'image'; src: string } | { kind: 'svg'; markup: string };

/** Ошибка исходника, которую объясняем своими словами, а не текстом библиотеки */
export class DiagramSourceError extends Error {
    constructor(readonly reason: 'bad_drawio_xml') {
        super(reason);
    }
}

export type DiagramState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; picture: DiagramPicture }
    | {
          status: 'error';
          message: string;
          reason?: DiagramSourceError['reason'];
      };

/**
 * GH-171: рисует исходник схемы. Ответ помнит, к какому тексту он относится:
 * пока рисуется новый, старый ответ его не перебьёт, а готовая схема стоит на
 * месте, чтобы при наборе не мигать. Ошибка библиотеки становится текстом
 * ошибки сегмента, а не пустым блоком. draw должен быть один на всё время жизни
 */
export function useDiagram(
    text: string | null,
    draw: (text: string) => Promise<DiagramPicture>
): DiagramState {
    const [result, setResult] = useState<{
        text: string;
        state: DiagramState;
    } | null>(null);

    useEffect(() => {
        if (text === null) {
            return;
        }
        let current = true;
        draw(text)
            .then((picture) => {
                if (current) {
                    setResult({ text, state: { status: 'ready', picture } });
                }
            })
            .catch((error: unknown) => {
                if (current) {
                    setResult({
                        text,
                        state:
                            error instanceof DiagramSourceError
                                ? {
                                      status: 'error',
                                      message: '',
                                      reason: error.reason,
                                  }
                                : {
                                      status: 'error',
                                      message:
                                          error instanceof Error
                                              ? error.message
                                              : String(error),
                                  },
                    });
                }
            });
        return () => {
            current = false;
        };
    }, [text, draw]);

    if (text === null) {
        return { status: 'idle' };
    }
    if (!result) {
        return { status: 'loading' };
    }
    if (result.text !== text && result.state.status !== 'ready') {
        return { status: 'loading' };
    }
    return result.state;
}

/**
 * Исходник, если схему рисует браузер, иначе null. GH-171: в latex-проекте
 * схемы рисует сервер в PDF, а библиотеки браузера им не нужны
 */
export function useBrowserDiagramText(text: string): string | null {
    const isMarkdownProject = useSelector(
        (state: StorageState) => state.project.mode === 'markdown'
    );
    return isMarkdownProject ? text : null;
}

/** Картинка SVG из разметки: в img скрипты и ссылки внутри схемы не работают */
export const svgImage = (svg: string): DiagramPicture => ({
    kind: 'image',
    src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
});

/** Без @startuml PlantUML ничего не рисует, а писать его каждый раз незачем. wrapped: обёртку дописали мы */
export const plantUmlLines = (
    text: string
): { lines: string[]; wrapped: boolean } => {
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    return lines.some((line) => /^\s*@start/i.test(line))
        ? { lines, wrapped: false }
        : { lines: ['@startuml', ...lines, '@enduml'], wrapped: true };
};

/**
 * PlantUML не зовёт onError на ошибке в исходнике, а рисует картинку с ней.
 * Узнаём её по строке «[From textarea (line N) ]», которой в схеме не бывает,
 * и берём из неё текст ошибки. null, если это обычная схема
 */
export const plantUmlErrorText = (
    svg: string,
    wrapped = false
): string | null => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const lines = [...doc.getElementsByTagName('text')].map(
        (node) => node.textContent?.trim() ?? ''
    );
    if (!lines.some((line) => /^\[From .*\(line \d+\)\s*\]$/.test(line))) {
        return null;
    }
    // первая строка это версия PlantUML, вторая место ошибки. @startuml мог
    // дописать plantUmlLines: тогда он не человека, и строки сдвинуты на одну
    return lines
        .filter(
            (line) =>
                line &&
                !/^PlantUML version/i.test(line) &&
                !(wrapped && line === '@startuml')
        )
        .map((line) =>
            wrapped
                ? line.replace(
                      /\(line (\d+)\)/,
                      (_, n: string) => `(line ${Number(n) - 1})`
                  )
                : line
        )
        .join('\n');
};

export const DRAWIO_BASE_URL = 'https://embed.diagrams.net';

/** null, если это XML схемы draw.io. Иначе редактор молча показал бы пустой лист */
export const drawioXmlError = (text: string): string | null => {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) {
        return 'parsererror';
    }
    const root = doc.documentElement?.nodeName;
    return root === 'mxfile' || root === 'mxGraphModel' ? null : root;
};
