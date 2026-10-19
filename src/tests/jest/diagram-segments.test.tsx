import { act, render, screen, waitFor } from '@testing-library/react';
import { forwardRef, useEffect, useImperativeHandle } from 'react';

import { MermaidSegment } from '../../view/pages/project/viewer/result/view/mermaid-segment.tsx';
import { PlantUmlSegment } from '../../view/pages/project/viewer/result/view/plantuml-segment.tsx';
import { DrawioSegment } from '../../view/pages/project/viewer/result/view/drawio-segment.tsx';
import { TextOutputSegment, DiagramSegmentType } from '../../model/domain.ts';
import { en } from '../../viewModel/dictionaries/en.ts';

/**
 * GH-171: сегменты mermaid, plantuml и drawio в результате markdown-проекта.
 * Библиотеки подменены: проверяется, что их ответ попадает в документ, а их
 * ошибка становится ошибкой сегмента, а не пустым блоком
 */

const mockState = {
    persistence: { language: 'en' },
    project: { mode: 'markdown' },
};
jest.mock('react-redux', () => ({
    useSelector: (selector: (state: unknown) => unknown) => selector(mockState),
}));

const VALID = 'valid source';
const INVALID = 'broken source';

jest.mock('mermaid', () => ({
    __esModule: true,
    default: {
        initialize: jest.fn(),
        parse: jest.fn(async (text: string) => {
            if (text === 'broken source') {
                throw new Error('Parse error on line 1');
            }
            return { diagramType: 'flowchart' };
        }),
        render: jest.fn(async () => ({
            svg: '<svg data-testid="mermaid-svg"><text>Mermaid ok</text></svg>',
            diagramType: 'flowchart',
        })),
    },
}));

// так PlantUML отвечает на ошибку в исходнике: картинкой с текстом ошибки, а не вызовом onError
const PLANTUML_ERROR_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg"><text>PlantUML version 1</text>' +
    '<text>[From textarea (line 2) ]</text><text>@startuml</text>' +
    '<text>broken source</text><text>Syntax Error?</text></svg>';
// как настоящий движок: отвечает не сразу, а из двух вызовов внахлёст ответ приходит только последнему
let mockPlantUmlCall = 0;
jest.mock('@plantuml/core', () => ({
    renderToString: jest.fn(
        (
            lines: string[],
            onSuccess: (svg: string) => void,
            onError: (message: string) => void
        ) => {
            const call = (mockPlantUmlCall += 1);
            setTimeout(() => {
                if (call !== mockPlantUmlCall) {
                    return;
                }
                if (lines.includes('engine down')) {
                    onError('engine failed');
                } else if (lines.includes('broken source')) {
                    onSuccess(PLANTUML_ERROR_SVG);
                } else {
                    onSuccess(
                        `<svg xmlns="http://www.w3.org/2000/svg"><text>${lines[1]}</text></svg>`
                    );
                }
            }, 0);
        }
    ),
}));

