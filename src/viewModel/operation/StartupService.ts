import { ViewModelRepository } from '../repository';
import { Routes } from '../routes.ts';
import { Project, UserInfo } from '../../model/domain.ts';
import { RequestResult, RichProject, Rpi } from '../../model/rpi';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import {
    Events,
    ObserverService,
    States,
} from '../../model/service/ObserverService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { ExampleService } from '../domain/ExampleService.ts';

const qrPagePattern = /\/qr\/v\d+/i;
const projectPagePattern = /\/project\/\S+/i;

export class StartupService {
    rpi: Rpi;
    programService: ProgramService;
    loader: LoaderService;
    repository: ViewModelRepository;
    observerService: ObserverService;
    ideService: IdeService;
    exampleService: ExampleService;

    constructor(
        rpi: Rpi,
        programService: ProgramService,
        loader: LoaderService,
        repository: ViewModelRepository,
        observerService: ObserverService,
        ideService: IdeService,
        exampleService: ExampleService
    ) {
        this.observerService = observerService;
        this.rpi = rpi;
        this.programService = programService;
        this.loader = loader;
        this.repository = repository;
        this.ideService = ideService;
        this.exampleService = exampleService;
    }

    onAppEnterWithOauthCode = async (code: string, state: string) => {
        const response = await this.rpi.oauthCodeRequest(code, state);

        if (!response.isOk) {
            this.repository.authViewModelRepository.setCurrentView('login');
            this.repository.authViewModelRepository.setLoginRequest(
                'oauth_error'
            );
        }

        await this.onAppStartup();
    };

    onQrPageEnter = (version: string) => {
        if (version === 'v1') {
            this.observerService.onEvent(Events.EVENT_QR_V1);
        }
    };

