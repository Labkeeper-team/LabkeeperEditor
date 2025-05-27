import { ProjectShort } from '../model/domain.ts';
import { ViewModelState } from './viewModelState';
import { Rpi } from '../model/rpi';

export class LoaderService {
    rpi: Rpi;
    vms: ViewModelState;

    constructor(rpi: Rpi, vms: ViewModelState) {
        this.rpi = rpi;
        this.vms = vms;
    }

    loadFiles = async (projectId: string) => {
        console.log('listFiles', projectId);
        const result = await this.rpi.listFilesRequest(projectId);

        if (result.isOk) {
            this.vms.projectViewModelState.setFiles(result.body.files);
        }
        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
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
            this.vms.resetToInitialState();
        }
    };
}
