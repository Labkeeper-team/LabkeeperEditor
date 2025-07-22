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
        const result = await this.rpi.listFilesRequest(projectId);

        if (result.isOk) {
            this.vms.projectViewModelState.setFiles(result.body.files);
        }
        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
        if (result.code === 413) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.tooBigFile.replace(
                    '${replace1}',
                    '10Mb'
                ),
                'error'
            );
        }
        if (result.code === 409) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.tooMuchFiles,
                'error'
            );
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