    onAppStartup = async (from?: string): Promise<void> => {
        const result: RequestResult<UserInfo> =
            await this.rpi.getUserInfoRequest();

        if (!result.isOk) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.noNetwork,
                'error'
            );
            this.repository.setLocation(Routes.Home);
            return;
        }

        const userInfo = result.body;
        this.repository.userViewModelRepository.setUserInfo(userInfo);

        this.observerService.setUserState(States.USER_ID, String(userInfo.id));
        this.observerService.setUserState(
            States.STATE_ONLINE,
            String(userInfo.isAuthenticated)
        );

        const locationWithoutLastSlash = this.cutOfLastSlash(
            this.repository.location()
        );
        const version = qrPagePattern.test(locationWithoutLastSlash)
            ? locationWithoutLastSlash.split('/').pop()
            : undefined;
        // HOME PAGE ENTER
        if (
            locationWithoutLastSlash === Routes.Home ||
            qrPagePattern.test(locationWithoutLastSlash)
        ) {
            await this.openDefaultProject(userInfo, version, from);
        }

        // OAUTH
        else if (locationWithoutLastSlash === Routes.CodePage) {
            const lastOpenedProjectUuid =
                this.repository.persistenceViewModelRepository.lastOpenedProjectUuid();
            this.repository.persistenceViewModelRepository.setLastOpenedProjectUuid(
                undefined
            );
            if (!lastOpenedProjectUuid) {
                await this.openDefaultProject(userInfo, version, from);
            } else {
                await this.openProjectById(userInfo, lastOpenedProjectUuid);
            }
        }

        // PROJECT DEFAULT PAGE ENTER
        else if (locationWithoutLastSlash === Routes.ProjectDefault) {
            await this.openDefaultProject(userInfo, version, from);
        }

        // PROJECTS PAGE ENTER
        else if (locationWithoutLastSlash === Routes.Projects) {
            if (!userInfo.isAuthenticated) {
                await this.openDefaultProject(userInfo, version, from);
            }
        }

        // PROJECT BY ID PAGE ENTER
        else if (projectPagePattern.test(locationWithoutLastSlash)) {
            const id = this.extractProjectIdFromUrl(this.repository.location());
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
        this.repository.ideViewModelRepository.setGetProjectRequestState(
            'loading'
        );
        const result = await this.rpi.getProjectRequest(id);
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            return;
        }
        if (result.isForbidden) {
            this.repository.ideViewModelRepository.setGetProjectRequestState(
                'forbidden'
            );
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.notEnoughRights,
                'error'
            );
            this.repository.projectViewModelRepository.setReadOnly(true);
            return;
        }
        if (result.code === 404) {
            this.repository.ideViewModelRepository.setGetProjectRequestState(
                'not_found'
            );
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.notFound,
                'error'
            );
            this.repository.projectViewModelRepository.setReadOnly(true);
            return;
        }
        if (result.isOk) {
            const project = result.body as RichProject;
            if (
                this.repository.projectViewModelRepository.project()
                    ?.projectId !== project.projectId
            ) {
                this.repository.projectViewModelRepository.setPdfUri(undefined);
                this.repository.ideViewModelRepository.setPdfUpdated(0);
            }
            this.repository.projectViewModelRepository.setProject(project);
            this.repository.projectViewModelRepository.setReadOnly(
                userInfo.id !== (result.body as Project).userId
            );
            this.ideService.setNewProgram(
                project.program,
                project.lastProgramResult
            );
            this.repository.setLocation(
                Routes.Project.replace(':id', project.projectId)
            );
            this.observerService.setUserState(
                States.STATE_PROJECT,
                project.projectId
            );
            this.repository.ideViewModelRepository.setGetProjectRequestState(
                'ok'
            );
            if (userInfo.isAuthenticated) {
                await this.loader.loadFiles(project.projectId);
                const pdfFile = this.repository.projectViewModelRepository
                    .files()
                    .find((file) => file.fileName.endsWith('.pdf'));
                if (pdfFile) {
                    this.repository.projectViewModelRepository.setPdfUri(
                        pdfFile.url
                    );
                }
            }
            return;
        }
        if (!result.isOk) {
            this.repository.ideViewModelRepository.setGetProjectRequestState(
                'error'
            );
        }
    }

    private async openDefaultProject(
        userInfo: UserInfo,
        version: string | undefined,
        from: string | undefined
    ): Promise<void> {
        this.repository.projectViewModelRepository.setReadOnly(false);
        if (userInfo.isAuthenticated) {
            const result = await this.rpi.getDefaultProjectRequest(
                this.repository.persistenceViewModelRepository.language(),
                this.repository.persistenceViewModelRepository.lastProgram()
            );
            if (result.isOk) {
                const project = result.body as RichProject;
                this.repository.projectViewModelRepository.setProject(project);
                this.ideService.setNewProgram(
                    project.program,
                    project.lastProgramResult
                );
                this.repository.projectViewModelRepository.setCompileResult({
                    segments: [],
                });
                this.repository.projectViewModelRepository.setCompileErrorResult(
                    {
                        errors: [],
                    }
                );
                this.repository.setLocation(
                    Routes.Project.replace(':id', project.projectId)
                );
                if (userInfo.isAuthenticated) {
                    await this.loader.loadFiles(project.projectId);
                }
            }
            if (result.isUnauth) {
                this.repository.setLocation(Routes.ProjectDefault);
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
            }
        } else {
            this.repository.setLocation(Routes.ProjectDefault);
            // on default uri but unauth
            const language =
                this.repository.persistenceViewModelRepository.language();
            if (version) {
                const result = await this.exampleService.exampleForQR(
                    version,
                    language
                );
                if (result) {
                    this.ideService.setNewProgram(
                        result.program,
                        result.result
                    );
                }
            } else if (from) {
                const result = await this.exampleService.exampleForFrom(
                    from,
                    language
                );
                if (result) {
                    this.ideService.setNewProgram(
                        result.program,
                        result.result
                    );
                }
            } else {
                this.programService.setNewProgram(
                    this.repository.persistenceViewModelRepository.lastProgram()
                );
                /* закоменчено, так как не выбрали какой пример показывать на странице labkeeper.io
                const [program, result] =
                    this.exampleService.exampleForUnauthorize();
                this.ideService.setNewProgram(program, result);*/
            }
        }
    }
}
