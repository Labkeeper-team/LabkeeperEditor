import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { StartupService } from './StartupService.ts';
import {
    PROJECT_TAGS_MAX_COUNT,
    Project,
    ProjectShort,
    ProjectTag,
    ProjectTemplate,
    ProjectType,
} from '../../model/domain.ts';
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
import { exportFileName } from './ProjectPageService.ts';

// с запасом: каталог обычно приходит одним запросом
const TEMPLATES_PAGE_SIZE = 100;
// страховка на случай, если сервер станет отдавать страницы бесконечно
const TEMPLATES_MAX_PAGES = 10;

type ProjectSource = 'empty' | 'template' | 'archive';

/**
 * Метки перед отправкой: без пробелов по краям, без пустых и без точных
 * повторов имени, как требует сервер. Больше ничего не трогаем: сервер не
 * ограничивает ни число меток, ни длину имени, ни регистр, и метки, которые
 * поставили не здесь, при сохранении терять нельзя. Лимиты из интерфейса
 * действуют только на то, что человек добавляет сам
 */
export const normalizeProjectTags = (tags: ProjectTag[]): ProjectTag[] => {
    const seen = new Set<string>();
    const result: ProjectTag[] = [];
    for (const tag of tags) {
        const name = tag.name.trim();
        if (!name || seen.has(name)) {
            continue;
        }
        seen.add(name);
        result.push({ name, color: tag.color });
    }
    return result;
};

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

const nameKey = (name: string) => name.trim().toLocaleLowerCase();

/** Правки одного поля проекта, ещё не завершённые, поверх принятого сервером */
interface FieldWrites<T> {
    confirmed: T;
    pending: ((value: T) => T)[];
}

/** Ответ на правку, которую отправлять не пришлось: сервер уже хранит то же */
const NOTHING_TO_SEND: RequestResult<never> = {
    body: undefined as never,
    code: 200,
    isOk: true,
    isUnauth: false,
    isForbidden: false,
};

const sameTags = (a: ProjectTag[], b: ProjectTag[]) =>
    a.length === b.length &&
    a.every((tag, i) => tag.name === b[i].name && tag.color === b[i].color);

/**
 * Метка из боковой панели. Отдельной сущности у метки на сервере нет, она
 * живёт в проектах, поэтому создать, переименовать или перекрасить её значит
 * поменять метки у всех её проектов
 */
