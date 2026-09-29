import { CompileError, Project } from '../../../model/domain.ts';
import { RequestResult } from '../../../model/rpi';
import { Events } from '../../../model/service/ObserverService.ts';
import {
    mockContext,
    mockListHunksRequestWithHunks,
    USER_EMAIL,
    USER_ID,
} from '../common.ts';

test('run-button-saves-active-text-file-before-latex-project-compilation', async () => {
    const {
        programService,
        projectPageService,
        repository,
        rpi,
        observerService,
    } = mockContext();
    const onEvent = jest.spyOn(observerService, 'onEvent');
    const project: Project = {
        projectId: 'latex-project',
        userId: USER_ID,
        title: 'Latex project',
        lastModified: new Date().toISOString(),
        program: {
            segments: [
                {
                    type: 'latex',
                    parameters: {
                        visible: true,
                    },
                    text: '\\input{main.tex}',
                },
            ],
            parameters: {
                roundStrategy: 'noRound',
            },
        },
        isPublic: false,
        projectType: 'latex',
    };

    repository.userViewModelRepository.setUserInfo({
        email: USER_EMAIL,
        id: USER_ID,
        isAuthenticated: true,
        privacyPolicyAccepted: true,
        crossBorderDataTransferPolicyAccepted: true,
        tokenBalance: 0,
    });
    repository.projectViewModelRepository.setProject(project);
    repository.projectViewModelRepository.setProjectType('latex');
    repository.ideViewModelRepository.setActiveTextFile('main.tex');
    repository.ideViewModelRepository.setTextFileContent('edited tex');
    programService.setNewProgram(project.program);

    rpi.uploadFileRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {},
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult);
    rpi.saveProgramRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {},
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult);
    rpi.compileProjectPdfRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            pdfUri: 'https://files.labkeeper.io/project/latex-project/main.pdf',
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            email: USER_EMAIL,
            id: USER_ID,
            isAuthenticated: true,
            privacyPolicyAccepted: true,
            crossBorderDataTransferPolicyAccepted: true,
            tokenBalance: 0,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    rpi.listFilesRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            files: [],
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    mockListHunksRequestWithHunks(rpi);

    await projectPageService.onRunButtonClicked();

    expect(rpi.uploadFileRequest).toHaveBeenCalledWith(
        expect.any(FormData),
        project.projectId,
        'main.tex'
    );
    expect(rpi.compileProjectPdfRequest).toHaveBeenCalledWith(
        project.projectId
    );
    expect(
        (rpi.uploadFileRequest as jest.Mock).mock.invocationCallOrder[0]
    ).toBeLessThan(
        (rpi.compileProjectPdfRequest as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_RUN,
        expect.objectContaining({
            trigger: 'button',
            segment_count: 1,
        })
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_COMPILE_SUCCEEDED,
        expect.objectContaining({
            mode: 'latex',
            http_code: 200,
            error_count: 0,
        })
    );
});

test('compile-failure-tracks-error-count-for-code-203', async () => {
    const {
        observerService,
        programService,
        projectPageService,
        repository,
        rpi,
    } = mockContext();
    const onEvent = jest.spyOn(observerService, 'onEvent');
    repository.projectViewModelRepository.setProjectType('markdown');
    programService.setNewProgram({
        segments: [
            {
                type: 'computational',
                text: 'x = 1',
                parameters: { visible: true },
            },
        ],
        parameters: { roundStrategy: 'noRound' },
    });
    rpi.compilationRequest = jest.fn().mockResolvedValue({
        code: 203,
        body: {
            errors: [
                {
                    code: CompileError.NO_SUCH_VARIABLE,
                    payload: { line: 1, position: 0, segmentId: 1 },
                },
                {
                    code: CompileError.ARITHMETIC_ERROR,
                    payload: { line: 2, position: 0, segmentId: 1 },
                },
            ],
        },
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });

    await projectPageService.onRunButtonClicked();

    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_COMPILE_FAILED,
        expect.objectContaining({
            mode: 'markdown',
            http_code: 203,
            error_count: 2,
        })
    );
});

test('compile-308-opens-auth-modal-once-for-several-errors', async () => {
    const { observerService, projectPageService, repository, rpi } =
        mockContext();
    const onEvent = jest.spyOn(observerService, 'onEvent');
    repository.projectViewModelRepository.setProjectType('markdown');
    rpi.compilationRequest = jest.fn().mockResolvedValue({
        code: 203,
        body: {
            errors: [
                {
                    code: CompileError.FILE_USAGE_NOT_ALLOWED,
                    payload: { line: 1, position: 0, segmentId: 1 },
                },
                {
                    code: CompileError.FILE_USAGE_NOT_ALLOWED,
                    payload: { line: 2, position: 0, segmentId: 1 },
                },
            ],
        },
        isOk: false,
        isUnauth: false,
        isForbidden: false,
    });

    await projectPageService.onRunButtonClicked();

    expect(
        onEvent.mock.calls.filter(
            ([event]) => event === Events.EVENT_AUTH_MODAL_OPENED
        )
    ).toHaveLength(1);
    expect(repository.authViewModelRepository.currentView()).toBe('login');
});

