import { ProjectShort } from '../../model/domain.ts';
import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { IdeService } from './IdeService.ts';
import { ProgramService } from '../../model/service/ProgramService.ts';

export class LoaderService {
    rpi: Rpi;
    repository: ViewModelRepository;
    ideService: IdeService;
    programService: ProgramService;
    private saveProgramPromise: Promise<void> | null = null;
    /**
     * Правки полей проектов из списка (`<id>:tags`, `<id>:public`), которые
     * ещё идут. Пока правка идёт, список с сервера её поле не трогает: ответ
     * мог уйти раньше, чем сервер её принял
     */
    private pendingWrites = new Map<string, number>();
    /** Когда по часам clock завершилась последняя правка поля */
    private settledWrites = new Map<string, number>();
    private clock = 0;
    /** Когда ушёл запрос, чей список сейчас показан */
    private shownListRequestedAt = 0;
    private saveProgramRequested = false;

    constructor(
        rpi: Rpi,
        repository: ViewModelRepository,
        ideService: IdeService,
        programService: ProgramService
    ) {
        this.rpi = rpi;
        this.repository = repository;
        this.ideService = ideService;
        this.programService = programService;
    }

    loadFiles = async (projectId: string) => {
        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'loading'
        );
        const result = await this.rpi.listFilesRequest(projectId);

        if (result.isOk) {
            this.repository.projectViewModelRepository.setFiles(
                result.body.files
            );
            this.repository.ideViewModelRepository.setGetFilesRequestState(
                'ok'
            );
        } else if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        } else if (result.isForbidden) {
            this.repository.ideViewModelRepository.setGetFilesRequestState(
                'forbidden'
            );
        } else {
            this.repository.ideViewModelRepository.setGetFilesRequestState(
                'error'
            );
        }
    };

    segmentEditorSaveProgram = async (): Promise<void> => {
        if (this.repository.projectViewModelRepository.projectIsReadonly()) {
            return;
        }
        this.saveProgramRequested = true;
        const savePromise =
            this.saveProgramPromise ?? this.flushProgramSaveRequests();
        this.saveProgramPromise = savePromise;

        try {
            await savePromise;
        } finally {
            if (this.saveProgramPromise === savePromise) {
                this.saveProgramPromise = null;
            }
        }
    };

    private flushProgramSaveRequests = async (): Promise<void> => {
        while (this.saveProgramRequested) {
            this.saveProgramRequested = false;
            await this.saveCurrentProgram();
        }
    };

    private saveCurrentProgram = async (): Promise<void> => {
        this.programService.gap();
        const savedProgram = structuredClone(
            this.programService.getCurrentProgram()
        );
        const savingRevision =
            this.repository.ideViewModelRepository.programChangeRevision();
        const project = this.repository.projectViewModelRepository.project();
        if (
            !project &&
            !this.repository.userViewModelRepository.isAuthenticated()
        ) {
            this.repository.persistenceViewModelRepository.setLastProgram(
                savedProgram
            );
            return;
        }
        if (project) {
            this.repository.ideViewModelRepository.setSaveProjectRequestState(
                'loading'
            );
            const result = await this.rpi.saveProgramRequest(
                project.projectId,
                savedProgram
            );
            if (result.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
            }
            if (!result.isOk) {
                this.repository.ideViewModelRepository.setSaveProjectRequestState(
                    'error'
                );
                return;
            }
            this.repository.ideViewModelRepository.setSaveProjectRequestState(
                'ok'
            );
            this.repository.ideViewModelRepository.markProgramRevisionSaved(
                savingRevision
            );
        }
    };

    /**
     * Списки, запрошенные до этого момента, уже устарели: например, в них
     * есть только что удалённый проект или они пришли после истечения сессии
     */
    discardEarlierLists = () => {
        this.shownListRequestedAt = ++this.clock;
    };

    writeStarted = (key: string) => {
        this.pendingWrites.set(key, (this.pendingWrites.get(key) ?? 0) + 1);
    };

    writeSettled = (key: string) => {
        const left = (this.pendingWrites.get(key) ?? 1) - 1;
        if (left > 0) {
            this.pendingWrites.set(key, left);
        } else {
            this.pendingWrites.delete(key);
        }
        this.settledWrites.set(key, ++this.clock);
    };

    /**
     * Поле проекта, которое правят сейчас или поправили после того, как
     * ушёл запрос списка, берётся из показанного списка, а не из ответа
     */
    private keepLocalFields = (
        projects: ProjectShort[],
        requestedAt: number
    ): ProjectShort[] => {
        const local = new Map(
            this.repository.projectsViewModelRepository
                .projects()
                .map((project) => [project.projectId, project])
        );
        const fresh = (key: string) =>
            !this.pendingWrites.has(key) &&
            (this.settledWrites.get(key) ?? 0) < requestedAt;
        return projects.map((project) => {
            const own = local.get(project.projectId);
            if (!own) {
                return project;
            }
            const patch: Partial<ProjectShort> = {};
            if (!fresh(`${project.projectId}:tags`)) {
                patch.tags = own.tags;
            }
            if (!fresh(`${project.projectId}:public`)) {
                patch.isPublic = own.isPublic;
            }
            if (!fresh(`${project.projectId}:title`)) {
                patch.title = own.title;
            }
            return { ...project, ...patch };
        });
    };

    /**
     * Список проектов. silent не показывает загрузку и при ошибке оставляет
     * прежний список. Ответ, который пришёл позже ответа на более новый
     * запрос, отбрасывается
     */
    loadProjects = async ({ silent = false }: { silent?: boolean } = {}) => {
        const requestedAt = ++this.clock;
        const state = this.repository.ideViewModelRepository;
        if (!silent) {
            state.setGetProjectsRequestState('loading');
        }
        const result = await this.rpi.getAllProjectsRequest();
        if (requestedAt < this.shownListRequestedAt) {
            // список новее уже показан или прежние отброшены; но спиннер этой
            // загрузки должен закончиться, даже если новые шли без него
            if (!silent && state.getProjectsRequestState() === 'loading') {
                state.setGetProjectsRequestState(
                    result.isOk ? 'ok' : result.isUnauth ? 'unauth' : 'error'
                );
            }
            return result;
        }
        if (result.isOk) {
            this.shownListRequestedAt = requestedAt;
            this.repository.projectsViewModelRepository.setProjects(
                this.keepLocalFields(
                    [
                        ...(result.body as { projects: ProjectShort[] })
                            .projects,
                    ].reverse(),
                    requestedAt
                )
            );
            state.setGetProjectsRequestState('ok');
        } else if (result.isUnauth) {
            this.shownListRequestedAt = requestedAt;
            state.setGetProjectsRequestState('unauth');
        } else if (!silent) {
            state.setGetProjectsRequestState('error');
        }
        return result;
    };
}
