import { Project } from '../../../model/domain.ts';
import { RequestResult } from '../../../model/rpi';
import { mockContext, USER_EMAIL, USER_ID } from '../common.ts';

test('project-create-replaces-stale-editor-program-with-created-project-program', async () => {
    const { programService, projectsPageService, repository, rpi } =
        mockContext();
    const staleProgram = {
        segments: [
            {
                type: 'latex' as const,
                parameters: {},
                text: 'Pre-auth latex draft',
            },
        ],
        parameters: {
            roundStrategy: 'noRound' as const,
        },
    };
    const emptyLatexProject: Project = {
        projectId: 'new-latex-project',
        userId: USER_ID,
        title: 'New Latex Project',
        lastModified: new Date().toISOString(),
        program: {
            segments: [],
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
    programService.setNewProgram(staleProgram);
    repository.projectViewModelRepository.setCurrentProgram(staleProgram);
    rpi.createProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: emptyLatexProject,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult<Project>);
    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            projects: [emptyLatexProject],
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    rpi.setProjectTypeRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {},
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    } as RequestResult);

    await projectsPageService.onProjectCreate(
        'New Latex Project',
        'latex',
        () => {},
        () => {}
    );

    expect(
        repository.projectViewModelRepository.currentProgram().segments
    ).toStrictEqual([]);
    expect(repository.projectViewModelRepository.project()?.projectId).toBe(
        emptyLatexProject.projectId
    );
});
