import { Project } from '../../../model/domain.ts';
import { RequestResult } from '../../../model/rpi';
import { Events } from '../../../model/service/ObserverService.ts';
import { mockContext, USER_EMAIL, USER_ID } from '../common.ts';

test('project-create-replaces-stale-editor-program-with-created-project-program', async () => {
    const {
        programService,
        projectsPageService,
        repository,
        rpi,
        observerService,
    } = mockContext();
    const onEvent = jest.spyOn(observerService, 'onEvent');
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
        crossBorderDataTransferPolicyAccepted: true,
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
        {
            projectName: 'New Latex Project',
            projectType: 'latex',
            agentMode: false,
        },
        () => {}
    );

    expect(
        repository.projectViewModelRepository.currentProgram().segments
    ).toStrictEqual([]);
    expect(repository.projectViewModelRepository.project()?.projectId).toBe(
        emptyLatexProject.projectId
    );
    expect(onEvent).toHaveBeenCalledWith(
        Events.EVENT_CREATE_PROJECT,
        expect.objectContaining({
            project_id: emptyLatexProject.projectId,
            project_type: 'latex',
        })
    );
});

const ok = <T>(body: T, code = 200): RequestResult<T> => ({
    code,
    body,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
});

const failed = (code: number): RequestResult<never> => ({
    code,
    body: undefined as never,
    isOk: false,
    isUnauth: code === 401,
    isForbidden: code === 403,
});

const template = (slug: string, categories = ['latex', 'labs']) => ({
    slug,
    projectId: `${slug}-project`,
    title: `Шаблон ${slug}`,
    description: 'описание',
    categories,
    path: `/templates/${slug}`,
});

const clonedProject = (projectId: string, title: string): Project => ({
    projectId,
    userId: USER_ID,
    title,
    lastModified: new Date().toISOString(),
    program: { segments: [], parameters: { roundStrategy: 'noRound' } },
    isPublic: false,
    projectType: 'markdown',
});

const signedIn = () => {
    const context = mockContext();
    context.repository.userViewModelRepository.setUserInfo({
        email: USER_EMAIL,
        id: USER_ID,
        isAuthenticated: true,
        privacyPolicyAccepted: true,
        crossBorderDataTransferPolicyAccepted: true,
        tokenBalance: 0,
    });
    context.rpi.getAllProjectsRequest = jest
        .fn()
        .mockResolvedValue(ok({ projects: [] }));
    // копия шаблона после открытия подтягивает свои файлы и собирается
    context.rpi.listFilesRequest = jest
        .fn()
        .mockResolvedValue(
            ok({ files: [{ fileName: 'altacv.cls', url: '/f/altacv.cls' }] })
        );
    context.rpi.listHunksRequest = jest
        .fn()
        .mockResolvedValue(ok({ hunks: [] }));
    context.rpi.getUserInfoRequest = jest.fn().mockResolvedValue(
        ok({
            email: USER_EMAIL,
            id: USER_ID,
            isAuthenticated: true,
            privacyPolicyAccepted: true,
            crossBorderDataTransferPolicyAccepted: true,
            tokenBalance: 0,
        })
    );
    context.rpi.compileProjectRequest = jest
        .fn()
        .mockResolvedValue(ok({ segments: [] }));
    context.rpi.compileProjectPdfRequest = jest
        .fn()
        .mockResolvedValue(ok({ pdfUri: 'https://files.test/copy.pdf' }));
    return context;
};

