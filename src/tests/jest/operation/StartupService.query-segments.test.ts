import {
    mockContext,
    mockAuthenticatedStartup,
    mockUserInfoForUnauthorized,
    PROJECT_ID,
    USER_ID,
} from '../common.ts';
import { Program, Segment, SegmentType } from '../../../model/domain.ts';
import { StartupQuery } from '../../../viewModel/operation/StartupService.ts';
import { Routes } from '../../../viewModel/routes.ts';

const querySegments: {
    key: keyof StartupQuery;
    type: SegmentType;
    comment: string;
}[] = [
    {
        key: 'compute',
        type: 'computational',
        comment: '// Labkeeper: query compute',
    },
    { key: 'latex', type: 'latex', comment: '% Labkeeper: query latex' },
    {
        key: 'markdown',
        type: 'md',
        comment: '<!-- Labkeeper: query markdown -->',
    },
];

function segment(type: SegmentType, text: string): Segment {
    return { type, text, parameters: { visible: true } };
}

function queryContext(segments: Segment[] = [], authenticated = false) {
    const ctx = mockContext();
    if (authenticated) mockAuthenticatedStartup(ctx.rpi);
    else mockUserInfoForUnauthorized(ctx.rpi);
    ctx.repository.setLocation(Routes.ProjectDefault);
    const draft: Program = {
        segments,
        parameters: { roundStrategy: 'noRound' },
    };
    ctx.repository.persistenceViewModelRepository.setLastProgram(draft);
    ctx.rpi.pdfCompilationRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { pdfUri: 'https://files.example/query.pdf' },
    });
    ctx.rpi.getDefaultProjectRequest = jest
        .fn()
        .mockImplementation((_language: string, program: Program) =>
            Promise.resolve({
                code: 200,
                isOk: true,
                body: {
                    projectId: PROJECT_ID,
                    userId: USER_ID,
                    title: 'Saved project',
                    projectType: 'latex',
                    isPublic: false,
                    lastModified: '2026-10-08T00:00:00Z',
                    program,
                },
            })
        );
    ctx.rpi.saveProgramRequest = jest
        .fn()
        .mockResolvedValue({ code: 200, isOk: true });
    ctx.rpi.compileProjectPdfRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { pdfUri: 'https://files.example/project.pdf' },
    });
    return ctx;
}

test.each(querySegments)(
    'guest replaces a $key query segment and keeps unmarked work',
    async ({ key, type, comment }) => {
        const original = segment(type, 'personal draft');
        const ctx = queryContext([original]);
        for (const text of ['first', 'second', 'second']) {
            await ctx.startupService.onAppStartup(undefined, 'latex', {
                [key]: text,
            });
            const program = ctx.programService.getCurrentProgram();
            expect(program.segments).toEqual([
                original,
                segment(type, comment + '\n' + text),
            ]);
            expect(program.parameters).toEqual({ roundStrategy: 'noRound' });
            expect(
                ctx.repository.persistenceViewModelRepository.lastProgram()
            ).toEqual(program);
            expect(
                ctx.repository.ideViewModelRepository.activeSegmentIndex()
            ).toBe(1);
        }
        expect(ctx.rpi.pdfCompilationRequest).toHaveBeenCalledTimes(3);
        expect(ctx.rpi.getDefaultProjectRequest).not.toHaveBeenCalled();
    }
);

test.each(querySegments)(
    'guest removes all old $key markers, including CRLF and an empty body',
    async ({ key, type, comment }) => {
        const ctx = queryContext([
            segment(type, comment + '\nfirst'),
            segment(type, comment + '\r\nedited example'),
            segment(type, comment),
        ]);
        await ctx.startupService.onAppStartup(undefined, 'latex', {
            [key]: 'new example',
        });
        expect(ctx.programService.getCurrentProgram().segments).toEqual([
            segment(type, comment + '\nnew example'),
        ]);
    }
);

