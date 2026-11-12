import {
    mockContext,
    mockAuthenticatedStartup,
    mockUserInfoForUnauthorized,
    PROJECT_ID,
    USER_ID,
} from '../common.ts';
import { Program, Segment } from '../../../model/domain.ts';
import { Routes } from '../../../viewModel/routes.ts';

function segment(
    type: Segment['type'],
    text: string,
    parameters: Segment['parameters'] = { visible: true }
): Segment {
    return { type, text, parameters };
}

const exampleProgram: Program = {
    parameters: { roundStrategy: 'threeDigits' },
    segments: [
        segment('computational', 'a = 1', {
            visible: true,
            hideValue: true,
        }),
        segment('latex', 'first', { visible: true }),
        segment('latex', 'second', {
            visible: false,
            hideAssignment: true,
        }),
        segment('md', 'текст', { visible: true }),
    ],
};

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
    ctx.rpi.compilationRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { segments: [] },
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
    ctx.rpi.getBlogExampleProgramRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: exampleProgram,
    });
    return ctx;
}

test('a slug example replaces the guest draft with the whole api program', async () => {
    const ctx = queryContext([segment('md', 'personal draft')]);

    await ctx.startupService.onAppStartup(undefined, undefined, {
        example: 'many-segments',
    });

    expect(ctx.rpi.getBlogExampleProgramRequest).toHaveBeenCalledWith(
        'many-segments'
    );
    expect(ctx.programService.getCurrentProgram()).toEqual(exampleProgram);
    expect(ctx.repository.persistenceViewModelRepository.lastProgram()).toEqual(
        exampleProgram
    );
    expect(ctx.repository.projectViewModelRepository.mode()).toBe('latex');
    expect(ctx.repository.ideViewModelRepository.activeSegmentIndex()).toBe(
        exampleProgram.segments.length - 1
    );
    expect(ctx.rpi.getDefaultProjectRequest).not.toHaveBeenCalled();
});

test('a slug example replaces the signed-in draft with the whole api program', async () => {
    const ctx = queryContext([segment('md', 'personal draft')], true);

    await ctx.startupService.onAppStartup(undefined, undefined, {
        example: 'many-segments',
    });

    // GH-256: пример не программа гостя, его правок агента в запросе нет
    expect(ctx.rpi.getDefaultProjectRequest).toHaveBeenCalledWith(
        expect.any(String),
        exampleProgram,
        'latex',
        undefined
    );
    expect(ctx.programService.getCurrentProgram()).toEqual(exampleProgram);
});

test('a markdown-only example opens markdown mode', async () => {
    const ctx = queryContext();
    const markdownProgram: Program = {
        parameters: { roundStrategy: 'noRound' },
        segments: [segment('md', '# Title')],
    };
    ctx.rpi.getBlogExampleProgramRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: markdownProgram,
    });

    await ctx.startupService.onAppStartup(undefined, undefined, {
        example: 'markdown-note',
    });

    expect(ctx.programService.getCurrentProgram()).toEqual(markdownProgram);
    expect(ctx.repository.projectViewModelRepository.mode()).toBe('markdown');
});

test('an unknown slug leaves the current draft', async () => {
    const draft = segment('md', 'personal draft');
    const ctx = queryContext([draft]);
    ctx.rpi.getBlogExampleProgramRequest = jest.fn().mockResolvedValue({
        code: 404,
        isOk: false,
        body: undefined,
    });

    await ctx.startupService.onAppStartup(undefined, undefined, {
        example: 'missing',
    });

    expect(ctx.programService.getCurrentProgram().segments).toEqual([draft]);
    expect(ctx.programService.getCurrentProgram().parameters).toEqual({
        roundStrategy: 'noRound',
    });
});

// GH-219: пример с сайта собирается сам, в аналитике это не нажатие «Выполнить»
test('an example builds itself as an auto run, not as a run click', async () => {
    const ctx = queryContext();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');

    await ctx.startupService.onAppStartup(undefined, undefined, {
        example: 'many-segments',
    });

    expect(ctx.rpi.pdfCompilationRequest).toHaveBeenCalledTimes(1);
    const names = onEvent.mock.calls.map(([name]) => name);
    expect(names).toContain('auto_run');
    expect(names).not.toContain('start_run');
    expect(onEvent).toHaveBeenCalledWith(
        'auto_run',
        expect.objectContaining({
            reason: 'example',
            segment_count: exampleProgram.segments.length,
        })
    );
});

test('the run button and the hotkey still send start_run', async () => {
    const ctx = queryContext();
    await ctx.startupService.onAppStartup();
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');

    await ctx.projectPageService.onRunButtonClicked('button');
    await ctx.projectPageService.onRunButtonClicked('hotkey');

    const runs = onEvent.mock.calls.filter(
        ([name]) => name === 'start_run' || name === 'auto_run'
    );
    expect(runs).toEqual([
        ['start_run', expect.objectContaining({ trigger: 'button' })],
        ['start_run', expect.objectContaining({ trigger: 'hotkey' })],
    ]);
});