describe('каталог шаблонов', () => {
    test('страницы берутся по очереди до неполной', async () => {
        const { projectsPageService, repository, rpi } = mockContext();
        const firstPage = Array.from({ length: 100 }, (_, index) =>
            template(`t${index}`)
        );
        rpi.listTemplatesRequest = jest
            .fn()
            .mockResolvedValueOnce(ok({ templates: firstPage }))
            .mockResolvedValueOnce(ok({ templates: [template('last')] }));

        await projectsPageService.loadTemplates();

        expect(rpi.listTemplatesRequest).toHaveBeenNthCalledWith(1, {
            page: 0,
            size: 100,
        });
        expect(rpi.listTemplatesRequest).toHaveBeenNthCalledWith(2, {
            page: 1,
            size: 100,
        });
        const projects = repository.projectsViewModelRepository;
        expect(projects.templates()).toHaveLength(101);
        expect(projects.templates()[100].slug).toBe('last');
        expect(projects.templatesRequestState()).toBe('ok');
    });

    test('сервер без страниц не гоняет запросы по кругу', async () => {
        const { projectsPageService, repository, rpi } = mockContext();
        const catalog = Array.from({ length: 100 }, (_, index) =>
            template(`t${index}`)
        );
        rpi.listTemplatesRequest = jest
            .fn()
            .mockResolvedValue(ok({ templates: catalog }));

        await projectsPageService.loadTemplates();

        expect(rpi.listTemplatesRequest).toHaveBeenCalledTimes(2);
        expect(repository.projectsViewModelRepository.templates()).toHaveLength(
            100
        );
    });

    test('загруженный каталог второй раз не запрашивается', async () => {
        const { projectsPageService, rpi } = mockContext();
        rpi.listTemplatesRequest = jest
            .fn()
            .mockResolvedValue(ok({ templates: [template('a')] }));

        await projectsPageService.loadTemplates();
        await projectsPageService.loadTemplates();

        expect(rpi.listTemplatesRequest).toHaveBeenCalledTimes(1);
    });

    test('после ошибки каталог можно запросить снова', async () => {
        const { projectsPageService, repository, rpi } = mockContext();
        rpi.listTemplatesRequest = jest
            .fn()
            .mockResolvedValueOnce(failed(404))
            .mockResolvedValueOnce(ok({ templates: [template('a')] }));
        const projects = repository.projectsViewModelRepository;

        await projectsPageService.loadTemplates();
        expect(projects.templatesRequestState()).toBe('error');
        expect(projects.templates()).toEqual([]);

        await projectsPageService.loadTemplates();
        expect(projects.templatesRequestState()).toBe('ok');
        expect(projects.templates().map((item) => item.slug)).toEqual(['a']);
    });
});

