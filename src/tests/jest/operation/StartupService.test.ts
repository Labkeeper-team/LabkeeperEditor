import {
    matchRepositorySnapshot,
    mockAuthenticatedStartup,
    mockContext,
    mockS3LabsFileForDefaultLab,
    mockUserInfoForUnauthorized,
    mockUserInfoWithDefaultUser,
    PROJECT_ID,
    USER_ID,
} from '../common.ts';
import { RichProject } from '../../../model/rpi';
import { Routes } from '../../../viewModel/routes.ts';

/*
Сценарий:
1. Заходим на сайт с авторизацией
 */
test('onAppStartup-qr-test', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockS3LabsFileForDefaultLab(rpi);
    mockUserInfoForUnauthorized(rpi);
    repository.setLocation('/qr/v1');
    await startupService.onAppStartup();

    matchRepositorySnapshot(repository);
});

test('pay-page-restores-latest-pending-purchase', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoWithDefaultUser(rpi);
    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: { projects: [] },
    });
    rpi.listBillingPurchasesRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            purchases: [
                {
                    id: 'purchase-1',
                    tokenPriceId: 'price-1',
                    yookassa: { widgetToken: 'widget-token-1' },
                    status: 'pending',
                    createdAt: '2026-08-10T12:00:00Z',
                    updatedAt: '2026-08-10T12:00:00Z',
                },
            ],
        },
    });
    repository.setLocation(Routes.Pay);

    await startupService.onAppStartup();

    expect(rpi.listBillingPurchasesRequest).toHaveBeenCalledWith({
        page: 0,
        size: 1,
        status: 'pending',
    });
    expect(repository.billingViewModelRepository.paymentWidgetToken()).toBe(
        'widget-token-1'
    );
    expect(repository.location()).toBe(Routes.Pay);
});

test('pay-page-redirects-to-tokens-when-no-pending-purchases', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoWithDefaultUser(rpi);
    rpi.getAllProjectsRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: { projects: [] },
    });
    rpi.listBillingPurchasesRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: { purchases: [] },
    });
    repository.setLocation(Routes.Pay);

    await startupService.onAppStartup();

    expect(rpi.listBillingPurchasesRequest).toHaveBeenCalled();
    expect(
        repository.billingViewModelRepository.paymentWidgetToken()
    ).toBeUndefined();
    expect(repository.location()).toBe(Routes.Tokens);
});

test('pay-page-redirects-to-tokens-when-unauthenticated', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoForUnauthorized(rpi);
    rpi.listBillingPurchasesRequest = jest.fn();
    repository.setLocation(Routes.Pay);

    await startupService.onAppStartup();

    expect(rpi.listBillingPurchasesRequest).not.toHaveBeenCalled();
    expect(repository.location()).toBe(Routes.Tokens);
});

test('project-default-open-latex-replaces-history-entry', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoForUnauthorized(rpi);
    repository.projectViewModelRepository.setProjectType('markdown');
    repository.setLocation(Routes.ProjectDefault);
    const setLocation = jest.spyOn(repository, 'setLocation');

    await startupService.onAppStartup(undefined, 'latex');

    expect(repository.projectViewModelRepository.mode()).toBe('latex');
    expect(repository.location()).toBe(Routes.ProjectDefault);
    expect(setLocation).toHaveBeenCalledWith(Routes.ProjectDefault, {
        replace: true,
    });
});

test('home-open-latex-replaces-history-entry', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockUserInfoForUnauthorized(rpi);
    repository.setLocation(Routes.Home);
    const setLocation = jest.spyOn(repository, 'setLocation');

    await startupService.onAppStartup(undefined, 'latex');

    expect(setLocation).toHaveBeenCalledWith(Routes.ProjectDefault, {
        replace: true,
    });
});

test('qr-redirect-to-project-default-keeps-history-entry', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockS3LabsFileForDefaultLab(rpi);
    mockUserInfoForUnauthorized(rpi);
    repository.setLocation('/qr/v1');
    const setLocation = jest.spyOn(repository, 'setLocation');

    await startupService.onAppStartup();

    expect(setLocation).toHaveBeenCalledWith(Routes.ProjectDefault, {
        replace: false,
    });
});

