import { ProjectShort } from '../model/domain.ts';
import { ViewModelState } from './viewModelState';
import { Rpi } from '../model/rpi';
import { IdeService } from './ide.ts';

export class LoaderService {
    rpi: Rpi;
    vms: ViewModelState;
    ideService: IdeService;

    constructor(rpi: Rpi, vms: ViewModelState, ideService: IdeService) {
        this.rpi = rpi;
        this.vms = vms;
        this.ideService = ideService;
    }

    loadFiles = async (projectId: string) => {
        this.vms.ideViewModelState.setGetFilesRequestState('loading');
        const result = await this.rpi.listFilesRequest(projectId);

        if (result.isOk) {
            this.vms.projectViewModelState.setFiles(result.body.files);
            this.vms.ideViewModelState.setGetFilesRequestState('ok');
        } else if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        } else if (result.isForbidden) {
            this.vms.ideViewModelState.setGetFilesRequestState('forbidden');
        } else {
            this.vms.ideViewModelState.setGetFilesRequestState('error');
        }
    };

    loadProjects = async () => {
        const result = await this.rpi.getAllProjectsRequest();
        if (result.isOk) {
            this.vms.projectsViewModelState.setProjects(
                (result.body as { projects: ProjectShort[] }).projects.reverse()
            );
        }
        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
    };
}
