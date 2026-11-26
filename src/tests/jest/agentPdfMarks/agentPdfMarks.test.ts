import type { Hunk, Segment } from '../../../model/domain.ts';
import type { PdfPosition, Rpi } from '../../../model/rpi';
import { Events } from '../../../model/service/ObserverService.ts';
import { agentChangeRanges } from '../../../viewModel/utils/agentChangeRanges.ts';
import {
    LINE_ASCENT_PT,
    LINE_DESCENT_PT,
    NavigationMarkLocator,
    type AgentPdfMark,
} from '../../../viewModel/domain/AgentPdfMarkLocator.ts';
import { agentMarkRects } from '../../../view/pages/project/viewer/result/agentMarkRects.ts';
import {
    mockContext,
    PROJECT_ID,
    PROJECT_TITLE,
    USER_EMAIL,
    USER_ID,
} from '../common.ts';

/** GH-190: правки агента отмечаются поверх PDF */

const hunk = (fields: Partial<Hunk> & Pick<Hunk, 'id' | 'type'>): Hunk =>
    fields as Hunk;

const segment = (type: Segment['type'], text: string): Segment => ({
    type,
    text,
    parameters: { visible: true },
});

const ok = <T>(body: T) => ({
    code: 200,
    body,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
});

const failed = (code: number) => ({
    code,
    body: undefined,
    isOk: false,
    isUnauth: code === 401,
    isForbidden: code === 403,
});

/** Навигация, которая знает места строк: ключ это «сегмент:строка» или «файл:строка» */
function navigation(
    positions: Record<string, PdfPosition>,
    otherwise: ReturnType<typeof failed> = failed(410)
) {
    return jest.fn(
        async (
            _projectId: string,
            body: {
                segmentId?: number | null;
                file?: string | null;
                line: number;
            }
        ) => {
            const position =
                positions[`${body.file ?? body.segmentId}:${body.line}`];
            return position ? ok(position) : otherwise;
        }
    );
}

describe('строки правок', () => {
    test('добавленные и заменённые строки сегментов и файлов', () => {
        const ranges = agentChangeRanges(
            [
                hunk({
                    id: 'a',
                    type: 'addLinesToSegment',
                    segmentId: 2,
                    startLine: 3,
                    endLine: 5,
                }),
                hunk({
                    id: 'b',
                    type: 'replaceTextInFile',
                    fileName: 'ch.tex',
                    startLine: 7,
                    endLine: 7,
                }),
                hunk({
                    id: 'c',
                    type: 'deleteLinesFromSegment',
                    segmentId: 1,
                    startLine: 1,
                    endLine: 2,
                }),
                hunk({
                    id: 'd',
                    type: 'changeSegmentParameters',
                    segmentId: 1,
                }),
                hunk({ id: 'e', type: 'deleteFile', fileName: 'old.tex' }),
            ],
            [segment('latex', 'a'), segment('latex', 'b')]
        );

        expect(ranges).toEqual([
            { hunkId: 'a', segmentId: 2, startLine: 3, endLine: 5 },
            { hunkId: 'b', file: 'ch.tex', startLine: 7, endLine: 7 },
        ]);
    });

    test('новый сегмент отмечается целиком, пустой не отмечается', () => {
        const ranges = agentChangeRanges(
            [
                hunk({ id: 'a', type: 'addSegment', segmentId: 1 }),
                hunk({ id: 'b', type: 'addSegment', segmentId: 2 }),
            ],
            [segment('latex', 'один\nдва\nтри'), segment('latex', '  ')]
        );

        expect(ranges).toEqual([
            { hunkId: 'a', segmentId: 1, startLine: 1, endLine: 3 },
        ]);
    });
});

