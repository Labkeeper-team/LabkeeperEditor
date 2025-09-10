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
        const savedProgram = this.programService.getCurrentProgram();
        const project = this.repository.projectViewModelRepository.project();
        if (project) {
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
                return;
            }
        }
    };

    loadProjects = async () => {
        this.repository.ideViewModelRepository.setGetProjectsRequestState(
            'loading'
        );
        const result = await this.rpi.getAllProjectsRequest();
        if (result.isOk) {
            this.repository.projectsViewModelRepository.setProjects(
                (result.body as { projects: ProjectShort[] }).projects.reverse()
            );
            this.repository.ideViewModelRepository.setGetProjectsRequestState(
                'ok'
            );
        } else if (result.isUnauth) {
            this.repository.ideViewModelRepository.setGetProjectsRequestState(
                'unauth'
            );
        } else {
            this.repository.ideViewModelRepository.setGetProjectsRequestState(
                'error'
            );
        }
    };
}