test('only an exact first-line comment on a matching segment type is replaced', async () => {
    const kept = [
        segment('latex', 'text\n% Labkeeper: query latex'),
        segment('latex', '% Labkeeper: query latex - my notes'),
        segment('md', '% Labkeeper: query latex\nquoted LaTeX'),
        segment('latex', ' % Labkeeper: query latex\nmanually kept'),
    ];
    const ctx = queryContext([
        ...kept,
        segment('latex', '% Labkeeper: query latex\nold example'),
        segment('md', '<!-- Labkeeper: query markdown -->\nold markdown'),
        segment('computational', '// Labkeeper: query compute\na = 1'),
    ]);
    const draft = ctx.repository.persistenceViewModelRepository.lastProgram();
    const before = structuredClone(draft);
    await ctx.startupService.onAppStartup(undefined, 'latex', {
        latex: 'new example',
    });
    expect(ctx.programService.getCurrentProgram().segments).toEqual([
        ...kept,
        segment('latex', '% Labkeeper: query latex\nnew example'),
    ]);
    expect(draft).toEqual(before);
});

test.each(querySegments)(
    'a $key link replaces the whole guest example, including absent query types',
    async ({ key, type, comment }) => {
        const draft = segment('md', 'personal draft');
        const ctx = queryContext([
            ...querySegments.map(({ type, comment }) =>
                segment(type, comment + '\nold example')
            ),
            draft,
        ]);
        await ctx.startupService.onAppStartup(undefined, 'latex', {
            compute: '',
            latex: '',
            markdown: '',
            [key]: 'new example',
        });
        expect(ctx.programService.getCurrentProgram().segments).toEqual([
            draft,
            segment(type, comment + '\nnew example'),
        ]);
    }
);

test('replacing all three query types keeps their order and unrelated segments', async () => {
    const draft = segment('md', 'personal draft');
    const ctx = queryContext([
        segment('md', '<!-- Labkeeper: query markdown -->\nold'),
        draft,
        segment('latex', '% Labkeeper: query latex\nold'),
        segment('computational', '// Labkeeper: query compute\nold'),
    ]);
    await ctx.startupService.onAppStartup(undefined, 'latex', {
        markdown: '# Result',
        latex: '\\[x=2\\]',
        compute: 'x = 2',
    });
    expect(ctx.programService.getCurrentProgram().segments).toEqual([
        draft,
        segment('computational', '// Labkeeper: query compute\nx = 2'),
        segment('latex', '% Labkeeper: query latex\n\\[x=2\\]'),
        segment('md', '<!-- Labkeeper: query markdown -->\n# Result'),
    ]);
});

test.each([{}, { compute: '', latex: '', markdown: '' }])(
    'missing or empty parameters keep marked segments and do not compile: %j',
    async (query) => {
        const segments = querySegments.map(({ type, comment }) =>
            segment(type, comment + '\nold example')
        );
        const ctx = queryContext(segments);
        await ctx.startupService.onAppStartup(undefined, 'latex', query);
        expect(ctx.programService.getCurrentProgram().segments).toEqual(
            segments
        );
        expect(ctx.rpi.pdfCompilationRequest).not.toHaveBeenCalled();
    }
);

test('removing the marker keeps an edited example on the next visit', async () => {
    const ctx = queryContext();
    await ctx.startupService.onAppStartup(undefined, 'latex', {
        latex: 'first example',
    });
    ctx.programService.getCurrentProgram().segments[0].text = 'my own text';
    ctx.startupService.ideService.onProgramUpdated();
    await ctx.startupService.onAppStartup(undefined, 'latex', {
        latex: 'second example',
    });
    expect(ctx.programService.getCurrentProgram().segments).toEqual([
        segment('latex', 'my own text'),
        segment('latex', '% Labkeeper: query latex\nsecond example'),
    ]);
});

test.each(querySegments)(
    'signed-in $key links neither remove marked segments nor add comments',
    async ({ key, type }) => {
        const old = querySegments.map(({ type, comment }) =>
            segment(type, comment + '\nold example')
        );
        const ctx = queryContext(old, true);
        await ctx.startupService.onAppStartup(undefined, 'latex', {
            [key]: 'new example',
        });
        expect(ctx.rpi.getDefaultProjectRequest).toHaveBeenCalledWith(
            expect.any(String),
            {
                segments: [...old, segment(type, 'new example')],
                parameters: { roundStrategy: 'noRound' },
            },
            expect.any(String)
        );
        expect(ctx.rpi.compileProjectPdfRequest).toHaveBeenCalledWith(
            PROJECT_ID
        );
    }
);