describe('места правок по навигации', () => {
    const range = { hunkId: 'a', segmentId: 2, startLine: 3, endLine: 5 };

    test('верх по первой строке, низ по строке после правки, если она рядом', async () => {
        const request = navigation({
            '2:3': { page: 1, x: 70, y: 200 },
            '2:5': { page: 1, x: 70, y: 260 },
            // длинный абзац на последней строке правки: следующий текст на две строки ниже
            '2:6': { page: 1, x: 70, y: 300 },
        });

        const lookup = await new NavigationMarkLocator({
            navigationDocToPdfRequest: request,
        } as unknown as Rpi).locate(PROJECT_ID, [range]);

        expect(lookup).toEqual({
            outcome: 'located',
            requests: 3,
            marks: [
                {
                    hunkId: 'a',
                    mark: {
                        hunkId: 'a',
                        top: { page: 1, x: 70, y: 200 - LINE_ASCENT_PT },
                        bottom: { page: 1, x: 70, y: 300 - LINE_ASCENT_PT },
                    },
                },
            ],
        });
    });

    test('далёкий текст после правки не тянет отметку за собой', async () => {
        const request = navigation({
            '2:3': { page: 1, x: 70, y: 200 },
            '2:5': { page: 1, x: 70, y: 260 },
            // после последней строки страница пуста: SyncTeX отвечает её низом
            '2:6': { page: 1, x: 14, y: 863 },
        });

        const lookup = await new NavigationMarkLocator({
            navigationDocToPdfRequest: request,
        } as unknown as Rpi).locate(PROJECT_ID, [range]);

        expect(
            lookup.outcome === 'located' && lookup.marks[0].mark?.bottom
        ).toEqual({ page: 1, x: 70, y: 260 + LINE_DESCENT_PT });
    });

    test('правку чужого файла пропускаем, остальные ищем дальше', async () => {
        const request = navigation({
            '1:1': { page: 1, x: 70, y: 100 },
        });

        const lookup = await new NavigationMarkLocator({
            navigationDocToPdfRequest: request,
        } as unknown as Rpi).locate(PROJECT_ID, [
            { hunkId: 'file', file: 'notes.tex', startLine: 1, endLine: 1 },
            { hunkId: 'seg', segmentId: 1, startLine: 1, endLine: 1 },
        ]);

        expect(lookup.outcome).toBe('located');
        expect(
            lookup.outcome === 'located' &&
                lookup.marks.map((item) => [item.hunkId, Boolean(item.mark)])
        ).toEqual([
            ['file', false],
            ['seg', true],
        ]);
    });

    test('занятый проект останавливает поиск', async () => {
        const request = navigation({}, failed(423));

        const lookup = await new NavigationMarkLocator({
            navigationDocToPdfRequest: request,
        } as unknown as Rpi).locate(PROJECT_ID, [
            range,
            { ...range, hunkId: 'b' },
        ]);

        expect(lookup).toMatchObject({ outcome: 'unavailable', code: 423 });
        expect(request.mock.calls.length).toBeLessThanOrEqual(2);
    });
});

describe('отметки на страницах', () => {
    const page = (height: number, text: [number, number][] = []) => ({
        height,
        text: text.map(([top, bottom]) => ({ top, bottom })),
    });
    const mark = (
        hunkId: string,
        top: [number, number],
        bottom: [number, number]
    ): AgentPdfMark => ({
        hunkId,
        top: { page: top[0], x: 0, y: top[1] },
        bottom: { page: bottom[0], x: 0, y: bottom[1] },
    });

    test('правка через границу страниц делится на куски', () => {
        expect(
            agentMarkRects(
                [mark('a', [1, 700], [2, 120])],
                [page(842), page(842)]
            )
        ).toEqual([
            { pageIndex: 0, top: 700, bottom: 842 },
            { pageIndex: 1, top: 0, bottom: 120 },
        ]);
    });

    test('край за пределами страницы прижимается к последнему тексту', () => {
        const pages = [
            page(842, [
                [90, 106],
                [300, 316],
                [400, 416],
            ]),
        ];

        expect(agentMarkRects([mark('a', [1, 290], [1, 867])], pages)).toEqual([
            { pageIndex: 0, top: 290, bottom: 416 },
        ]);
    });

    test('соседние правки сливаются, а правка без текста на странице пропадает', () => {
        expect(
            agentMarkRects(
                [
                    mark('a', [1, 100], [1, 150]),
                    mark('b', [1, 151], [1, 200]),
                    mark('c', [1, 851], [1, 867]),
                ],
                [page(842)]
            )
        ).toEqual([{ pageIndex: 0, top: 100, bottom: 200 }]);
    });
});