// редактор diagrams.net как в react-drawio: каждый экземпляр слушает экспорт всех iframe на странице
const mockExportListeners = new Set<(data: unknown) => void>();
jest.mock('react-drawio', () => ({
    DrawIoEmbed: forwardRef(
        (
            props: {
                xml?: string;
                onLoad?: (data: { xml: string }) => void;
                onExport?: (data: unknown) => void;
            },
            ref
        ) => {
            useImperativeHandle(ref, () => ({
                // ответ iframe приходит через postMessage, то есть позже
                exportDiagram: (message: Record<string, unknown>) =>
                    setTimeout(() =>
                        mockExportListeners.forEach((listener) =>
                            listener({
                                event: 'export',
                                message,
                                data: `data:image/svg+xml,${encodeURIComponent(props.xml ?? '')}`,
                            })
                        )
                    ),
            }));
            useEffect(() => {
                const listener = (data: unknown) => props.onExport?.(data);
                mockExportListeners.add(listener);
                return () => {
                    mockExportListeners.delete(listener);
                };
                // как в react-drawio: обработчики берутся один раз, при первой отрисовке
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, []);
            useEffect(() => {
                props.onLoad?.({ xml: props.xml ?? '' });
                // загрузка идёт только на новый XML, как у настоящего редактора
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [props.xml]);
            return <iframe title="Diagrams.net" />;
        }
    ),
}));

const drawioXml = (label: string) =>
    `<mxGraphModel><root><mxCell id="0"/><mxCell id="1" value="${label}" parent="0"/></root></mxGraphModel>`;
const DRAWIO_XML = drawioXml('one');
const pictureOf = (container: HTMLElement) =>
    decodeURIComponent(
        container
            .querySelector('img.result-diagram__picture')
            ?.getAttribute('src') ?? ''
    );

const segmentOf = (type: DiagramSegmentType, text: string) =>
    ({ type, text }) as TextOutputSegment;

const renderSegment = (
    Component: typeof MermaidSegment,
    type: DiagramSegmentType,
    text: string
) =>
    render(
        <Component
            segment={segmentOf(type, text)}
            index={0}
            onClick={() => {}}
        />
    );

beforeAll(() => {
    // Graphviz грузится классическим скриптом, а jsdom скрипты не грузит
    (globalThis as { Viz?: object }).Viz = {};
});

beforeEach(() => {
    mockState.project.mode = 'markdown';
});

const segmentError = () => screen.findByRole('alert');

describe('mermaid', () => {
    test('a valid source is drawn into the document', async () => {
        renderSegment(MermaidSegment, 'mermaid', VALID);
        expect((await screen.findByTestId('mermaid-svg')).textContent).toBe(
            'Mermaid ok'
        );
        expect(screen.queryByRole('alert')).toBeNull();
    });

    test('an invalid source shows the segment error with the reason', async () => {
        renderSegment(MermaidSegment, 'mermaid', INVALID);
        const error = (await segmentError()).textContent;
        expect(error).toContain(en.diagram.failed);
        expect(error).toContain('Parse error on line 1');
    });
});

describe('plantuml', () => {
    test('a valid source is drawn as a picture', async () => {
        const { container } = renderSegment(PlantUmlSegment, 'plantuml', VALID);
        await waitFor(() =>
            expect(
                container.querySelector('img.result-diagram__picture')
            ).not.toBeNull()
        );
        const src = container
            .querySelector('img.result-diagram__picture')!
            .getAttribute('src')!;
        expect(decodeURIComponent(src)).toContain(`<text>${VALID}</text>`);
        expect(screen.queryByRole('alert')).toBeNull();
    });

    test('a syntax error drawn by PlantUML becomes the segment error', async () => {
        const { container } = renderSegment(
            PlantUmlSegment,
            'plantuml',
            INVALID
        );
        const error = (await segmentError()).textContent;
        expect(error).toContain(en.diagram.failed);
        // @startuml дописали мы: человек видит свою строку 1, а не нашу
        expect(error).toContain('(line 1)');
        expect(error).not.toContain('@startuml');
        expect(container.querySelector('img')).toBeNull();
    });

    test('two plantuml segments drawn at once both get their picture', async () => {
        const first = renderSegment(
            PlantUmlSegment,
            'plantuml',
            'Alice -> Bob'
        );
        const second = renderSegment(PlantUmlSegment, 'plantuml', 'Bob -> Eve');
        await waitFor(() => {
            expect(pictureOf(first.container)).toContain('Alice -> Bob');
            expect(pictureOf(second.container)).toContain('Bob -> Eve');
        });
    });

    test('an engine failure becomes the segment error too', async () => {
        renderSegment(PlantUmlSegment, 'plantuml', 'engine down');
        expect((await segmentError()).textContent).toContain('engine failed');
    });
});

describe('drawio', () => {
    test('a valid XML is drawn as a picture through DrawIoEmbed', async () => {
        const { container } = renderSegment(
            DrawioSegment,
            'drawio',
            DRAWIO_XML
        );
        await waitFor(() => expect(pictureOf(container)).toContain('one'));
        expect(screen.queryByRole('alert')).toBeNull();
    });

    test('not a draw.io XML shows the segment error without the editor', async () => {
        renderSegment(DrawioSegment, 'drawio', '<html>not a diagram</html>');
        expect((await segmentError()).textContent).toContain(
            en.diagram.bad_drawio_xml
        );
        expect(screen.queryByTitle('Diagrams.net')).toBeNull();
    });

    test('two drawio segments each keep their own picture', async () => {
        // react-drawio шлёт экспорт каждого iframe всем экземплярам на странице
        const { container } = render(
            <>
                <DrawioSegment
                    segment={segmentOf('drawio', drawioXml('one'))}
                    index={0}
                    onClick={() => {}}
                />
                <DrawioSegment
                    segment={segmentOf('drawio', drawioXml('two'))}
                    index={1}
                    onClick={() => {}}
                />
            </>
        );
        const pictures = () =>
            [...container.querySelectorAll('img.result-diagram__picture')].map(
                (img) => decodeURIComponent(img.getAttribute('src') ?? '')
            );
        await waitFor(() => expect(pictures()).toHaveLength(2));
        expect(pictures()[0]).toContain('one');
        expect(pictures()[1]).toContain('two');
    });
});

test('in a latex project the libraries do not draw: the server puts the diagram into the PDF', async () => {
    mockState.project.mode = 'latex';
    const mermaid = (await import('mermaid')).default;
    (mermaid.render as jest.Mock).mockClear();
    const { container } = renderSegment(MermaidSegment, 'mermaid', VALID);
    await act(async () => {});
    expect(mermaid.render).not.toHaveBeenCalled();
    expect(container.querySelector('svg, img, [role="alert"]')).toBeNull();
});
