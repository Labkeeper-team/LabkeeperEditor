import { ProjectShort } from '../../model/domain.ts';
import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { IdeService } from './IdeService.ts';

export class LoaderService {
    rpi: Rpi;
    repository: ViewModelRepository;
    ideService: IdeService;

    constructor(
        rpi: Rpi,
        repository: ViewModelRepository,
        ideService: IdeService
    ) {
        this.rpi = rpi;
        this.repository = repository;
        this.ideService = ideService;
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