test('authenticated-project-default-replaces-with-project-id', async () => {
    const { startupService, rpi, repository } = mockContext();
    mockAuthenticatedStartup(rpi);
    repository.setLocation(Routes.ProjectDefault);
    const setLocation = jest.spyOn(repository, 'setLocation');

    await startupService.onAppStartup();

    expect(setLocation).toHaveBeenCalledWith(
        Routes.Project.replace(':id', PROJECT_ID),
        { replace: true }
    );
});

/**
 * Согласие на трансграничную передачу, данное до входа, лежит только в браузере.
 * После входа оно должно уехать на сервер само, иначе плашка выскочит второй раз
 */

const okEmpty = {
    code: 200,
    body: undefined,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
};

function startupWithConsent(serverAccepted: boolean) {
    const ctx = mockContext();
    mockAuthenticatedStartup(ctx.rpi);
    ctx.rpi.getUserInfoRequest = jest.fn().mockResolvedValue({
        code: 200,
        body: {
            isAuthenticated: true,
            email: 'a@gmail.com',
            id: 1,
            privacyPolicyAccepted: true,
            crossBorderDataTransferPolicyAccepted: serverAccepted,
            tokenBalance: 0,
        },
        isOk: true,
        isUnauth: false,
        isForbidden: false,
    });
    ctx.rpi.acceptCrossBorderDataTransferPolicyRequest = jest
        .fn()
        .mockResolvedValue(okEmpty);
    ctx.repository.setLocation(`/project/${PROJECT_ID}`);
    return ctx;
}

test('consent-given-before-login-is-sent-after-login', async () => {
    const ctx = startupWithConsent(false);
    ctx.repository.persistenceViewModelRepository.setCrossBorderConsentAcceptedLocally(
        true
    );

    await ctx.startupService.onAppStartup();

    expect(
        ctx.rpi.acceptCrossBorderDataTransferPolicyRequest
    ).toHaveBeenCalledTimes(1);
});

test('consent-already-on-the-server-is-not-sent-again', async () => {
    const ctx = startupWithConsent(true);
    ctx.repository.persistenceViewModelRepository.setCrossBorderConsentAcceptedLocally(
        true
    );

    await ctx.startupService.onAppStartup();

    expect(
        ctx.rpi.acceptCrossBorderDataTransferPolicyRequest
    ).not.toHaveBeenCalled();
});

test('consent-is-not-invented-for-a-user-who-never-gave-it', async () => {
    const ctx = startupWithConsent(false);

    await ctx.startupService.onAppStartup();

    expect(
        ctx.rpi.acceptCrossBorderDataTransferPolicyRequest
    ).not.toHaveBeenCalled();
});

/**
 * Проект, который ещё ни разу не собирали, открывается сразу на агенте:
 * справа всё равно нечего смотреть
 */

type ProjectOverrides = Partial<RichProject>;

function openProject(
    overrides: ProjectOverrides = {},
    files: { fileName: string; url: string }[] = []
) {
    const ctx = mockContext();
    mockAuthenticatedStartup(ctx.rpi);
    ctx.rpi.getProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            projectId: PROJECT_ID,
            userId: USER_ID,
            title: 'проект',
            lastModified: '2026-09-15T10:00:00Z',
            isPublic: false,
            program: { segments: [], parameters: { roundStrategy: 'noRound' } },
            projectType: 'markdown',
            ...overrides,
        },
    });
    ctx.rpi.listFilesRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            files: files.map((file) => ({ autogenerated: false, ...file })),
        },
    });
    ctx.repository.settingsViewModelRepository.setViewerTab = jest.fn();
    ctx.repository.settingsViewModelRepository.setMobileView = jest.fn();
    ctx.repository.setLocation(`/project/${PROJECT_ID}`);
    return ctx;
}

const COMPILED = {
    segments: [{ type: 'md', text: 'готово' }],
} as unknown as RichProject['lastProgramResult'];

const openedTheAgent = (ctx: ReturnType<typeof openProject>) => {
    const settings = ctx.repository.settingsViewModelRepository;
    expect(settings.setViewerTab).toHaveBeenCalledWith('chat');
    // на телефоне агент это отдельный экран
    expect(settings.setMobileView).toHaveBeenCalledWith('chat');
};

const keptTheViewer = (ctx: ReturnType<typeof openProject>) => {
    const settings = ctx.repository.settingsViewModelRepository;
    expect(settings.setViewerTab).not.toHaveBeenCalledWith('chat');
    expect(settings.setMobileView).not.toHaveBeenCalledWith('chat');
};

