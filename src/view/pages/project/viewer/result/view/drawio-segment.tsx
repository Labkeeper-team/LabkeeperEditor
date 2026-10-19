import { forwardRef, memo, useState } from 'react';
import { DrawIoEmbed, DrawIoEmbedRef, EventExport } from 'react-drawio';

import { TextOutputSegment } from '../../../../../../model/domain.ts';
import { DiagramFrame } from './diagram-segment.tsx';
import {
    DiagramPicture,
    DiagramSourceError,
    DRAWIO_BASE_URL,
    drawioXmlError,
    useBrowserDiagramText,
    useDiagram,
} from './diagram.ts';

// редактор diagrams.net грузится с их сайта, без сети он не придёт
const DRAW_TIMEOUT_MS = 30_000;

const DRAWIO_URL_PARAMETERS = {
    ui: 'min',
    spin: false,
    noSaveBtn: true,
    noExitBtn: true,
} as const;

let embedCount = 0;

type Pending = {
    resolve: (picture: DiagramPicture) => void;
    reject: (error: Error) => void;
};

/**
 * Связь с DrawIoEmbed. Он берёт обработчики первой отрисовки и слушает сообщения
 * всех своих iframe на странице, поэтому всё живёт здесь, а экспорт помечен
 * меткой этого сегмента. Создаётся один раз на сегмент
 */
function createDrawioBridge(onXml: (xml: string) => void) {
    const tag = `result-drawio-${(embedCount += 1)}`;
    const embed: { current: DrawIoEmbedRef | null } = { current: null };
    let pending: Pending | null = null;
    let xml: string | null = null;
    let loaded = false;

    const exportPicture = () =>
        embed.current?.exportDiagram({
            format: 'svg',
            tag,
        } as Parameters<DrawIoEmbedRef['exportDiagram']>[0]);

    return {
        embed,
        onLoad: () => {
            loaded = true;
            exportPicture();
        },
        onExport: (data: EventExport) => {
            const message = data.message as { tag?: string } | undefined;
            if (message?.tag !== tag || !pending) {
                return;
            }
            pending.resolve({ kind: 'image', src: data.data });
            pending = null;
        },
        draw: (text: string) =>
            new Promise<DiagramPicture>((resolve, reject) => {
                if (drawioXmlError(text) !== null) {
                    reject(new DiagramSourceError('bad_drawio_xml'));
                    return;
                }
                const timer = window.setTimeout(() => {
                    pending = null;
                    reject(new Error(''));
                }, DRAW_TIMEOUT_MS);
                pending = {
                    resolve: (picture) => {
                        window.clearTimeout(timer);
                        resolve(picture);
                    },
                    reject,
                };
                if (xml === text && loaded) {
                    // этот XML уже в редакторе, и второй раз он не загрузится
                    exportPicture();
                    return;
                }
                xml = text;
                onXml(text);
            }),
    };
}

/**
 * GH-171: сегмент drawio в результате markdown-проекта. Схему рисует DrawIoEmbed
 * по XML исходника, но сам редактор с панелями в документе не нужен, а при
 * «Сохранить в PDF» содержимое чужого iframe не печатается. Поэтому редактор
 * стоит скрытым и отдаёт схему в SVG, а в документе картинка
 */
export const DrawioSegment = memo(
    forwardRef<
        HTMLDivElement,
        { segment: TextOutputSegment; index: number; onClick: () => void }
    >(({ segment, index, onClick }, ref) => {
        const [xml, setXml] = useState<string>();
        const [bridge] = useState(() => createDrawioBridge(setXml));

        const state = useDiagram(
            useBrowserDiagramText(segment.text),
            bridge.draw
        );
        return (
            <DiagramFrame
                ref={ref}
                index={index}
                onClick={onClick}
                state={state}
            >
                {xml !== undefined ? (
                    <div className="result-diagram__drawio-host" inert>
                        <DrawIoEmbed
                            ref={(embed) => {
                                bridge.embed.current = embed;
                            }}
                            baseUrl={DRAWIO_BASE_URL}
                            urlParameters={DRAWIO_URL_PARAMETERS}
                            xml={xml}
                            onLoad={bridge.onLoad}
                            onExport={bridge.onExport}
                        />
                    </div>
                ) : null}
            </DiagramFrame>
        );
    })
);
