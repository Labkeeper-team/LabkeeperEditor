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
import { trackEvent } from '../utils/observerContext.ts';

// с запасом: каталог обычно приходит одним запросом
const TEMPLATES_PAGE_SIZE = 100;
// страховка на случай, если сервер станет отдавать страницы бесконечно
const TEMPLATES_MAX_PAGES = 10;

export interface NewProjectRequest {
    projectName: string;
    /** Тип пустого проекта, у проекта из шаблона тип задан шаблоном */
    projectType: ProjectType;
    template?: ProjectTemplate;
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

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        loaderService: LoaderService,
        ideService: IdeService,
        startupService: StartupService,
        observerService: ObserverService,
        resetService: ResetService
    ) {
        this.rpi = rpi;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.startupService = startupService;
        this.repository = repository;
        this.observerService = observerService;
        this.resetService = resetService;
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
     * Пустой проект создаётся с выбранным типом. Проект из шаблона клонируется
     * и получает введённое имя: клонирование имени не принимает, поэтому оно
     * задаётся вторым запросом. onFinished получает текст ошибки или ничего
     */
    onProjectCreate = async (
        { projectName, projectType, template, agentMode }: NewProjectRequest,
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

        const result = template
            ? await this.cloneTemplate(template, title)
            : await this.rpi.createProjectRequest(
                  title,
                  createEmptyProgram(),
                  projectType
              );

        if (result.isOk) {
            // у пустого проекта тип тот, что выбран, у клона тот, что у шаблона
            const project = template
                ? result.body
                : { ...result.body, projectType };
            this.track(Events.EVENT_CREATE_PROJECT, {
                project_id: project.projectId,
                project_type: project.projectType,
                agent_mode: agentMode,
                ...(template ? { template: template.slug } : {}),
            });
            await this.openCreatedProject(project, agentMode);
            onFinished();
            return;
        }

        this.track(Events.EVENT_PROJECT_CREATE_FAILED, {
            reason:
                result.code === 417 ? 'too_many_projects' : String(result.code),
            ...(template ? { template: template.slug } : {}),
        });
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
        } else if (template && (result.code === 403 || result.code === 404)) {
            onFinished(errors.template_unavailable);
        } else {
            onFinished(errors.failed);
        }
    };

    private cloneTemplate = async (
        template: ProjectTemplate,
        title: string
    ): Promise<RequestResult<Project>> => {
        const result = await this.rpi.cloneProjectRequest(template.projectId);
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

    private openCreatedProject = async (
        project: Project,
        agentMode: boolean
    ) => {
        const route = agentMode ? Routes.ProjectAgent : Routes.Project;
        this.repository.setLocation(route.replace(':id', project.projectId));
        this.resetService.resetFileManagerProjectState();
        this.repository.projectViewModelRepository.setProject(project);
        this.ideService.setNewProgram(project.program);
        await this.loaderService.loadProjects();
        this.repository.projectViewModelRepository.setReadOnly(false);
        this.repository.projectViewModelRepository.setProjectType(
            project.projectType
        );
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