test('never-compiled-project-opens-the-agent', async () => {
    const ctx = openProject({ lastProgramResult: undefined });

    await ctx.startupService.onAppStartup();

    openedTheAgent(ctx);
});

test('compiled-project-keeps-the-viewer', async () => {
    const ctx = openProject({ lastProgramResult: COMPILED });

    await ctx.startupService.onAppStartup();

    keptTheViewer(ctx);
});

test('compiled-empty-project-keeps-the-viewer', async () => {
    // пустой результат это тоже результат: у несобранного проекта поля нет вовсе
    const ctx = openProject({ lastProgramResult: { segments: [] } });

    await ctx.startupService.onAppStartup();

    keptTheViewer(ctx);
});

test('latex-project-without-pdf-opens-the-agent', async () => {
    // результат сегментов у latex не показывается, смотрят только pdf
    const ctx = openProject({
        projectType: 'latex',
        lastProgramResult: COMPILED,
    });

    await ctx.startupService.onAppStartup();

    openedTheAgent(ctx);
});

test('latex-project-with-last-pdf-keeps-the-viewer', async () => {
    const ctx = openProject({
        projectType: 'latex',
        lastPdf: 'https://files.labkeeper.io/result.pdf',
    });

    await ctx.startupService.onAppStartup();

    keptTheViewer(ctx);
});

test('latex-project-with-a-pdf-file-keeps-the-viewer', async () => {
    // pdf приезжает не только в lastPdf, но и файлом проекта
    const ctx = openProject({ projectType: 'latex' }, [
        { fileName: 'main.pdf', url: 'https://files.labkeeper.io/main.pdf' },
    ]);

    await ctx.startupService.onAppStartup();

    keptTheViewer(ctx);
});

test('foreign-project-never-compiled-keeps-the-viewer', async () => {
    // у чужого проекта чата нет
    const ctx = openProject({
        userId: USER_ID + 1,
        lastProgramResult: undefined,
    });

    await ctx.startupService.onAppStartup();

    keptTheViewer(ctx);
});

test('default-project-never-compiled-opens-the-agent', async () => {
    const ctx = openProject();
    ctx.repository.setLocation(Routes.ProjectDefault);

    await ctx.startupService.onAppStartup();

    openedTheAgent(ctx);
});

function holdFiles(ctx: ReturnType<typeof openProject>) {
    let answerFiles: (files: []) => void = () => {};
    ctx.rpi.listFilesRequest = jest.fn(
        () =>
            new Promise((resolve) => {
                answerFiles = (files) =>
                    resolve({
                        code: 200,
                        isOk: true,
                        isUnauth: false,
                        isForbidden: false,
                        body: { files },
                    });
            })
    );
    return async () => {
        for (let tick = 0; tick < 50; tick += 1) {
            if ((ctx.rpi.listFilesRequest as jest.Mock).mock.calls.length) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        expect(ctx.rpi.listFilesRequest).toHaveBeenCalled();
        return () => answerFiles([]);
    };
}

test('never-compiled-project-opens-the-agent-before-files-load', async () => {
    const ctx = openProject({ lastProgramResult: undefined });
    const filesRequested = holdFiles(ctx);

    const startup = ctx.startupService.onAppStartup();
    const releaseFiles = await filesRequested();

    // иначе телефон успевает показать редактор, и экран уезжает на агента из-под рук
    openedTheAgent(ctx);

    releaseFiles();
    await startup;
});

test('default-latex-project-opens-the-agent-before-files-load', async () => {
    // у проекта по умолчанию pdf из файлов не берётся, ждать их незачем
    const ctx = openProject();
    ctx.rpi.getDefaultProjectRequest = jest.fn().mockResolvedValue({
        code: 200,
        isOk: true,
        isUnauth: false,
        isForbidden: false,
        body: {
            projectId: PROJECT_ID,
            userId: USER_ID,
            title: 'проект',
            lastModified: '2026-09-15T10:00:00Z',
            isPublic: false,
            program: { segments: [], parameters: { roundStrategy: 'noRound' } },
            projectType: 'latex',
        },
    });
    ctx.repository.setLocation(Routes.ProjectDefault);
    const filesRequested = holdFiles(ctx);

    const startup = ctx.startupService.onAppStartup();
    const releaseFiles = await filesRequested();

    openedTheAgent(ctx);

    releaseFiles();
    await startup;
});
