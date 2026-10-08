import {
    mockContext,
    mockUserInfoForUnauthorized,
    mockUserInfoWithDefaultUser,
    PROJECT_ID,
} from '../common.ts';
import { Program } from '../../../model/domain.ts';
import { Routes } from '../../../viewModel/routes.ts';

const draft: Program = {
    segments: [
        { type: 'md', text: 'saved draft', parameters: { visible: true } },
    ],
    parameters: { roundStrategy: 'noRound' },
};

function exampleContext(authenticated = false) {
    const ctx = mockContext();
    if (authenticated) mockUserInfoWithDefaultUser(ctx.rpi);
    else mockUserInfoForUnauthorized(ctx.rpi);
    ctx.repository.setLocation(Routes.ProjectDefault);
    ctx.repository.persistenceViewModelRepository.setLastProgram(draft);
    ctx.rpi.pdfCompilationRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { pdfUri: 'https://files.example/example.pdf' },
    });
    ctx.rpi.compilationRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { segments: [] },
    });
    ctx.rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        body: { projects: [] },
    });
    ctx.rpi.getDefaultProjectRequest = jest.fn();
    ctx.rpi.createProjectRequest = jest.fn();
    ctx.rpi.saveProgramRequest = jest.fn();
    return {
        ...ctx,
        ideService: ctx.startupService.ideService,
        loaderService: ctx.startupService.loader,
    };
}

test.each([false, true])(
    'example is isolated and compiled without saving, authenticated=%s',
    async (authenticated) => {
        const ctx = exampleContext(authenticated);
        await ctx.startupService.onAppStartup(undefined, 'latex', {
            example: true,
            latex: 'first example',
        });

        expect(ctx.programService.getCurrentProgram().segments).toEqual([
            {
                type: 'latex',
                text: 'first example',
                parameters: { visible: true },
            },
        ]);
        expect(ctx.repository.projectViewModelRepository.isExample()).toBe(
            true
        );
        expect(
            ctx.repository.projectViewModelRepository.project()
        ).toBeUndefined();
        expect(ctx.rpi.pdfCompilationRequest).toHaveBeenCalledWith(
            ctx.programService.getCurrentProgram()
        );
        await ctx.loaderService.segmentEditorSaveProgram();
        ctx.ideService.onProgramUpdated();
        expect(
            ctx.repository.persistenceViewModelRepository.lastProgram()
        ).toEqual(draft);
        expect(ctx.rpi.getDefaultProjectRequest).not.toHaveBeenCalled();
        expect(ctx.rpi.createProjectRequest).not.toHaveBeenCalled();
        expect(ctx.rpi.saveProgramRequest).not.toHaveBeenCalled();
    }
);

test('editing and opening another example keeps the original draft', async () => {
    const ctx = exampleContext();
    await ctx.startupService.onAppStartup(undefined, 'latex', {
        example: true,
        latex: 'first example',
    });
    ctx.programService.getCurrentProgram().segments[0].text = 'edited example';
    ctx.ideService.onProgramUpdated();
    await ctx.loaderService.segmentEditorSaveProgram();

    ctx.repository.setLocation(Routes.ProjectDefault);
    await ctx.startupService.onAppStartup(undefined, 'markdown', {
        example: true,
        markdown: '# Second example',
    });

    expect(ctx.programService.getCurrentProgram().segments).toHaveLength(1);
    expect(ctx.programService.getCurrentProgram().segments[0].text).toBe(
        '# Second example'
    );
    expect(ctx.repository.projectViewModelRepository.mode()).toBe('markdown');
    expect(ctx.rpi.compilationRequest).toHaveBeenCalledTimes(1);
    expect(ctx.repository.persistenceViewModelRepository.lastProgram()).toEqual(
        draft
    );
});

