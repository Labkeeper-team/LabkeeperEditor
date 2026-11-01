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

    expect(ctx.rpi.getDefaultProjectRequest).toHaveBeenCalledWith(
        expect.any(String),
        exampleProgram,
        'latex'
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
