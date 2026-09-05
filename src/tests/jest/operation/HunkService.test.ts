import { Hunk, Project } from '../../../model/domain.ts';
import {
    mockContext,
    mockDeleteHunkRequest,
    mockGetProjectRequestWithDefaultProject,
    mockListFilesRequestWithDefaultFile,
    mockListHunksRequestWithHunks,
    mockSaveProgramRequest,
    PROJECT_ID,
    USER_EMAIL,
    USER_ID,
} from '../common.ts';

const sampleHunk: Hunk = {
    id: 'h1',
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 1,
    endLine: 1,
    text: 'AI generated line',
};

function setOwnAuthenticatedProject(
    repository: ReturnType<typeof mockContext>['repository']
) {
    const project: Project = {
        projectId: PROJECT_ID,
        userId: USER_ID,
        title: 'Test project',
        lastModified: new Date().toISOString(),
        isPublic: false,
        program: {
            segments: [
                {
                    id: 1,
                    type: 'md',
                    text: 'hello',
                    parameters: { visible: true },
                },
            ],
            parameters: { roundStrategy: 'noRound' },
        },
        projectType: 'markdown',
    };
    repository.userViewModelRepository.setUserInfo({
        email: USER_EMAIL,
        id: USER_ID,
        isAuthenticated: true,
        privacyPolicyAccepted: true,
        tokenBalance: 0,
    });
    repository.projectViewModelRepository.setProject(project);
    repository.projectViewModelRepository.setReadOnly(false);
}

test('loadHunks loads hunks for own authenticated project', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    mockListHunksRequestWithHunks(rpi, [sampleHunk]);

    await hunkService.loadHunks();

    expect(rpi.listHunksRequest).toHaveBeenCalledWith(PROJECT_ID);
    expect(repository.ideViewModelRepository.hunks()).toEqual([sampleHunk]);
});

test('loadHunks clears hunks for readonly project without API call', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.projectViewModelRepository.setReadOnly(true);
    repository.ideViewModelRepository.setHunks([sampleHunk]);
    mockListHunksRequestWithHunks(rpi, [sampleHunk]);

    await hunkService.loadHunks();

    expect(rpi.listHunksRequest).not.toHaveBeenCalled();
    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
});

test('incognito accept removes hunks locally without DELETE', async () => {
    const { hunkService, rpi, repository } = mockContext();
    repository.userViewModelRepository.setUserInfo({
        email: '',
        id: 0,
        isAuthenticated: false,
        privacyPolicyAccepted: false,
        tokenBalance: 0,
    });
    repository.ideViewModelRepository.setHunks([sampleHunk]);
    mockDeleteHunkRequest(rpi);

    await hunkService.acceptGroup(['h1']);

    expect(rpi.deleteHunkRequest).not.toHaveBeenCalled();
    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
});

test('acceptGroup calls DELETE with revert=false', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks([sampleHunk]);
    mockListHunksRequestWithHunks(rpi, []);
    mockDeleteHunkRequest(rpi);

    await hunkService.acceptGroup(['h1']);

    expect(rpi.deleteHunkRequest).toHaveBeenCalledWith(PROJECT_ID, 'h1', false);
    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
});

test('revertGroup calls DELETE sequentially with revert=true', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks([
        sampleHunk,
        { ...sampleHunk, id: 'h2' },
    ]);
    mockGetProjectRequestWithDefaultProject(rpi);
    mockListFilesRequestWithDefaultFile(rpi);
    mockListHunksRequestWithHunks(rpi, []);
    const deleteMock = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {},
    });
    rpi.deleteHunkRequest = deleteMock;

    await hunkService.revertGroup(['h1', 'h2']);

    expect(deleteMock.mock.calls).toEqual([
        [PROJECT_ID, 'h1', true],
        [PROJECT_ID, 'h2', true],
    ]);
});

test('acceptHunksInBackground removes hunks optimistically from UI', () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks([sampleHunk]);
    mockDeleteHunkRequest(rpi);
    mockListHunksRequestWithHunks(rpi, []);

    hunkService.acceptHunksInBackground(['h1']);

    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
});

test('undo clears remaining hunks and persists the pre-prompt program', async () => {
    const { programEditorService, programService, rpi, repository } =
        mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks([sampleHunk]);
    mockDeleteHunkRequest(rpi);
    mockListHunksRequestWithHunks(rpi, []);
    mockSaveProgramRequest(rpi);

    const original = {
        segments: [
            {
                id: 1,
                type: 'md' as const,
                text: 'before prompt',
                parameters: { visible: true },
            },
        ],
        parameters: { roundStrategy: 'noRound' as const },
    };
    const generated = {
        ...original,
        segments: [
            ...original.segments,
            {
                id: 2,
                type: 'md' as const,
                text: 'generated',
                parameters: { visible: true },
            },
        ],
    };
    programService.setNewProgram(original);
    programService.replaceWithNewProgram(generated);

    await programEditorService.onPrevVersionButtonClicked();

    expect(programService.getCurrentProgram()).toEqual(original);
    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
    expect(rpi.deleteHunkRequest).toHaveBeenCalledWith(
        PROJECT_ID,
        sampleHunk.id,
        false
    );
    expect(rpi.saveProgramRequest).toHaveBeenCalledWith(PROJECT_ID, original);
});
