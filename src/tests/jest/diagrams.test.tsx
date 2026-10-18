import { act, render, screen } from '@testing-library/react';
import { RequestResult } from '../../model/rpi';
import { TextOutputSegment, UserInfo } from '../../model/domain.ts';
import { mockContext } from './common.ts';
import { svgToImageSource } from '../../view/pages/project/viewer/result/view/diagrams.ts';
import { MermaidSegment } from '../../view/pages/project/viewer/result/view/diagram-segment.tsx';

const mockRenderMermaid = jest.fn<Promise<string>, [string]>();

jest.mock('../../view/pages/project/viewer/result/view/diagrams.ts', () => ({
    ...jest.requireActual(
        '../../view/pages/project/viewer/result/view/diagrams.ts'
    ),
    renderMermaid: (source: string) => mockRenderMermaid(source),
}));
// диаграммы draw.io рисует iframe embed.diagrams.net, здесь он не нужен
jest.mock('react-drawio', () => ({ DrawIoEmbed: () => null }));

global.structuredClone = (val) =>
    val === undefined ? undefined : JSON.parse(JSON.stringify(val));

const DIAGRAM = 'flowchart LR\n    A[${a}] --> B';
const SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" width="100%" viewBox="0 0 120 40"><text>A</text></svg>';

const decode = (source: string) =>
    decodeURIComponent(
        source.replace(/^data:image\/svg\+xml;charset=utf-8,/, '')
    );

const segment = (text: string): TextOutputSegment => ({
    type: 'mermaid',
    text,
});

beforeEach(() => {
    mockRenderMermaid.mockReset();
});

// `${...}` в диаграмме сервер не подставляет, поэтому превью не ждёт компиляции
test('diagram-preview-does-not-wait-for-computation', async () => {
    const ctx = mockContext();
    ctx.rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            isAuthenticated: false,
            email: 'a@gmail.com',
            id: 1,
            privacyPolicyAccepted: false,
            crossBorderDataTransferPolicyAccepted: true,
            tokenBalance: 0,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult<UserInfo>);
    await ctx.startupService.onAppStartup();
    await ctx.projectPageService.setProjectType('markdown');

    ctx.programEditorService.onAddSegmentClicked('computational');
    await ctx.programEditorService.onSegmentTextEdited(0, 'a = 10');
    ctx.programEditorService.onAddSegmentClicked('mermaid');
    await ctx.programEditorService.onSegmentTextEdited(1, DIAGRAM);
    ctx.programEditorService.onAddSegmentClicked('md');
    await ctx.programEditorService.onSegmentTextEdited(2, 'a = ${a}');
    ctx.startupService.ideService.onProgramUpdated();

    const segments =
        ctx.repository.projectViewModelRepository.compileSuccessResult()
            .segments;
    expect(segments[1]).toStrictEqual({ type: 'mermaid', text: DIAGRAM });
    expect(segments[2]).toStrictEqual({
        type: 'computational',
        statements: [{ type: 'no_result' }],
    });
});

test('svg-without-pixel-size-gets-size-from-view-box', () => {
    const image = decode(svgToImageSource(SVG));
    expect(image).toContain('width="120"');
    expect(image).toContain('height="40"');
});

test('svg-with-pixel-size-keeps-it', () => {
    const image = decode(
        svgToImageSource(
            '<svg xmlns="http://www.w3.org/2000/svg" width="300px" height="50px" viewBox="0 0 150 25"/>'
        )
    );
    expect(image).toContain('width="300px"');
    expect(image).toContain('height="50px"');
});

test('mermaid-segment-shows-diagram-as-image', async () => {
    mockRenderMermaid.mockResolvedValue(SVG);
    render(
        <MermaidSegment
            segment={segment(DIAGRAM)}
            index={0}
            onClick={jest.fn()}
        />
    );

    const image = await screen.findByRole('img');
    expect(image.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(mockRenderMermaid).toHaveBeenCalledWith(DIAGRAM);
});

test('mermaid-error-keeps-last-image', async () => {
    mockRenderMermaid.mockResolvedValueOnce(SVG);
    const { rerender } = render(
        <MermaidSegment
            segment={segment(DIAGRAM)}
            index={0}
            onClick={jest.fn()}
        />
    );
    await screen.findByRole('img');

    mockRenderMermaid.mockRejectedValueOnce(new Error('Parse error on line 2'));
    rerender(
        <MermaidSegment
            segment={segment('flowchart LR\n    A -->')}
            index={0}
            onClick={jest.fn()}
        />
    );

    expect(await screen.findByText('Parse error on line 2')).toBeTruthy();
    expect(screen.getByRole('img')).toBeTruthy();
});

test('empty-mermaid-segment-renders-nothing', async () => {
    render(
        <MermaidSegment segment={segment('  ')} index={0} onClick={jest.fn()} />
    );
    await act(async () => {});
    expect(screen.queryByRole('img')).toBeNull();
    expect(mockRenderMermaid).not.toHaveBeenCalled();
});