export interface TagSaveRequest {
    /** Прежнее имя, если метку правят, а не создают */
    previousName?: string;
    name: string;
    color: string;
    /** Проекты, у которых метка должна быть; у остальных её снимут */
    projectIds: string[];
}

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

    /**
     * Сброс очищает и список проектов. Страница списка тогда говорит, что
     * сессия истекла, а не что проектов нет
     */
    private sessionExpired = () => {
        this.repository.toast(
            this.repository.dictionary.filemanager.errors.sessionExpired,
            'error'
        );
        this.ideService.resetEditor();
        this.repository.ideViewModelRepository.setGetProjectsRequestState(
            'unauth'
        );
    };

    private listedProject = (projectId: string): ProjectShort | undefined =>
        this.repository.projectsViewModelRepository
            .projects()
            .find((project) => project.projectId === projectId);

    /** Меняет проект в списке на месте, не перезапрашивая весь список */
    private patchListedProject = (
        projectId: string,
        patch: Partial<ProjectShort>
    ) => {
        const projects = this.repository.projectsViewModelRepository;
        projects.setProjects(
            projects
                .projects()
                .map((project) =>
                    project.projectId === projectId
                        ? { ...project, ...patch }
                        : project
                )
        );
    };

    /**
     * Незавершённые правки поля проекта (`<id>:tags`, `<id>:public`) и то,
     * что по нему точно хранит сервер
     */
    private writes = new Map<string, FieldWrites<unknown>>();
    /** Удаляемые сейчас проекты: второй щелчок по «Да» запрос не повторяет */
    private deleting = new Set<string>();
    /** Запросы к одному полю идут по очереди, чтобы сервер получил их по порядку */
    private queues = new Map<string, Promise<unknown>>();

    private enqueue = <T>(key: string, send: () => Promise<T>): Promise<T> => {
        const previous = this.queues.get(key) ?? Promise.resolve();
        const request = previous.then(send, send);
        this.queues.set(key, request);
        const cleanup = () => {
            if (this.queues.get(key) === request) {
                this.queues.delete(key);
            }
        };
        request.then(cleanup, cleanup);
        return request;
    };

    /**
     * Оптимистичная правка. Правка задаётся функцией от значения, которое
     * хранит сервер, и применяется к нему в момент отправки: так отказ по
     * одной правке не уезжает на сервер в составе следующей. В списке сразу
     * видны все незавершённые правки поверх того, что принял сервер
     */
    private optimisticWrite = async <T, R extends RequestResult<unknown>>(
        key: string,
        current: T,
        change: (value: T) => T,
        same: (a: T, b: T) => boolean,
        apply: (value: T) => void,
        send: (value: T) => Promise<R>,
        accepted: (result: R, sent: T) => T
    ): Promise<R> => {
        const state = (this.writes.get(key) ?? {
            confirmed: current,
            pending: [],
        }) as FieldWrites<T>;
        this.writes.set(key, state as FieldWrites<unknown>);
        const show = () =>
            apply(
                state.pending.reduce(
                    (value, pending) => pending(value),
                    state.confirmed
                )
            );
        state.pending.push(change);
        show();
        this.loaderService.writeStarted(key);

        const result = await this.enqueue(key, async () => {
            const next = change(state.confirmed);
            if (same(next, state.confirmed)) {
                return NOTHING_TO_SEND as unknown as R;
            }
            const sent = await send(next);
            if (sent.isOk) {
                state.confirmed = accepted(sent, next);
            }
            return sent;
        });
        state.pending.splice(state.pending.indexOf(change), 1);
        show();
        if (!state.pending.length && this.writes.get(key) === state) {
            this.writes.delete(key);
        }
        this.loaderService.writeSettled(key);
        return result;
    };

    /**
     * Список заново, но без спиннера: страница показывает прежний, пока не
     * придёт новый
     */
    private refreshProjects = async () => {
        const result = await this.loaderService.loadProjects({ silent: true });
        if (result.isUnauth) {
            this.sessionExpired();
        }
    };

    /** Метки одного проекта: в списке сразу, на сервере по очереди */
    private writeTags = (
        projectId: string,
        before: ProjectTag[],
        change: (tags: ProjectTag[]) => ProjectTag[]
    ) =>
        this.optimisticWrite(
            `${projectId}:tags`,
            before,
            change,
            sameTags,
            (tags) => this.patchListedProject(projectId, { tags }),
            (tags) => this.rpi.setProjectTagsRequest(projectId, tags),
            (result, sent) => result.body?.tags ?? sent
        );

    /**
     * Метки проекта меняются в списке сразу, а если сервер их не принял,
     * возвращаются прежние
     */
    onProjectTagsChange = async (projectId: string, tags: ProjectTag[]) => {
        const project = this.listedProject(projectId);
        if (!project) {
            return;
        }
        const before = project.tags ?? [];
        const next = normalizeProjectTags(tags);
        if (sameTags(before, next)) {
            return;
        }
        const result = await this.writeTags(projectId, before, () => next);
        if (result.isOk) {
            this.track(Events.EVENT_PROJECT_TAGS_CHANGED, {
                project_id: projectId,
                tags_count: next.length,
                source: 'project',
            });
        } else if (result.isUnauth) {
            this.sessionExpired();
        } else {
            this.repository.toast(
                this.repository.dictionary.projects.errors.tags_failed,
                'error'
            );
        }
    };

    /**
     * Меняет метки сразу у многих проектов, по запросу на проект. Проекты,
     * где сервер отказал, получают прежние метки обратно. rewrite получает
     * метки проекта и возвращает новые или null, если проект не меняется;
     * к меткам, которые хранит сервер, он применяется ещё раз при отправке.
     * Результат: у скольких проектов сервер принял изменения
     */
    private updateTagsInBulk = async (
        rewrite: (projectId: string, tags: ProjectTag[]) => ProjectTag[] | null
    ): Promise<number> => {
        const changed = (projectId: string, tags: ProjectTag[]) => {
            const next = rewrite(projectId, tags);
            return next ? normalizeProjectTags(next) : tags;
        };
        const projects = this.repository.projectsViewModelRepository
            .projects()
            .filter(
                (project) =>
                    !sameTags(
                        project.tags ?? [],
                        changed(project.projectId, project.tags ?? [])
                    )
            );
        if (!projects.length) {
            return 0;
        }
        const results = await Promise.all(
            projects.map((project) =>
                this.writeTags(project.projectId, project.tags ?? [], (tags) =>
                    changed(project.projectId, tags)
                )
            )
        );
        if (results.some((result) => result.isUnauth)) {
            this.sessionExpired();
        } else if (results.some((result) => !result.isOk)) {
            this.repository.toast(
                this.repository.dictionary.projects.errors.tags_failed,
                'error'
            );
        }
        return results.filter(
            (result) => result.isOk && result !== NOTHING_TO_SEND
        ).length;
    };

    /**
     * Создаёт метку или меняет имя, цвет и набор проектов у существующей.
     * Там, где метка уже была, она остаётся на своём месте среди других.
     * Проекту, где меток уже предел, новую не добавляем и говорим об этом
     */
    onTagSave = async ({
        previousName,
        name,
        color,
        projectIds,
    }: TagSaveRequest) => {
        const title = name.trim();
        if (!title) {
            return;
        }
        const keys = new Set([nameKey(title)]);
        if (previousName) {
            keys.add(nameKey(previousName));
        }
        const owners = new Set(projectIds);
        const isFull = (tags: ProjectTag[]) =>
            tags.length >= PROJECT_TAGS_MAX_COUNT &&
            !tags.some((tag) => keys.has(nameKey(tag.name)));
        const overLimit = this.repository.projectsViewModelRepository
            .projects()
            .filter(
                (project) =>
                    owners.has(project.projectId) && isFull(project.tags ?? [])
            ).length;
        const changed = await this.updateTagsInBulk((projectId, tags) => {
            const index = tags.findIndex((tag) => keys.has(nameKey(tag.name)));
            const rest = tags.filter((tag) => !keys.has(nameKey(tag.name)));
            if (!owners.has(projectId)) {
                return rest.length === tags.length ? null : rest;
            }
            if (isFull(tags)) {
                return null;
            }
            const position =
                index < 0
                    ? rest.length
                    : tags
                          .slice(0, index)
                          .filter((tag) => !keys.has(nameKey(tag.name))).length;
            return [
                ...rest.slice(0, position),
                { name: title, color },
                ...rest.slice(position),
            ];
        });
        if (overLimit) {
            this.repository.toast(
                this.repository.dictionary.projects.tags_modal.limit.replace(
                    '${max}',
                    () => `${PROJECT_TAGS_MAX_COUNT}`
                ),
                'error'
            );
        }
        if (changed) {
            this.track(Events.EVENT_PROJECT_TAGS_CHANGED, {
                source: 'sidebar',
                action: previousName ? 'edit' : 'create',
                projects_count: changed,
            });
        }
    };

    /** Снимает метку со всех проектов; сами проекты остаются */
    onTagDelete = async (name: string) => {
        const key = nameKey(name);
        const changed = await this.updateTagsInBulk((_, tags) => {
            const rest = tags.filter((tag) => nameKey(tag.name) !== key);
            return rest.length === tags.length ? null : rest;
        });
        if (changed) {
            this.track(Events.EVENT_PROJECT_TAGS_CHANGED, {
                source: 'sidebar',
                action: 'delete',
                projects_count: changed,
            });
        }
    };

    /** Публичность проекта прямо из списка, без открытия редактора */
    onListedProjectVisibilityChange = async (
        projectId: string,
        visible: boolean
    ) => {
        const project = this.listedProject(projectId);
        if (!project || !!project.isPublic === visible) {
            return;
        }
        const result = await this.optimisticWrite(
            `${projectId}:public`,
            !!project.isPublic,
            () => visible,
            (a, b) => a === b,
            (isPublic) => this.patchListedProject(projectId, { isPublic }),
            (isPublic) =>
                this.rpi.setProjectVisibilityRequest(projectId, isPublic),
            (_, sent) => sent
        );
        if (result.isOk) {
            this.track(Events.EVENT_PROJECT_VISIBILITY_CHANGED, {
                visible,
                source: 'list',
            });
            // открытый в редакторе проект тот же: его шапка должна это знать
            const opened = this.repository.projectViewModelRepository.project();
            if (opened?.projectId === projectId) {
                this.repository.projectViewModelRepository.setProject({
                    ...opened,
                    isPublic: visible,
                });
            }
        } else if (result.isUnauth) {
            this.sessionExpired();
        } else {
            this.repository.toast(
                this.repository.dictionary.projects.errors.visibility_failed,
                'error'
            );
        }
    };

    /** Копия проекта появляется в списке, а человек остаётся на странице */
    onDuplicateProject = async (projectId: string) => {
        const result = await this.rpi.cloneProjectRequest(projectId);
        if (result.isOk) {
            this.track(Events.EVENT_PROJECT_CLONED, {
                source_project_id: projectId,
                source: 'list',
            });
            await this.refreshProjects();
            this.repository.toast(
                this.repository.dictionary.projects.duplicated,
                'success'
            );
            return;
        }
        if (result.isUnauth) {
            this.sessionExpired();
            return;
        }
        this.repository.toast(
            result.code === 417
                ? this.repository.dictionary.new_project.error.too_many_projects
                : this.repository.dictionary.projects.errors.duplicate_failed,
            'error'
        );
    };

    /**
     * Архив проекта, как «Экспорт» в редакторе, но не открывая проект. О
     * понятных отказах говорим теми же словами, что и редактор
     */
    onDownloadProject = async (projectId: string) => {
        const project = this.listedProject(projectId);
        if (!project) {
            return;
        }
        const result = await this.rpi.exportProjectRequest(projectId);
        this.track(Events.EVENT_PROJECT_EXPORTED, {
            format: 'labkeeper',
            ok: result.code === 201,
            http_code: result.code,
            source: 'list',
        });
        if (result.code === 201 && typeof result.body === 'string') {
            await this.repository.downloadFile(
                result.body,
                exportFileName(project.title, 'labkeeper')
            );
            return;
        }
        if (result.isUnauth) {
            this.sessionExpired();
            return;
        }
        const dictionary = this.repository.dictionary;
        const messages: Partial<Record<number, string>> = {
            203: dictionary.project_export.program_errors,
            402: dictionary.prompt_modal.errors.payment_required,
            403: dictionary.filemanager.errors.notEnoughRights,
            404: dictionary.filemanager.errors.notFound,
            423: dictionary.projects.errors.project_busy,
        };
        if (result.code === 402) {
            this.track(Events.EVENT_PAYMENT_REQUIRED, { source: 'export' });
        }
        this.repository.toast(
            messages[result.code] ?? dictionary.projects.errors.download_failed,
            'error'
        );
    };

    /** Повторный запрос, пока первый не вернулся, не отправляется */
    onDeleteProject = async (projectId: string, okCallback: () => void) => {
        if (this.deleting.has(projectId)) {
            return;
        }
        this.deleting.add(projectId);
        try {
            const result = await this.rpi.deleteProjectRequest(projectId);
            if (result.isOk) {
                this.track(Events.EVENT_PROJECT_DELETED, {
                    project_id: projectId,
                });
                okCallback();
                // проект пропадает сразу, не дожидаясь нового списка
                this.repository.projectsViewModelRepository.setProjects(
                    this.repository.projectsViewModelRepository
                        .projects()
                        .filter((project) => project.projectId !== projectId)
                );
                await this.refreshProjects();
            } else if (result.isUnauth) {
                okCallback();
                this.sessionExpired();
            } else {
                this.repository.toast(
                    this.repository.dictionary.projects.errors.delete_failed,
                    'error'
                );
            }
        } finally {
            this.deleting.delete(projectId);
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
