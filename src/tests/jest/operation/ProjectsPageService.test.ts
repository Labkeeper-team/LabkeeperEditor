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