describe('создание проекта', () => {
    test('пустое имя не уходит на сервер', async () => {
        const { projectsPageService, rpi } = signedIn();
        rpi.createProjectRequest = jest.fn();
        const onFinished = jest.fn();

        await projectsPageService.onProjectCreate(
            { projectName: '   ', projectType: 'latex', agentMode: false },
            onFinished
        );

        expect(rpi.createProjectRequest).not.toHaveBeenCalled();
        expect(onFinished).toHaveBeenCalledWith(
            'Please input the project name'
        );
    });

    test('пустой проект создаётся с обрезанным именем и выбранным типом', async () => {
        const { projectsPageService, repository, rpi } = signedIn();
        rpi.createProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(clonedProject('new', 'Отчёт'), 201));
        const onFinished = jest.fn();

        await projectsPageService.onProjectCreate(
            { projectName: '  Отчёт ', projectType: 'latex', agentMode: false },
            onFinished
        );

        expect(rpi.createProjectRequest).toHaveBeenCalledWith(
            'Отчёт',
            { segments: [], parameters: { roundStrategy: 'threeDigits' } },
            'latex'
        );
        expect(repository.location()).toBe('/project/new');
        expect(repository.projectViewModelRepository.mode()).toBe('latex');
        expect(onFinished).toHaveBeenCalledWith();
    });

    // Labkeeper-team/LabkeeperServer#669: движок пустого LaTeX-проекта уходит в параметрах программы
    test('пустой LaTeX-проект создаётся с выбранным XeLaTeX', async () => {
        const { projectsPageService, rpi } = signedIn();
        rpi.createProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(clonedProject('new', 'Отчёт'), 201));

        await projectsPageService.onProjectCreate(
            {
                projectName: 'Отчёт',
                projectType: 'latex',
                latexCompiler: 'xelatex',
                agentMode: false,
            },
            jest.fn()
        );

        expect(rpi.createProjectRequest).toHaveBeenCalledWith(
            'Отчёт',
            {
                segments: [],
                parameters: {
                    roundStrategy: 'threeDigits',
                    latexCompiler: 'xelatex',
                },
            },
            'latex'
        );
    });

    // pdflatex — значение по умолчанию на сервере, а markdown PDF не собирает: поле не нужно
    test.each([
        ['latex', 'pdflatex'],
        ['markdown', 'xelatex'],
    ] as const)(
        'проект %s с движком %s создаётся без latexCompiler',
        async (projectType, latexCompiler) => {
            const { projectsPageService, rpi } = signedIn();
            rpi.createProjectRequest = jest
                .fn()
                .mockResolvedValue(ok(clonedProject('new', 'Отчёт'), 201));

            await projectsPageService.onProjectCreate(
                {
                    projectName: 'Отчёт',
                    projectType,
                    latexCompiler,
                    agentMode: false,
                },
                jest.fn()
            );

            expect(rpi.createProjectRequest).toHaveBeenCalledWith(
                'Отчёт',
                { segments: [], parameters: { roundStrategy: 'threeDigits' } },
                projectType
            );
        }
    );

    // вход проверяет сервер: страница могла спросить раньше, чем пришёл user-info
    test('401 на создание открывает вход вместо ошибки', async () => {
        const { projectsPageService, repository, rpi } = mockContext();
        rpi.createProjectRequest = jest.fn().mockResolvedValue(failed(401));
        const onFinished = jest.fn();
        const before = repository.location();

        await projectsPageService.onProjectCreate(
            { projectName: 'Отчёт', projectType: 'latex', agentMode: false },
            onFinished
        );

        expect(rpi.createProjectRequest).toHaveBeenCalled();
        expect(repository.authViewModelRepository.currentView()).toBe('login');
        expect(onFinished).toHaveBeenCalledWith();
        expect(repository.location()).toBe(before);
    });

    test('проект из шаблона клонируется, получает имя и открывается в агентском режиме', async () => {
        const { projectsPageService, repository, rpi, observerService } =
            signedIn();
        const onEvent = jest.spyOn(observerService, 'onEvent');
        rpi.cloneProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(clonedProject('copy', 'Шаблон cv'), 201));
        rpi.setTitleRequest = jest.fn().mockResolvedValue(ok({}));
        rpi.createProjectRequest = jest.fn();
        const onFinished = jest.fn();

        await projectsPageService.onProjectCreate(
            {
                projectName: 'Моё резюме',
                projectType: 'latex',
                template: template('cv', ['markdown', 'cv']),
                agentMode: true,
            },
            onFinished
        );

        expect(rpi.createProjectRequest).not.toHaveBeenCalled();
        expect(rpi.cloneProjectRequest).toHaveBeenCalledWith('cv-project');
        expect(rpi.setTitleRequest).toHaveBeenCalledWith('copy', 'Моё резюме');
        expect(repository.location()).toBe('/project/copy/agent');
        const project = repository.projectViewModelRepository.project();
        expect(project?.title).toBe('Моё резюме');
        // тип у клона тот, что у шаблона, а не выбранный на странице
        expect(repository.projectViewModelRepository.mode()).toBe('markdown');
        expect(onEvent).toHaveBeenCalledWith(
            Events.EVENT_CREATE_PROJECT,
            expect.objectContaining({
                project_id: 'copy',
                project_type: 'markdown',
                template: 'cv',
                agent_mode: true,
            })
        );
        expect(onFinished).toHaveBeenCalledWith();
    });

    test('имя шаблона не переименовывается вторым запросом', async () => {
        const { projectsPageService, rpi } = signedIn();
        rpi.cloneProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(clonedProject('copy', 'Шаблон cv'), 201));
        rpi.setTitleRequest = jest.fn();

        await projectsPageService.onProjectCreate(
            {
                projectName: 'Шаблон cv',
                projectType: 'latex',
                template: template('cv'),
                agentMode: false,
            },
            () => {}
        );

        expect(rpi.setTitleRequest).not.toHaveBeenCalled();
    });

    test('неудачное переименование не мешает открыть созданный проект', async () => {
        const { projectsPageService, repository, rpi } = signedIn();
        rpi.cloneProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(clonedProject('copy', 'Шаблон cv'), 201));
        rpi.setTitleRequest = jest.fn().mockResolvedValue(failed(500));
        const onFinished = jest.fn();

        await projectsPageService.onProjectCreate(
            {
                projectName: 'Моё резюме',
                projectType: 'latex',
                template: template('cv'),
                agentMode: false,
            },
            onFinished
        );

        expect(repository.location()).toBe('/project/copy');
        expect(repository.projectViewModelRepository.project()?.title).toBe(
            'Шаблон cv'
        );
        expect(onFinished).toHaveBeenCalledWith();
    });

    test.each([
        [404, 'This template is unavailable now, please pick another one'],
        [403, 'This template is unavailable now, please pick another one'],
        [417, 'Too many projects'],
        [500, 'Could not create the project, please try again'],
    ])(
        'ответ %i на клонирование шаблона даёт понятную ошибку',
        async (code, message) => {
            const { projectsPageService, repository, rpi } = signedIn();
            rpi.cloneProjectRequest = jest.fn().mockResolvedValue(failed(code));
            rpi.setTitleRequest = jest.fn();
            const onFinished = jest.fn();
            const before = repository.location();

            await projectsPageService.onProjectCreate(
                {
                    projectName: 'Моё резюме',
                    projectType: 'latex',
                    template: template('cv'),
                    agentMode: false,
                },
                onFinished
            );

            expect(onFinished).toHaveBeenCalledWith(message);
            expect(rpi.setTitleRequest).not.toHaveBeenCalled();
            expect(repository.location()).toBe(before);
        }
    );
});

