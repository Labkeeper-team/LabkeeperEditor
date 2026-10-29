import {
    CompileError,
    CompileErrorResultList,
    Project,
    ProjectExportFormat,
} from '../../../model/domain.ts';
import { RequestResult } from '../../../model/rpi';
import { Events } from '../../../model/service/ObserverService.ts';
import { exportFileName } from '../../../viewModel/operation/ProjectPageService.ts';
import { MockViewModelRepository } from '../../../viewModel/repository';
import { mockContext, USER_EMAIL, USER_ID } from '../common.ts';

const ARCHIVE_URL = 'https://files.labkeeper.io/tmp/exports/0f7a.zip';

const project: Project = {
    projectId: 'export-project',
    userId: USER_ID,
    title: 'Лабораторная 3: маятник',
    lastModified: '2026-10-29T12:00:00Z',
    program: {
        segments: [
            { type: 'md', parameters: { visible: true }, text: '# Маятник' },
        ],
        parameters: { roundStrategy: 'noRound' },
    },
    isPublic: false,
    projectType: 'markdown',
};

const answer = <T>(code: number, body: T): RequestResult<T> => ({
    code,
    body,
    isOk: code < 300,
    isUnauth: code === 401,
    isForbidden: code === 403,
});

function setup({ authenticated = true } = {}) {
    const ctx = mockContext();
    ctx.repository.userViewModelRepository.setUserInfo({
        email: USER_EMAIL,
        id: USER_ID,
        isAuthenticated: authenticated,
        privacyPolicyAccepted: true,
        crossBorderDataTransferPolicyAccepted: true,
        tokenBalance: 10,
    });
    ctx.repository.projectViewModelRepository.setProject(project);
    ctx.repository.projectViewModelRepository.setReadOnly(false);
    ctx.programService.setNewProgram(project.program);
    ctx.rpi.saveProgramRequest = jest.fn().mockResolvedValue(answer(200, {}));
    ctx.rpi.exportProjectRequest = jest
        .fn()
        .mockResolvedValue(answer(201, ARCHIVE_URL));
    ctx.rpi.exportProjectTexRequest = jest
        .fn()
        .mockResolvedValue(answer(201, ARCHIVE_URL));
    const downloadFile = jest
        .spyOn(ctx.repository, 'downloadFile')
        .mockResolvedValue(undefined);
    const onEvent = jest.spyOn(ctx.observerService, 'onEvent');
    const toasts = () =>
        (ctx.repository as MockViewModelRepository).mockState().toasts;
    return { ...ctx, downloadFile, onEvent, toasts };
}

test.each([
    ['labkeeper', 'exportProjectRequest', 'Лабораторная 3 маятник.zip'],
    ['tex', 'exportProjectTexRequest', 'Лабораторная 3 маятник (LaTeX).zip'],
] as const)(
    'архив %s скачивается по адресу из ответа',
    async (format, request, fileName) => {
        const { projectPageService, rpi, downloadFile, onEvent } = setup();

        await projectPageService.onExportProject(format);

        expect(rpi[request]).toHaveBeenCalledWith(project.projectId);
        expect(downloadFile).toHaveBeenCalledWith(ARCHIVE_URL, fileName);
        expect(onEvent).toHaveBeenCalledWith(
            Events.EVENT_PROJECT_EXPORTED,
            expect.objectContaining({ format, ok: true, http_code: 201 })
        );
    }
);

// иначе в архив попала бы версия до последних правок
test('набранное уходит на сервер раньше экспорта', async () => {
    const { projectPageService, rpi, repository } = setup();
    repository.ideViewModelRepository.markProgramChanged();

    await projectPageService.onExportProject('labkeeper');

    const saved = (rpi.saveProgramRequest as jest.Mock).mock
        .invocationCallOrder[0];
    const exported = (rpi.exportProjectRequest as jest.Mock).mock
        .invocationCallOrder[0];
    expect(saved).toBeLessThan(exported);
});

test('пока архив готовится, второй экспорт не начинается', async () => {
    const { projectPageService, rpi, repository } = setup();
    let finish: (value: RequestResult<string>) => void = () => {};
    rpi.exportProjectTexRequest = jest.fn(
        () =>
            new Promise<RequestResult<string>>((resolve) => (finish = resolve))
    );

    const first = projectPageService.onExportProject('tex');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(repository.settingsViewModelRepository.exportingProject()).toBe(
        'tex'
    );
    await projectPageService.onExportProject('labkeeper');
    finish(answer(201, ARCHIVE_URL));
    await first;

    expect(rpi.exportProjectRequest).not.toHaveBeenCalled();
    expect(repository.settingsViewModelRepository.exportingProject()).toBe(
        null
    );
});

test('гостю экспорт предлагает войти', async () => {
    const { projectPageService, rpi, repository } = setup({
        authenticated: false,
    });
    // как в жизни: у гостя проекта на сервере нет
    repository.projectViewModelRepository.setProject(
        undefined as unknown as Project
    );

    await projectPageService.onExportProject('labkeeper');

    expect(rpi.exportProjectRequest).not.toHaveBeenCalled();
    expect(repository.authViewModelRepository.currentView()).toBe('login');
});

// LaTeX-архив сервер собирает, выполняя программу: ошибки те же, что у Run
test('ошибки программы при LaTeX-архиве видны в списке проблем', async () => {
    const { projectPageService, rpi, repository, downloadFile, toasts } =
        setup();
    const errors: CompileErrorResultList = {
        errors: [
            {
                code: CompileError.UNKNOWN_SYMBOL,
                payload: { segmentId: 1, line: 1, position: 0 },
            },
        ],
    };
    rpi.exportProjectTexRequest = jest
        .fn()
        .mockResolvedValue(answer(203, errors));

    await projectPageService.onExportProject('tex');

    expect(downloadFile).not.toHaveBeenCalled();
    expect(repository.projectViewModelRepository.compileErrorResult()).toEqual(
        errors
    );
    expect(toasts()).toContainEqual({
        message: repository.dictionary.project_export.program_errors,
        type: 'error',
    });
});

test.each([
    [
        402,
        (d: MockViewModelRepository['dictionary']) =>
            d.prompt_modal.errors.payment_required,
    ],
    [
        403,
        (d: MockViewModelRepository['dictionary']) =>
            d.filemanager.errors.notEnoughRights,
    ],
    [
        423,
        (d: MockViewModelRepository['dictionary']) => d.synctex.errors.locked,
    ],
    [
        500,
        (d: MockViewModelRepository['dictionary']) =>
            d.filemanager.errors.internalError,
    ],
])('ответ %s объясняется тостом', async (code, message) => {
    const { projectPageService, rpi, repository, downloadFile, toasts } =
        setup();
    rpi.exportProjectTexRequest = jest.fn().mockResolvedValue(answer(code, {}));

    await projectPageService.onExportProject('tex');

    expect(downloadFile).not.toHaveBeenCalled();
    expect(toasts()).toContainEqual({
        message: message(repository.dictionary),
        type: 'error',
    });
    expect(repository.settingsViewModelRepository.exportingProject()).toBe(
        null
    );
});

test.each([
    ['Отчёт', 'labkeeper', 'Отчёт.zip'],
    ['a/b\\c:d*e?f"g<h>i|j', 'labkeeper', 'a b c d e f g h i j.zip'],
    ['///', 'tex', 'labkeeper (LaTeX).zip'],
] as [string, ProjectExportFormat, string][])(
    'имя архива для «%s» (%s): %s',
    (title, format, fileName) => {
        expect(exportFileName(title, format)).toBe(fileName);
    }
);
