import { ProjectShort } from '../../model/domain.ts';
import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { IdeService } from './IdeService.ts';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { ProjectListWrites } from './ProjectListWrites.ts';

export class LoaderService {
    rpi: Rpi;
    repository: ViewModelRepository;
    ideService: IdeService;
    programService: ProgramService;
    private saveProgramPromise: Promise<void> | null = null;
    /** Когда по часам правок ушёл запрос, чей список сейчас показан */
    private shownListRequestedAt = 0;
    private saveProgramRequested = false;

    constructor(
        rpi: Rpi,
        repository: ViewModelRepository,
        ideService: IdeService,
        programService: ProgramService,
        /** Правки полей проектов из списка: их поля ответ списка не трогает */
        private projectWrites: ProjectListWrites
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
     * О текущем отказе сессии уже сказали. Сбрасывается, как только список
     * снова загрузился: человек вошёл заново, и следующий отказ уже новый
     */
    private sessionReported = false;

    sessionWasReported = () =>
        this.sessionReported &&
        this.repository.ideViewModelRepository.getProjectsRequestState() ===
            'unauth';

    /**
     * Отказ сессии: true, если о нём ещё не говорили, и тогда это делает
     * вызвавший. Отказ, который сама загрузка списка получила молча, не в
     * счёт: о нём не сказали
     */
    claimSessionReport = () => {
        if (this.sessionWasReported()) {
            return false;
        }
        this.sessionReported = true;
        return true;
    };

    /**
     * Списки, запрошенные до этого момента, уже устарели: например, в них
     * есть только что удалённый проект или они пришли после истечения сессии
     */
    discardEarlierLists = () => {
        this.shownListRequestedAt = this.projectWrites.tick();
    };

    /**
     * Список проектов. silent не показывает загрузку и при ошибке оставляет
     * прежний список. Ответ, который пришёл позже ответа на более новый
     * запрос, отбрасывается
     */
    loadProjects = async ({ silent = false }: { silent?: boolean } = {}) => {
        const requestedAt = this.projectWrites.tick();
        const state = this.repository.ideViewModelRepository;
        if (!silent) {
            state.setGetProjectsRequestState('loading');
        }
        const result = await this.rpi.getAllProjectsRequest();
        if (result.isOk) {
            this.sessionReported = false;
        }
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
                this.projectWrites.keepLocalFields(
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