describe('GH-231 сборка проекта из шаблона', () => {
    const fromTemplate = (agentMode: boolean) => ({
        projectName: 'Моё резюме',
        projectType: 'latex' as const,
        template: template('cv', ['latex', 'cv']),
        agentMode,
    });

    const latexCopy = () => ({
        ...clonedProject('copy', 'Моё резюме'),
        projectType: 'latex' as const,
    });

    test('копия шаблона сразу собирается и показывает PDF', async () => {
        const { projectsPageService, repository, rpi, observerService } =
            signedIn();
        const onEvent = jest.spyOn(observerService, 'onEvent');
        rpi.cloneProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(latexCopy(), 201));
        rpi.setTitleRequest = jest.fn();
        let filesWhileBuilding: string[] = [];
        rpi.compileProjectPdfRequest = jest.fn().mockImplementation(() => {
            filesWhileBuilding = repository.projectViewModelRepository
                .files()
                .map((file) => file.fileName);
            return Promise.resolve(
                ok({ pdfUri: 'https://files.test/copy.pdf' })
            );
        });

        await projectsPageService.onProjectCreate(fromTemplate(true), () => {});

        expect(rpi.compileProjectPdfRequest).toHaveBeenCalledWith('copy');
        expect(repository.projectViewModelRepository.pdfUri()).toBe(
            'https://files.test/copy.pdf'
        );
        // файлы шаблона видны в дереве ещё до конца сборки
        expect(filesWhileBuilding).toEqual(['altacv.cls']);
        // в аналитике это не нажатие «Выполнить»
        const runs = onEvent.mock.calls.filter(
            ([name]) => name === 'start_run' || name === 'auto_run'
        );
        expect(runs).toEqual([
            ['auto_run', expect.objectContaining({ reason: 'template' })],
        ]);
    });

    test('на телефоне вместо пустого чата агента открывается PDF', async () => {
        const { projectsPageService, repository, rpi } = signedIn();
        const settings = repository.settingsViewModelRepository;
        const steps: string[] = [];
        jest.spyOn(settings, 'setMobileView').mockImplementation((view) =>
            steps.push(`mobile:${view}`)
        );
        jest.spyOn(settings, 'setViewerTab').mockImplementation((tab) =>
            steps.push(`tab:${tab}`)
        );
        rpi.cloneProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(latexCopy(), 201));
        rpi.compileProjectPdfRequest = jest.fn().mockImplementation(() => {
            steps.push('compile');
            return Promise.resolve(
                ok({ pdfUri: 'https://files.test/copy.pdf' })
            );
        });

        await projectsPageService.onProjectCreate(fromTemplate(true), () => {});

        // PDF открыт уже на время сборки, а не только после неё
        expect(steps.slice(0, 3)).toEqual(['tab:pdf', 'mobile:pdf', 'compile']);
    });

    test('страница создания освобождается до конца сборки', async () => {
        const { projectsPageService, rpi, repository } = signedIn();
        rpi.cloneProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(latexCopy(), 201));
        let finishedBeforeBuild = false;
        const onFinished = jest.fn();
        rpi.compileProjectPdfRequest = jest.fn().mockImplementation(() => {
            finishedBeforeBuild = onFinished.mock.calls.length === 1;
            return Promise.resolve(
                ok({ pdfUri: 'https://files.test/copy.pdf' })
            );
        });

        await projectsPageService.onProjectCreate(
            fromTemplate(false),
            onFinished
        );

        expect(finishedBeforeBuild).toBe(true);
        expect(repository.location()).toBe('/project/copy');
    });

    test('пустой проект не собирается', async () => {
        const { projectsPageService, rpi } = signedIn();
        rpi.createProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(clonedProject('new', 'Отчёт'), 201));

        await projectsPageService.onProjectCreate(
            { projectName: 'Отчёт', projectType: 'latex', agentMode: true },
            () => {}
        );

        expect(rpi.compileProjectPdfRequest).not.toHaveBeenCalled();
        expect(rpi.compileProjectRequest).not.toHaveBeenCalled();
    });

    // прежний проект оставлял в новом свою ленту агента, PDF и ошибку загрузки
    test('созданный проект не наследует прежний', async () => {
        const { projectsPageService, repository, rpi } = signedIn();
        repository.projectViewModelRepository.setPdfUri(
            'https://files.test/old.pdf'
        );
        repository.ideViewModelRepository.setGetProjectRequestState(
            'not_found'
        );
        repository.chatViewModelRepository.setHistory([
            {
                id: 'old',
                request: 'старый запрос',
                response: 'старый ответ',
                createdAt: '2026-11-01T10:00:00Z',
            },
        ]);
        repository.chatViewModelRepository.setHistoryRequestState('ok');
        rpi.createProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(clonedProject('new', 'Отчёт'), 201));

        await projectsPageService.onProjectCreate(
            { projectName: 'Отчёт', projectType: 'latex', agentMode: false },
            () => {}
        );

        expect(repository.projectViewModelRepository.pdfUri()).toBeUndefined();
        expect(repository.chatViewModelRepository.history()).toEqual([]);
        // история нового проекта подтянется при открытии чата
        expect(repository.chatViewModelRepository.historyRequestState()).toBe(
            'unknown'
        );
        expect(repository.ideViewModelRepository.getProjectRequestState()).toBe(
            'ok'
        );
    });
});

