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
import { en } from '../../../viewModel/dictionaries/en.ts';
import { MockViewModelRepository } from '../../../viewModel/repository';

const sampleHunk: Hunk = {
    id: 'h1',
    type: 'addLinesToSegment',
    segmentId: 1,
    startLine: 1,
    endLine: 1,
    text: 'AI generated line',
};

const threeHunks: Hunk[] = [
    sampleHunk,
    { ...sampleHunk, id: 'h2', segmentId: 2 },
    { ...sampleHunk, id: 'h3', segmentId: 3 },
];

const deleteResult = (code: number) => ({
    code,
    body: {},
    isOk: code < 300,
    isUnauth: code === 401,
    isForbidden: code === 403,
});

const hunkListResult = (hunks: Hunk[]) => ({
    code: 200,
    body: { hunks },
    isOk: true,
    isUnauth: false,
    isForbidden: false,
});

// фоновый приём никто не ждёт, поэтому даём ему несколько кругов на завершение
const settle = async () => {
    for (let i = 0; i < 5; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
    }
};

const toasts = (repository: ReturnType<typeof mockContext>['repository']) =>
    (repository as MockViewModelRepository).mockState().toasts;

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
        crossBorderDataTransferPolicyAccepted: true,
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

test('loadHunks drops the answer for a project that was left', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    let answer: (value: unknown) => void = () => {};
    rpi.listHunksRequest = jest
        .fn()
        .mockReturnValue(new Promise((resolve) => (answer = resolve)));

    const loading = hunkService.loadHunks();
    // пока hunks ехали, человек открыл другой проект
    const project = repository.projectViewModelRepository.project()!;
    repository.projectViewModelRepository.setProject({
        ...project,
        projectId: 'another',
    });
    answer({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: { hunks: [sampleHunk] },
    });
    await loading;

    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
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
        crossBorderDataTransferPolicyAccepted: true,
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

test('acceptGroup deletes hunks one by one', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks(threeHunks);
    mockListHunksRequestWithHunks(rpi, []);
    const order: string[] = [];
    let inFlight = 0;
    let maxInFlight = 0;
    rpi.deleteHunkRequest = jest.fn(
        async (_projectId: string, hunkId: string) => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            order.push(`start ${hunkId}`);
            await new Promise((resolve) => setTimeout(resolve, 0));
            order.push(`end ${hunkId}`);
            inFlight -= 1;
            return deleteResult(200);
        }
    );

    await hunkService.acceptGroup(['h1', 'h2', 'h3']);

    expect(maxInFlight).toBe(1);
    expect(order).toEqual([
        'start h1',
        'end h1',
        'start h2',
        'end h2',
        'start h3',
        'end h3',
    ]);
});

test('acceptAll clears the list on a server that rewrites it whole', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks(threeHunks);
    let serverHunks = [...threeHunks];
    // худший случай: мок переписывает список целиком, и одновременные удаления затирают друг друга
    rpi.deleteHunkRequest = jest.fn(
        async (_projectId: string, hunkId: string) => {
            const snapshot = serverHunks;
            await new Promise((resolve) => setTimeout(resolve, 0));
            serverHunks = snapshot.filter((h) => h.id !== hunkId);
            return deleteResult(200);
        }
    );
    rpi.listHunksRequest = jest.fn(async () => hunkListResult(serverHunks));

    await hunkService.acceptAll();

    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
});

test('failed DELETE keeps the hunk and is reported', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks(threeHunks);
    rpi.deleteHunkRequest = jest.fn(
        async (_projectId: string, hunkId: string) =>
            deleteResult(hunkId === 'h2' ? 500 : 200)
    );
    // сервер оставил у себя то, что удалить не вышло
    rpi.listHunksRequest = jest.fn(async () => hunkListResult([threeHunks[1]]));

    await hunkService.acceptAll();

    expect(repository.ideViewModelRepository.hunks()).toEqual([threeHunks[1]]);
    expect(toasts(repository)).toEqual([
        { message: en.hunks.errors.accept_failed, type: 'error' },
    ]);
});

test('DELETE with 404 counts as an accepted hunk', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks(threeHunks);
    mockListHunksRequestWithHunks(rpi, []);
    rpi.deleteHunkRequest = jest.fn(
        async (_projectId: string, hunkId: string) =>
            deleteResult(hunkId === 'h2' ? 404 : 200)
    );

    await hunkService.acceptAll();

    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
    expect(toasts(repository)).toEqual([]);
});

test('acceptHunksInBackground does not lose the second batch', async () => {
    const { hunkService, rpi, repository } = mockContext();
    setOwnAuthenticatedProject(repository);
    repository.ideViewModelRepository.setHunks([threeHunks[0], threeHunks[1]]);
    mockListHunksRequestWithHunks(rpi, []);
    const deleted: string[] = [];
    let releaseFirst: () => void = () => {};
    rpi.deleteHunkRequest = jest.fn(
        async (_projectId: string, hunkId: string) => {
            deleted.push(hunkId);
            if (hunkId === 'h1') {
                await new Promise<void>((resolve) => (releaseFirst = resolve));
            }
            return deleteResult(200);
        }
    );

    hunkService.acceptHunksInBackground(['h1']);
    // вторая пачка приходит, пока первая ещё в отправке
    hunkService.acceptHunksInBackground(['h2']);
    releaseFirst();
    await settle();

    expect(deleted).toEqual(['h1', 'h2']);
    expect(repository.ideViewModelRepository.hunks()).toEqual([]);
});