describe('сервис отметок', () => {
    function setup(positions: Record<string, PdfPosition>) {
        const ctx = mockContext();
        const { repository, rpi } = ctx;
        repository.userViewModelRepository.setUserInfo({
            email: USER_EMAIL,
            id: USER_ID,
            isAuthenticated: true,
            privacyPolicyAccepted: true,
            crossBorderDataTransferPolicyAccepted: true,
            tokenBalance: 0,
        });
        const program = {
            segments: [segment('latex', 'a\nb\nc'), segment('latex', 'd\ne')],
            parameters: { roundStrategy: 'noRound' as const },
        };
        repository.projectViewModelRepository.setProject({
            projectId: PROJECT_ID,
            userId: USER_ID,
            title: PROJECT_TITLE,
            lastModified: '2026-11-27T12:00:00Z',
            isPublic: false,
            projectType: 'latex',
            program,
        });
        repository.projectViewModelRepository.setCurrentProgram(program);
        repository.projectViewModelRepository.setProjectType('latex');
        repository.projectViewModelRepository.setReadOnly(false);
        repository.projectViewModelRepository.setPdfUri(
            'https://files.test/1.pdf'
        );
        repository.ideViewModelRepository.setHunks([
            hunk({
                id: 'a',
                type: 'addLinesToSegment',
                segmentId: 1,
                startLine: 2,
                endLine: 3,
            }),
            hunk({
                id: 'b',
                type: 'replaceTextInSegment',
                segmentId: 2,
                startLine: 1,
                endLine: 1,
            }),
        ]);
        rpi.navigationDocToPdfRequest = navigation(
            positions
        ) as unknown as Rpi['navigationDocToPdfRequest'];
        return ctx;
    }

    const POSITIONS = {
        '1:2': { page: 1, x: 70, y: 100 },
        '1:3': { page: 1, x: 70, y: 115 },
        '2:1': { page: 1, x: 70, y: 400 },
    };

    const markedHunks = (ctx: ReturnType<typeof setup>) =>
        ctx.repository.ideViewModelRepository
            .agentPdfMarks()
            ?.marks.map((item) => item.hunkId);

    test('после поиска отметки привязаны к своему PDF, а в аналитику уходит итог', async () => {
        const ctx = setup(POSITIONS);
        const onEvent = jest.spyOn(ctx.observerService, 'onEvent');

        await ctx.agentPdfMarksService.refresh();

        expect(
            ctx.repository.ideViewModelRepository.agentPdfMarks()?.pdfUri
        ).toBe('https://files.test/1.pdf');
        expect(markedHunks(ctx)).toEqual(['a', 'b']);
        expect(
            ctx.repository.ideViewModelRepository.agentPdfMarksLoading()
        ).toBe(false);
        expect(onEvent).toHaveBeenCalledWith(
            Events.EVENT_AGENT_PDF_MARKS,
            expect.objectContaining({
                outcome: 'located',
                hunk_count: 2,
                marked: 2,
            })
        );
    });

    test('принятая правка пропадает без новых запросов, новый PDF ищется заново', async () => {
        const ctx = setup(POSITIONS);
        await ctx.agentPdfMarksService.refresh();
        const requests = (ctx.rpi.navigationDocToPdfRequest as jest.Mock).mock
            .calls.length;

        ctx.repository.ideViewModelRepository.setHunks(
            ctx.repository.ideViewModelRepository
                .hunks()
                .filter((item) => item.id !== 'a')
        );
        await ctx.agentPdfMarksService.refresh();

        expect(markedHunks(ctx)).toEqual(['b']);
        expect(
            (ctx.rpi.navigationDocToPdfRequest as jest.Mock).mock.calls.length
        ).toBe(requests);

        ctx.repository.projectViewModelRepository.setPdfUri(
            'https://files.test/2.pdf'
        );
        await ctx.agentPdfMarksService.refresh();

        expect(
            (ctx.rpi.navigationDocToPdfRequest as jest.Mock).mock.calls.length
        ).toBeGreaterThan(requests);
        expect(
            ctx.repository.ideViewModelRepository.agentPdfMarks()?.pdfUri
        ).toBe('https://files.test/2.pdf');
    });

    test('во время прогона агента места не ищутся', async () => {
        const ctx = setup(POSITIONS);
        ctx.repository.chatViewModelRepository.setRequestState('running');

        await ctx.agentPdfMarksService.refresh();

        expect(ctx.rpi.navigationDocToPdfRequest).not.toHaveBeenCalled();
        expect(markedHunks(ctx)).toEqual([]);
    });

    test('гостю и в проекте Markdown отметок нет', async () => {
        const ctx = setup(POSITIONS);
        ctx.repository.projectViewModelRepository.setProjectType('markdown');

        await ctx.agentPdfMarksService.refresh();

        expect(ctx.rpi.navigationDocToPdfRequest).not.toHaveBeenCalled();
        expect(
            ctx.repository.ideViewModelRepository.agentPdfMarks()
        ).toBeNull();
    });
});
