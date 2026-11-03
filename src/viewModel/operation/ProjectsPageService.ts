import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { StartupService } from './StartupService.ts';
import { Project, ProjectTemplate, ProjectType } from '../../model/domain.ts';
import { RequestResult } from '../../model/rpi';
import { createEmptyProgram } from '../../model/repository/ProgramRepository.ts';
import { Routes } from '../routes.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ResetService } from '../domain/ResetService.ts';
import {
    AutoCompileReason,
    CompilationService,
} from '../domain/CompilationService.ts';
import { trackEvent } from '../utils/observerContext.ts';

// с запасом: каталог обычно приходит одним запросом
const TEMPLATES_PAGE_SIZE = 100;
// страховка на случай, если сервер станет отдавать страницы бесконечно
const TEMPLATES_MAX_PAGES = 10;

type ProjectSource = 'empty' | 'template' | 'archive';

/** GH-234: ответы импорта, о которых человеку есть что сказать, кроме «не вышло» */
const ARCHIVE_ERRORS: Partial<
    Record<
        number,
        'archive_invalid' | 'archive_too_many_files' | 'archive_too_big'
    >
> = {
    400: 'archive_invalid',
    409: 'archive_too_many_files',
    413: 'archive_too_big',
};

export interface NewProjectRequest {
    projectName: string;
    /** Тип пустого проекта, у проекта из шаблона или архива тип свой */
    projectType: ProjectType;
    template?: ProjectTemplate;
    /** GH-234: архив экспорта или zip с main.tex */
    archive?: File;
    /** Открыть созданный проект сразу в агентском режиме */
    agentMode: boolean;
}