test('example URL retains all segment parameters but not the captcha', async () => {
    const ctx = exampleContext();
    await ctx.startupService.onAppStartup('test-captcha', undefined, {
        example: true,
        compute: 'a = 1',
        latex: '\\alpha + \\beta & %',
        markdown: '# Example',
    });

    const url = new URL(ctx.repository.location(), 'https://labkeeper.io');
    expect(url.pathname).toBe(Routes.ProjectDefault);
    expect(Object.fromEntries(url.searchParams)).toEqual({
        example: '1',
        open: 'latex',
        compute: 'a = 1',
        latex: '\\alpha + \\beta & %',
        markdown: '# Example',
    });
    expect(
        ctx.programService.getCurrentProgram().segments.map((s) => s.type)
    ).toEqual(['computational', 'latex', 'md']);
});

test('empty example flag does not replace the draft or compile', async () => {
    const ctx = exampleContext();
    await ctx.startupService.onAppStartup(undefined, undefined, {
        example: true,
        latex: '',
    });
    expect(ctx.repository.projectViewModelRepository.isExample()).toBe(false);
    expect(ctx.programService.getCurrentProgram()).toEqual(draft);
    expect(ctx.rpi.pdfCompilationRequest).not.toHaveBeenCalled();
});

test('plain query links retain the existing append behavior', async () => {
    const ctx = exampleContext();
    await ctx.startupService.onAppStartup(undefined, 'latex', {
        latex: 'appended',
    });
    expect(
        ctx.programService.getCurrentProgram().segments.map((s) => s.text)
    ).toEqual(['saved draft', 'appended']);
    expect(ctx.repository.projectViewModelRepository.isExample()).toBe(false);
});

test('logging in keeps the example without sending it or the draft to a project', async () => {
    const ctx = exampleContext();
    await ctx.startupService.onAppStartup(undefined, 'latex', {
        example: true,
        latex: 'example',
    });
    ctx.repository.setLocation(Routes.ProjectDefault);
    mockUserInfoWithDefaultUser(ctx.rpi);
    await ctx.startupService.onAppStartup();
    expect(ctx.programService.getCurrentProgram().segments[0].text).toBe(
        'example'
    );
    expect(ctx.repository.projectViewModelRepository.isExample()).toBe(true);
    expect(ctx.rpi.getDefaultProjectRequest).not.toHaveBeenCalled();
    expect(ctx.repository.persistenceViewModelRepository.lastProgram()).toEqual(
        draft
    );
});

test.each(['marketing', 'back'])(
    'returning to the guest editor via %s restores the draft and normal saving',
    async (via) => {
        const ctx = exampleContext();
        await ctx.startupService.onAppStartup(undefined, 'latex', {
            example: true,
            latex: 'example',
        });
        if (via === 'marketing')
            await ctx.startupService.openEditorAfterSpaNavigation();
        else await ctx.projectPageService.onBackButtonClicked();
        expect(ctx.repository.projectViewModelRepository.isExample()).toBe(
            false
        );
        expect(ctx.programService.getCurrentProgram()).toEqual(draft);

        ctx.programService.getCurrentProgram().segments[0].text =
            'updated draft';
        ctx.ideService.onProgramUpdated();
        await ctx.loaderService.segmentEditorSaveProgram();
        expect(
            ctx.repository.persistenceViewModelRepository.lastProgram()
                .segments[0].text
        ).toBe('updated draft');
    }
);

test('opening an existing project leaves example mode and enables normal saving', async () => {
    const ctx = exampleContext(true);
    await ctx.startupService.onAppStartup(undefined, 'latex', {
        example: true,
        latex: 'example',
    });
    ctx.repository.projectViewModelRepository.setProject({
        projectId: PROJECT_ID,
        userId: 1,
        title: 'Saved project',
        projectType: 'latex',
        isPublic: false,
        lastModified: '2026-10-08T00:00:00Z',
        program: draft,
    });
    ctx.ideService.setNewProgram(draft);
    ctx.rpi.saveProgramRequest = jest
        .fn()
        .mockResolvedValue({ code: 200, isOk: true });
    await ctx.loaderService.segmentEditorSaveProgram();
    expect(ctx.repository.projectViewModelRepository.isExample()).toBe(false);
    expect(ctx.rpi.saveProgramRequest).toHaveBeenCalledWith(PROJECT_ID, draft);
});
