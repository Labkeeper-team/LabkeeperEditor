import { ViewModelState } from './viewModelState';
import { Routes } from '../view/routing/routes.ts';
import { Project } from '../model/domain.ts';
import { RequestResult, RichProject, Rpi } from '../model/rpi';
import { UserInfo } from './store/slices/user';
import { ProgramService } from '../model/service/program.ts';
import { LoaderService } from './project.ts';
import { ObserverService, States } from '../model/service/observer.ts';
import { IdeService } from './ide.ts';
import { ExampleService } from './example.ts';

const qrPagePattern = /\/qr\/v\d+/i;
const projectPagePattern = /\/project\/\S+/i;

export class StartupService {
    rpi: Rpi;
    programService: ProgramService;
    loader: LoaderService;
    vms: ViewModelState;
    observerService: ObserverService;
    ideService: IdeService;
    exampleService: ExampleService;

    constructor(
        rpi: Rpi,
        programService: ProgramService,
        loader: LoaderService,
        vms: ViewModelState,
        observerService: ObserverService,
        ideService: IdeService,
        exampleService: ExampleService
    ) {
        this.observerService = observerService;
        this.rpi = rpi;
        this.programService = programService;
        this.loader = loader;
        this.vms = vms;
        this.ideService = ideService;
        this.exampleService = exampleService;
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

        this.observerService.setUserState(States.STATE_EMAIL, userInfo.email);

        const locationWithoutLastSlash = this.cutOfLastSlash(
            this.vms.location()
        );
        const version = qrPagePattern.test(locationWithoutLastSlash)
            ? locationWithoutLastSlash.split('/').pop()
            : undefined;
        // HOME PAGE ENTER
        if (
            locationWithoutLastSlash === Routes.Home ||
            locationWithoutLastSlash === Routes.CodePage ||
            qrPagePattern.test(locationWithoutLastSlash)
        ) {
            await this.openDefaultProject(userInfo, version);
        }

        // PROJECT DEFAULT PAGE ENTER
        else if (locationWithoutLastSlash === Routes.ProjectDefault) {
            await this.openDefaultProject(userInfo, version);
        }

        // PROJECTS PAGE ENTER
        else if (locationWithoutLastSlash === Routes.Projects) {
            if (!userInfo.isAuthenticated) {
                await this.openDefaultProject(userInfo, version);
            }
        }

        // PROJECT BY ID PAGE ENTER
        else if (projectPagePattern.test(locationWithoutLastSlash)) {
            const id = this.extractProjectIdFromUrl(this.vms.location());
            await this.openProjectById(userInfo, id);
        }

        if (userInfo.isAuthenticated) {
            await this.loader.loadProjects();
        }

        this.ideService.onProgramUpdated();
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
            this.ideService.resetEditor();
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
            const project = result.body as RichProject;
            this.vms.projectViewModelState.setProject(project);
            this.vms.projectViewModelState.setReadOnly(
                userInfo.id !== (result.body as Project).userId
            );
            this.ideService.setNewProgram(
                project.program,
                project.lastProgramResult
            );
        }
    }

    private async openDefaultProject(
        userInfo: UserInfo,
        version: string | undefined
    ): Promise<void> {
        this.vms.projectViewModelState.setReadOnly(false);
        if (userInfo.isAuthenticated) {
            const result = await this.rpi.getDefaultProjectRequest(
                this.vms.persistenceViewModelState.language(),
                this.vms.persistenceViewModelState.lastProgram()
            );
            if (result.isOk) {
                const project = result.body as RichProject;
                this.vms.projectViewModelState.setProject(project);
                this.ideService.setNewProgram(
                    project.program,
                    project.lastProgramResult
                );
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
                this.ideService.resetEditor();
            }
        } else {
            this.vms.navigate(Routes.ProjectDefault);
            // on default uri but unauth
            if (
                this.vms.persistenceViewModelState.lastProgram() &&
                this.vms.persistenceViewModelState.lastProgram().segments
                    ?.length > 0
            ) {
                this.programService.setNewProgram(
                    this.vms.persistenceViewModelState.lastProgram()
                );
            } else {
                const language = this.vms.persistenceViewModelState.language();
                if (version) {
                    const [program, result] = this.exampleService.exampleForQR(
                        version,
                        language
                    );
                    this.ideService.setNewProgram(program, result);
                } else {
                    this.programService.setNewProgram(
                        this.vms.persistenceViewModelState.lastProgram()
                    );
                    /* закоменчено, так как не выбрали какой пример показывать на странице labkeeper.io
                    const [program, result] =
                        this.exampleService.exampleForUnauthorize();
                    this.ideService.setNewProgram(program, result);*/
                }
            }
        }
    }
}