export class ProjectsPageService {
    repository: ViewModelRepository;
    rpi: Rpi;
    loaderService: LoaderService;
    ideService: IdeService;
    startupService: StartupService;
    observerService: ObserverService;
    resetService: ResetService;
    compilationService: CompilationService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        loaderService: LoaderService,
        ideService: IdeService,
        startupService: StartupService,
        observerService: ObserverService,
        resetService: ResetService,
        compilationService: CompilationService
    ) {
        this.rpi = rpi;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.startupService = startupService;
        this.repository = repository;
        this.observerService = observerService;
        this.resetService = resetService;
        this.compilationService = compilationService;
    }

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    onDeleteProject = async (projectId: string, okCallback: () => void) => {
        const result1 = await this.rpi.deleteProjectRequest(projectId);
        if (result1.isOk) {
            this.track(Events.EVENT_PROJECT_DELETED, { project_id: projectId });
            okCallback();
            const result2 = await this.rpi.getAllProjectsRequest();
            if (result2.isOk) {
                this.repository.projectsViewModelRepository.setProjects(
                    (result2.body as { projects: Array<Project> }).projects
                );
            }
            if (result2.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
            }
        }
        if (result1.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
    };

    /**
     * Каталог шаблонов для страницы нового проекта. Он отдаётся страницами,
     * поэтому берём их по очереди, пока не придёт неполная. Загруженный
     * каталог за сессию не меняется и второй раз не запрашивается
     */
    loadTemplates = async () => {
        const projects = this.repository.projectsViewModelRepository;
        const state = projects.templatesRequestState();
        if (state === 'loading' || state === 'ok') {
            return;
        }
        projects.setTemplatesRequestState('loading');
        const templates: ProjectTemplate[] = [];
        const slugs = new Set<string>();
        for (let page = 0; page < TEMPLATES_MAX_PAGES; page += 1) {
            const result = await this.rpi.listTemplatesRequest({
                page,
                size: TEMPLATES_PAGE_SIZE,
            });
            if (!result.isOk) {
                projects.setTemplatesRequestState('error');
                return;
            }
            const received = result.body.templates;
            // сервер без деления на страницы отдал бы тот же каталог снова
            const fresh = received.filter(
                (template) => !slugs.has(template.slug)
            );
            fresh.forEach((template) => slugs.add(template.slug));
            templates.push(...fresh);
            if (received.length < TEMPLATES_PAGE_SIZE || !fresh.length) {
                break;
            }
        }
        projects.setTemplates(templates);
        projects.setTemplatesRequestState('ok');
    };

    /**
     * Пустой проект создаётся с выбранным типом. Проект из шаблона клонируется,
     * а из архива импортируется, и оба получают введённое имя: эти запросы
     * имени не принимают, поэтому оно задаётся вторым. onFinished получает
     * текст ошибки или ничего
     */
    onProjectCreate = async (
        {
            projectName,
            projectType,
            template,
            archive,
            agentMode,
        }: NewProjectRequest,
        onFinished: (error?: string) => void
    ) => {
        const errors = this.repository.dictionary.new_project.error;
        const title = projectName.trim();
        if (!title) {
            this.track(Events.EVENT_PROJECT_CREATE_FAILED, {
                reason: 'empty_name',
            });
            onFinished(errors.empty_name);
            return;
        }

        const source: ProjectSource = archive
            ? 'archive'
            : template
              ? 'template'
              : 'empty';
        const result = archive
            ? await this.withTitle(
                  await this.rpi.importProjectRequest(archive),
                  title
              )
            : template
              ? await this.withTitle(
                    await this.rpi.cloneProjectRequest(template.projectId),
                    title
                )
              : await this.rpi.createProjectRequest(
                    title,
                    createEmptyProgram(),
                    projectType
                );
        const templateSlug =
            source === 'template' && template
                ? { template: template.slug }
                : {};

        if (result.isOk) {
            // у пустого проекта тип тот, что выбран, у копии шаблона и у импорта свой
            const project =
                source === 'empty'
                    ? { ...result.body, projectType }
                    : result.body;
            this.track(Events.EVENT_CREATE_PROJECT, {
                project_id: project.projectId,
                project_type: project.projectType,
                agent_mode: agentMode,
                source,
                ...templateSlug,
            });
            const build = source !== 'empty';
            await this.openCreatedProject(project, agentMode, build);
            onFinished();
            // страница создания ждёт только открытия, собирается проект уже в редакторе
            if (build) {
                await this.buildCreatedProject(
                    project,
                    source === 'archive' ? 'import' : 'template'
                );
            }
            return;
        }

        this.track(Events.EVENT_PROJECT_CREATE_FAILED, {
            reason:
                result.code === 417 ? 'too_many_projects' : String(result.code),
            source,
            ...templateSlug,
        });
        const archiveError =
            source === 'archive' ? ARCHIVE_ERRORS[result.code] : undefined;
        if (result.isUnauth) {
            // Вход проверяет сервер, а не страница: ответ user-info мог ещё не
            // прийти, и вошедший человек выглядел бы гостем
            this.ideService.resetEditor();
            this.track(Events.EVENT_AUTH_MODAL_OPENED, {
                source: 'new_project',
            });
            this.repository.authViewModelRepository.setCurrentView('login');
            onFinished();
        } else if (result.code === 417) {
            onFinished(errors.too_many_projects);
        } else if (archiveError) {
            onFinished(errors[archiveError]);
        } else if (
            source === 'template' &&
            (result.code === 403 || result.code === 404)
        ) {
            onFinished(errors.template_unavailable);
        } else {
            onFinished(errors.failed);
        }
    };

    /** Копия шаблона и импорт приходят со своим именем, введённое ставится вторым запросом */
    private withTitle = async (
        result: RequestResult<Project>,
        title: string
    ): Promise<RequestResult<Project>> => {
        if (!result.isOk || result.body.title === title) {
            return result;
        }
        const renamed = await this.rpi.setTitleRequest(
            result.body.projectId,
            title
        );
        // проект уже создан: с прежним именем его можно переименовать в редакторе
        return renamed.isOk
            ? { ...result, body: { ...result.body, title } }
            : result;
    };

    /**
     * Прежний проект уходит целиком: его лента агента, PDF и файлы к новому
     * не относятся. Проект, который сейчас соберётся, открывается на PDF:
     * на телефоне вместо пустого чата агента виден ход сборки
     */
    private openCreatedProject = async (
        project: Project,
        agentMode: boolean,
        build: boolean
    ) => {
        const route = agentMode ? Routes.ProjectAgent : Routes.Project;
        const projects = this.repository.projectViewModelRepository;
        this.resetService.resetProject();
        this.repository.setLocation(route.replace(':id', project.projectId));
        projects.setProject(project);
        projects.setReadOnly(false);
        projects.setProjectType(project.projectType);
        this.ideService.setNewProgram(project.program);
        this.repository.ideViewModelRepository.setGetProjectRequestState('ok');
        if (build) {
            const settings = this.repository.settingsViewModelRepository;
            settings.setViewerTab('pdf');
            settings.setMobileView('pdf');
        }
        await this.loaderService.loadProjects();
    };

    /**
     * GH-231: проект из шаблона собирается сразу, иначе в агентском режиме,
     * где кнопки «Выполнить» нет, PDF было бы не получить. GH-234: проект
     * из архива тоже
     */
    private buildCreatedProject = async (
        project: Project,
        reason: AutoCompileReason
    ) => {
        // у копии шаблона и у импорта свои файлы: картинки, классы, библиография
        await this.loaderService.loadFiles(project.projectId);
        await this.compilationService.runCompilation({ reason });
    };

    onRowClickedInProjectsList = async (projectId: string) => {
        this.track(Events.EVENT_PROJECT_OPENED, {
            project_id: projectId,
            source: 'list',
        });
        this.repository.setLocation(Routes.Project.replace(':id', projectId));
        await this.startupService.openProjectById(
            {
                isAuthenticated:
                    this.repository.userViewModelRepository.isAuthenticated(),
                id: this.repository.userViewModelRepository.id(),
                email: this.repository.userViewModelRepository.email(),
                privacyPolicyAccepted: false,
                crossBorderDataTransferPolicyAccepted: false,
                tokenBalance:
                    this.repository.userViewModelRepository.tokenBalance(),
            },
            projectId
        );
    };
}
