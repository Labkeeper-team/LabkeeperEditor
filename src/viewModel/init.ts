import { ViewModelState } from './viewModelState';
import { Routes } from '../view/routing/routes.ts';
import { Project } from '../model/domain.ts';
import { RequestResult, Rpi } from '../model/rpi';
import { UserInfo } from './store/slices/user';
import { ProgramService } from '../model/service/program.ts';
import { LoaderService } from './project.ts';
import { observerService } from '../main.tsx';
import { States } from '../model/service/observer.ts';

export class StartupService {
    rpi: Rpi;
    programService: ProgramService;
    loader: LoaderService;
    vms: ViewModelState;

    constructor(
        rpi: Rpi,
        programService: ProgramService,
        loader: LoaderService,
        vms: ViewModelState
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loader = loader;
        this.vms = vms;
    }

    onAppStartup = async (): Promise<void> => {
        const result: RequestResult<UserInfo> =
            await this.rpi.getUserInfoRequest();

        if (!result.isOk) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.noNetwork,
                'error'
            );
            this.vms.navigate(Routes.Home);
            return;
        }

        const userInfo = result.body;
        this.vms.userViewModelState.setUserInfo(userInfo);

        observerService.setUserState(States.STATE_EMAIL, userInfo.email);

        const locationWithoutLastSlash = this.cutOfLastSlash(
            this.vms.location()
        );

        // HOME PAGE ENTER
        if (locationWithoutLastSlash === Routes.Home) {
            await this.openDefaultProject(userInfo);
        }

        // PROJECT DEFAULT PAGE ENTER
        else if (locationWithoutLastSlash === Routes.ProjectDefault) {
            await this.openDefaultProject(userInfo);
        }

        // PROJECTS PAGE ENTER
        else if (locationWithoutLastSlash === Routes.Projects) {
            if (!userInfo.isAuthenticated) {
                await this.openDefaultProject(userInfo);
            }
        }

        // PROJECT BY ID PAGE ENTER
        else if (
            locationWithoutLastSlash.includes(Routes.Project.replace(':id', ''))
        ) {
            const id = this.extractProjectIdFromUrl(this.vms.location());
            await this.openProjectById(userInfo, id);
        }

        if (userInfo.isAuthenticated) {
            await this.loader.loadProjects();
        }
    };

    private cutOfLastSlash(location: string): string {
        if (location === '/' || location === '') {
            return '/';
        }
        return location.charAt(location.length - 1) === '/'
            ? location.substring(0, location.length - 1)
            : location;
    }

    private extractProjectIdFromUrl(location: string): string {
        const withoutLastSlash = this.cutOfLastSlash(location);
        return withoutLastSlash.substring(
            withoutLastSlash.lastIndexOf('/') + 1,
            withoutLastSlash.length
        );
    }

    async openProjectById(userInfo: UserInfo, id: string): Promise<void> {
        const result = await this.rpi.getProjectRequest(id);
        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
        }
        if (result.isForbidden) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.notEnoughRights,
                'error'
            );
            this.vms.projectViewModelState.setReadOnly(true);
        }
        if (result.code === 404) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.notFound,
                'error'
            );
            this.vms.projectViewModelState.setReadOnly(true);
        }
        if (result.isOk) {
            const project = result.body as Project;
            this.vms.projectViewModelState.setProject(project);
            this.vms.projectViewModelState.setReadOnly(
                userInfo.id !== (result.body as Project).userId
            );
            this.programService.setNewProgram(project.program);
        }
    }

    private async openDefaultProject(userInfo: UserInfo): Promise<void> {
        this.vms.projectViewModelState.setReadOnly(false);
        if (userInfo.isAuthenticated) {
            const result = await this.rpi.getDefaultProjectRequest(
                this.vms.persistenceViewModelState.language(),
                this.vms.persistenceViewModelState.lastProgram()
            );
            if (result.isOk) {
                const project = result.body as Project;
                this.vms.projectViewModelState.setProject(project);
                this.programService.setNewProgram(project.program);
                this.vms.projectViewModelState.setCompileResult({
                    segments: [],
                });
                this.vms.projectViewModelState.setCompileErrorResult({
                    errors: [],
                });
                this.vms.navigate(
                    Routes.Project.replace(':id', project.projectId + '')
                );
            }
            if (result.isUnauth) {
                this.vms.navigate(Routes.ProjectDefault);
                this.vms.toast(
                    this.vms.dictionary.filemanager.errors.sessionExpired,
                    'error'
                );
                this.vms.resetToInitialState();
            }
        } else {
            this.vms.navigate(Routes.ProjectDefault);
            // on default uri but unauth
            this.programService.setNewProgram(
                this.vms.persistenceViewModelState.lastProgram()
            );
        }
    }
}
