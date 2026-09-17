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