describe('GH-234 проект из архива', () => {
    const archive = () =>
        new File(['PK'], 'Лаба 3.zip', { type: 'application/zip' });

    const imported = (title = 'Лаба 3') => ({
        ...clonedProject('imported', title),
        projectType: 'latex' as const,
    });

    test('архив импортируется, получает введённое имя и сразу собирается', async () => {
        const { projectsPageService, repository, rpi, observerService } =
            signedIn();
        const onEvent = jest.spyOn(observerService, 'onEvent');
        const file = archive();
        rpi.importProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(imported('Из project.json'), 201));
        rpi.setTitleRequest = jest.fn().mockResolvedValue(ok({}));
        rpi.createProjectRequest = jest.fn();
        rpi.cloneProjectRequest = jest.fn();
        const onFinished = jest.fn();

        await projectsPageService.onProjectCreate(
            {
                projectName: ' Лаба 3 ',
                // выбранный на странице тип не действует: тип пришёл из архива
                projectType: 'markdown',
                archive: file,
                agentMode: true,
            },
            onFinished
        );

        expect(rpi.importProjectRequest).toHaveBeenCalledWith(file);
        expect(rpi.createProjectRequest).not.toHaveBeenCalled();
        expect(rpi.cloneProjectRequest).not.toHaveBeenCalled();
        expect(rpi.setTitleRequest).toHaveBeenCalledWith('imported', 'Лаба 3');
        expect(repository.location()).toBe('/project/imported/agent');
        expect(repository.projectViewModelRepository.mode()).toBe('latex');
        expect(repository.projectViewModelRepository.project()?.title).toBe(
            'Лаба 3'
        );
        expect(rpi.listFilesRequest).toHaveBeenCalledWith('imported');
        expect(rpi.compileProjectPdfRequest).toHaveBeenCalledWith('imported');
        expect(onEvent).toHaveBeenCalledWith(
            Events.EVENT_CREATE_PROJECT,
            expect.objectContaining({
                project_id: 'imported',
                project_type: 'latex',
                source: 'archive',
                agent_mode: true,
            })
        );
        expect(onEvent).toHaveBeenCalledWith(
            'auto_run',
            expect.objectContaining({ reason: 'import' })
        );
        expect(onFinished).toHaveBeenCalledWith();
    });

    test('имя из архива не переименовывается вторым запросом', async () => {
        const { projectsPageService, rpi } = signedIn();
        rpi.importProjectRequest = jest
            .fn()
            .mockResolvedValue(ok(imported('Лаба 3'), 201));
        rpi.setTitleRequest = jest.fn();

        await projectsPageService.onProjectCreate(
            {
                projectName: 'Лаба 3',
                projectType: 'latex',
                archive: archive(),
                agentMode: false,
            },
            () => {}
        );

        expect(rpi.setTitleRequest).not.toHaveBeenCalled();
    });

    test.each([
        [
            400,
            'This is not a project archive: use a Labkeeper export zip or an archive with main.tex',
        ],
        [409, 'The archive has too many files'],
        [413, 'The archive or a file in it is too large'],
        [417, 'Too many projects'],
        [500, 'Could not create the project, please try again'],
    ])(
        'ответ %i на импорт архива даёт понятную ошибку',
        async (code, message) => {
            const { projectsPageService, repository, rpi } = signedIn();
            rpi.importProjectRequest = jest
                .fn()
                .mockResolvedValue(failed(code));
            rpi.setTitleRequest = jest.fn();
            const onFinished = jest.fn();
            const before = repository.location();

            await projectsPageService.onProjectCreate(
                {
                    projectName: 'Лаба 3',
                    projectType: 'latex',
                    archive: archive(),
                    agentMode: false,
                },
                onFinished
            );

            expect(onFinished).toHaveBeenCalledWith(message);
            expect(rpi.setTitleRequest).not.toHaveBeenCalled();
            expect(repository.location()).toBe(before);
        }
    );

    // 400 и 404 у шаблона значат другое: текст про архив туда не попадает
    test('ошибки архива не путаются с ошибками шаблона', async () => {
        const { projectsPageService, rpi } = signedIn();
        rpi.cloneProjectRequest = jest.fn().mockResolvedValue(failed(400));
        const onFinished = jest.fn();

        await projectsPageService.onProjectCreate(
            {
                projectName: 'Резюме',
                projectType: 'latex',
                template: template('cv'),
                agentMode: false,
            },
            onFinished
        );

        expect(onFinished).toHaveBeenCalledWith(
            'Could not create the project, please try again'
        );
    });

    test('401 на импорт открывает вход', async () => {
        const { projectsPageService, repository, rpi } = mockContext();
        rpi.importProjectRequest = jest.fn().mockResolvedValue(failed(401));
        const onFinished = jest.fn();

        await projectsPageService.onProjectCreate(
            {
                projectName: 'Лаба 3',
                projectType: 'latex',
                archive: archive(),
                agentMode: false,
            },
            onFinished
        );

        expect(repository.authViewModelRepository.currentView()).toBe('login');
        expect(onFinished).toHaveBeenCalledWith();
    });
});