// Кнопка Run и агент раскладывают результат сборки одним разбором, а показать его сразу просит только кнопка: агенту посреди прогона вкладку не переключают

const compiled = (code: number, body: unknown) =>
    jest.fn().mockResolvedValue({
        code,
        body,
        isOk: code === 200,
        isUnauth: false,
        isForbidden: false,
    });

const LATEX_ERROR = {
    code: CompileError.LATEX_ERROR,
    payload: { line: 1, position: 0, segmentId: 1 },
};

function runButtonSetup(mode: 'latex' | 'markdown') {
    const ctx = mockContext();
    ctx.repository.projectViewModelRepository.setProjectType(mode);
    ctx.programService.setNewProgram({
        segments: [
            {
                type: mode === 'latex' ? 'latex' : 'computational',
                text: 'a = 10',
                parameters: { visible: true },
            },
        ],
        parameters: { roundStrategy: 'noRound' },
    });
    // прошлая сборка оставила ошибку и pdf
    ctx.repository.projectViewModelRepository.setCompileErrorResult({
        errors: [LATEX_ERROR],
    });
    ctx.repository.projectViewModelRepository.setPdfUri('/files/old.pdf');
    return ctx;
}

const shown = (ctx: ReturnType<typeof runButtonSetup>) => ({
    pdfUri: ctx.repository.projectViewModelRepository.pdfUri(),
    errors: ctx.repository.projectViewModelRepository.compileErrorResult(),
    expanded: ctx.repository.settingsViewModelRepository.expandProblemViewer(),
    pdfUpdated: ctx.repository.ideViewModelRepository.pdfUpdated(),
});

test('run-button-shows-the-new-pdf', async () => {
    const ctx = runButtonSetup('latex');
    ctx.rpi.pdfCompilationRequest = compiled(200, { pdfUri: '/files/new.pdf' });

    await ctx.projectPageService.onRunButtonClicked();

    expect(shown(ctx)).toEqual({
        pdfUri: '/files/new.pdf',
        errors: { errors: [] },
        expanded: false,
        pdfUpdated: 1,
    });
});

test('run-button-shows-the-markdown-result', async () => {
    const ctx = runButtonSetup('markdown');
    const result = {
        segments: [
            {
                type: 'computational',
                statements: [{ type: 'table', items: [['a', '10']] }],
            },
        ],
    };
    ctx.rpi.compilationRequest = compiled(200, result);

    await ctx.projectPageService.onRunButtonClicked();

    expect(
        ctx.repository.projectViewModelRepository.compileSuccessResult()
    ).toEqual(result);
    expect(shown(ctx)).toEqual({
        pdfUri: '/files/old.pdf',
        errors: { errors: [] },
        expanded: false,
        pdfUpdated: 1,
    });
});

test('run-button-shows-the-errors-and-the-unfinished-pdf', async () => {
    const ctx = runButtonSetup('latex');
    const errors = {
        errors: [LATEX_ERROR],
        unfinishedPdfUri: '/files/half.pdf',
    };
    ctx.rpi.pdfCompilationRequest = compiled(203, errors);

    await ctx.projectPageService.onRunButtonClicked();

    expect(shown(ctx)).toEqual({
        pdfUri: '/files/half.pdf',
        errors,
        expanded: true,
        pdfUpdated: 1,
    });
});

test('run-button-errors-without-a-pdf-stay-in-the-editor', async () => {
    const ctx = runButtonSetup('markdown');
    const errors = { errors: [LATEX_ERROR] };
    ctx.rpi.compilationRequest = compiled(203, errors);

    await ctx.projectPageService.onRunButtonClicked();

    // показывать нечего: панель ошибок раскрыта в редакторе
    expect(shown(ctx)).toEqual({
        pdfUri: '/files/old.pdf',
        errors,
        expanded: true,
        pdfUpdated: 0,
    });
});

test('help-merge-into-same-type-segment-does-not-track-create', () => {
    const { observerService, programService, projectPageService, repository } =
        mockContext();
    const onEvent = jest.spyOn(observerService, 'onEvent');
    programService.setNewProgram({
        segments: [
            {
                type: 'md',
                text: 'already here',
                parameters: { visible: true },
            },
        ],
        parameters: { roundStrategy: 'noRound' },
    });
    repository.ideViewModelRepository.setPreviousActiveSegmentIndex(0);

    projectPageService.onHelpItemCreated({
        segmentType: 'md',
        text: { ru: 'подсказка', en: 'hint' },
    } as Parameters<typeof projectPageService.onHelpItemCreated>[0]);

    expect(onEvent).not.toHaveBeenCalledWith(
        Events.EVENT_CREATE_MD_SEGMENT,
        expect.anything()
    );
    expect(programService.getCurrentProgram().segments).toHaveLength(1);
});
