import { Project } from '../../../model/domain.ts';
import { RequestResult } from '../../../model/rpi';
import {
    mockContext,
    mockListHunksRequestWithHunks,
    USER_EMAIL,
    USER_ID,
} from '../common.ts';

test('run-button-saves-active-text-file-before-latex-project-compilation', async () => {
    const { programService, projectPageService, repository, rpi } =
        mockContext();
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
});
