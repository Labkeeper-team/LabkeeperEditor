import { ViewModelRepository } from '../repository';
import { Routes } from '../routes.ts';
import { OpenParams, Project, UserInfo } from '../../model/domain.ts';
import { RequestResult, RichProject, Rpi } from '../../model/rpi';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import {
    Events,
    ObserverService,
    States,
} from '../../model/service/ObserverService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { TokenPageService } from './TokenPageService.ts';
import { ResetService } from '../domain/ResetService.ts';
import { markNextProjectRouteAsPreloaded } from './projectRouteNavigation.ts';

const qrPagePattern = /\/qr\/v\d+/i;
const projectPagePattern = /\/project\/\S+/i;

export class StartupService {
    rpi: Rpi;
    programService: ProgramService;
    loader: LoaderService;
    repository: ViewModelRepository;
    observerService: ObserverService;
    ideService: IdeService;
    tokenPageService: TokenPageService;
    resetService: ResetService;
    private projectLoadRequestId = 0;

    constructor(
        rpi: Rpi,
        programService: ProgramService,
        loader: LoaderService,
        repository: ViewModelRepository,
        observerService: ObserverService,
        ideService: IdeService,
        tokenPageService: TokenPageService,
        resetService: ResetService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loader = loader;
        this.repository = repository;
        this.ideService = ideService;
        this.observerService = observerService;
        this.tokenPageService = tokenPageService;
        this.resetService = resetService;
    }

    onAppEnterWithOauthCode = async (code: string, state: string) => {
        const response = await this.rpi.oauthCodeRequest(code, state);

        if (!response.isOk) {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_STARTUP_OAUTH_CODE
            );
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

    onAppStartup = async (
        captcha?: string,
        open?: OpenParams
    ): Promise<void> => {
        void open;
        await this.loadBillingPricing();

        const result: RequestResult<UserInfo> =
            await this.rpi.getUserInfoRequest();

        if (!result.isOk) {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_STARTUP_GET_USER_INFO
            );
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.noNetwork,
                'error'
            );
            this.repository.setLocation(Routes.Home);
            return;
        }

        const userInfo = result.body;
        this.repository.userViewModelRepository.setUserInfo(userInfo);
        this.repository.settingsViewModelRepository.setShowPrivacyPolicyAcceptanceModal(
            userInfo.isAuthenticated && userInfo.privacyPolicyAccepted === false
        );

        this.observerService.setUserState(States.USER_ID, String(userInfo.id));
        this.observerService.setUserState(
            States.STATE_ONLINE,
            String(userInfo.isAuthenticated)
        );
        this.repository.settingsViewModelRepository.setCaptchaBypassToken(
            captcha
        );

        const locationWithoutLastSlash = this.cutOfLastSlash(
            this.repository.location()
        );
        // HOME PAGE ENTER
        if (
            locationWithoutLastSlash === Routes.Home ||
            qrPagePattern.test(locationWithoutLastSlash)
        ) {
            await this.openDefaultProject(userInfo, open);
        }

        // OAUTH
        else if (locationWithoutLastSlash === Routes.CodePage) {
            const lastOpenedProjectUuid =
                this.repository.persistenceViewModelRepository.lastOpenedProjectUuid();
            this.repository.persistenceViewModelRepository.setLastOpenedProjectUuid(
                undefined
            );
            if (!lastOpenedProjectUuid) {
                await this.openDefaultProject(userInfo, open);
            } else {
                this.repository.setLocation(
                    Routes.Project.replace(':id', lastOpenedProjectUuid),
                    { replace: true }
                );
            }
        }

        // PROJECT DEFAULT PAGE ENTER
        else if (locationWithoutLastSlash === Routes.ProjectDefault) {
            await this.openDefaultProject(userInfo, open);
        }

        // PAY PAGE ENTER
        else if (locationWithoutLastSlash === Routes.Pay) {
            if (
                !this.repository.billingViewModelRepository.paymentWidgetToken()
            ) {
                if (!userInfo.isAuthenticated) {
                    this.repository.setLocation(Routes.Tokens);
                } else {
                    const restored =
                        await this.tokenPageService.restorePendingPurchaseForPayPage();
                    if (!restored) {
                        this.repository.setLocation(Routes.Tokens);
                    }
                }
            }
        }

        // PROJECTS PAGE ENTER
        else if (locationWithoutLastSlash === Routes.Projects) {
            if (!userInfo.isAuthenticated) {
                await this.openDefaultProject(userInfo, open);
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

    private loadBillingPricing = async (): Promise<void> => {
        this.repository.billingViewModelRepository.setPricingRequestState(
            'loading'
        );

        const result = await this.rpi.getBillingPricingRequest();
        if (result.isOk) {
            this.repository.billingViewModelRepository.setPricing(result.body);
            this.repository.billingViewModelRepository.setPricingRequestState(
                'ok'
            );
            return;
        }

        this.observerService.onEvent(
            Events.EVENT_RPI_UNKNOWN_STARTUP_GET_BILLING_PRICING
        );
        this.repository.billingViewModelRepository.setPricingRequestState(
            'error'
        );
    };

    /**
     * After the first {@link onAppStartup}, in-app navigation (e.g. from /tokens) does not run
     * startup again, so `/project/default` never resolves to `/project/:id` for signed-in users.
     * Call this instead of `navigate(Routes.ProjectDefault)` from the SPA.
     */
    openEditorAfterSpaNavigation = async (): Promise<void> => {
        await this.openDefaultProject(this.currentUserInfo());
    };

    openProjectAfterRouteNavigation = async (
        projectId: string
    ): Promise<void> => {
        await this.openProjectById(this.currentUserInfo(), projectId);
    };

    private currentUserInfo(): UserInfo {
        return {
            email: this.repository.userViewModelRepository.email(),
            id: this.repository.userViewModelRepository.id(),
            isAuthenticated:
                this.repository.userViewModelRepository.isAuthenticated(),
            privacyPolicyAccepted: false,
            tokenBalance:
                this.repository.userViewModelRepository.tokenBalance(),
        };
    }

    private cutOfLastSlash(location: string): string {
        if (location === '/' || location === '') {
            return '/';
        }
        return location.charAt(location.length - 1) === '/'
            ? location.substring(0, location.length - 1)
            : location;
    }

    /**
     * `/` and `/project/default` (including `?open=latex`) are landing URLs.
     * Replace them in history so Back skips the extra editor entry.
     */
    private isEditorLandingPath(location: string): boolean {
        const path = this.cutOfLastSlash(location);
        return path === Routes.Home || path === Routes.ProjectDefault;
    }

    private setEditorLocation(url: string): void {
        this.repository.setLocation(url, {
            replace: this.isEditorLandingPath(this.repository.location()),
        });
    }

    private extractProjectIdFromUrl(location: string): string {
        const withoutLastSlash = this.cutOfLastSlash(location);
        return withoutLastSlash.substring(
            withoutLastSlash.lastIndexOf('/') + 1,
            withoutLastSlash.length
        );
    }

    private isCurrentProjectLoad(requestId: number, projectId: string) {
        return (
            requestId === this.projectLoadRequestId &&
            this.cutOfLastSlash(this.repository.location()) ===
                Routes.Project.replace(':id', projectId)
        );
    }

    async openProjectById(userInfo: UserInfo, id: string): Promise<void> {
        const requestId = ++this.projectLoadRequestId;
        this.repository.ideViewModelRepository.setGetProjectRequestState(
            'loading'
        );
        const result = await this.rpi.getProjectRequest(id);
        if (!this.isCurrentProjectLoad(requestId, id)) {
            return;
        }
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
                this.resetService.resetFileManagerProjectState();
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
            this.repository.projectViewModelRepository.setProjectType(
                project.projectType
            );
            this.observerService.setUserState(
                States.STATE_PROJECT,
                project.projectId
            );
            this.repository.projectViewModelRepository.setPdfUri(
                project.lastPdf
            );
            this.repository.ideViewModelRepository.setGetProjectRequestState(
                'ok'
            );
            if (userInfo.isAuthenticated) {
                await this.loader.loadFiles(project.projectId, () =>
                    this.isCurrentProjectLoad(requestId, id)
                );
                if (!this.isCurrentProjectLoad(requestId, id)) {
                    return;
                }
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
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_STARTUP_GET_PROJECT
            );
            this.repository.ideViewModelRepository.setGetProjectRequestState(
                'error'
            );
        }
    }

    private async openDefaultProject(
        userInfo: UserInfo,
        open?: OpenParams
    ): Promise<void> {
        const requestId = ++this.projectLoadRequestId;
        const sourceLocation = this.cutOfLastSlash(this.repository.location());
        this.repository.projectViewModelRepository.setReadOnly(false);
        if (userInfo.isAuthenticated) {
            const result = await this.rpi.getDefaultProjectRequest(
                this.repository.persistenceViewModelRepository.language(),
                this.repository.persistenceViewModelRepository.lastProgram(),
                this.repository.projectViewModelRepository.mode()
            );
            if (
                requestId !== this.projectLoadRequestId ||
                this.cutOfLastSlash(this.repository.location()) !==
                    sourceLocation
            ) {
                return;
            }
            if (result.isOk) {
                const project = result.body as RichProject;
                if (
                    this.repository.projectViewModelRepository.project()
                        ?.projectId !== project.projectId
                ) {
                    this.resetService.resetFileManagerProjectState();
                }
                this.repository.projectViewModelRepository.setProject(project);
                this.repository.projectViewModelRepository.setProjectType(
                    project.projectType
                );
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
                const projectPath = Routes.Project.replace(
                    ':id',
                    project.projectId
                );
                markNextProjectRouteAsPreloaded(projectPath);
                this.setEditorLocation(projectPath);
                if (userInfo.isAuthenticated) {
                    await this.loader.loadFiles(project.projectId, () =>
                        this.isCurrentProjectLoad(requestId, project.projectId)
                    );
                    if (
                        !this.isCurrentProjectLoad(requestId, project.projectId)
                    ) {
                        if (
                            requestId === this.projectLoadRequestId &&
                            this.repository.projectViewModelRepository.project()
                                ?.projectId === project.projectId
                        ) {
                            this.resetService.resetProject();
                        }
                        return;
                    }
                }
            }
            if (result.isUnauth) {
                this.setEditorLocation(Routes.ProjectDefault);
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
            } else if (!result.isOk) {
                this.observerService.onEvent(
                    Events.EVENT_RPI_UNKNOWN_STARTUP_GET_DEFAULT_PROJECT
                );
            }
        } else {
            if (open === 'latex') {
                this.repository.projectViewModelRepository.setProjectType(
                    'latex'
                );
            }
            if (open === 'markdown') {
                this.repository.projectViewModelRepository.setProjectType(
                    'markdown'
                );
            }
            this.setEditorLocation(Routes.ProjectDefault);
            this.programService.setNewProgram(
                this.repository.persistenceViewModelRepository.lastProgram()
            );
        }
        if (open === 'ai') {
            this.repository.settingsViewModelRepository.setShowProjectPromptModal(
                true
            );
        }
        if (open === 'login' && !userInfo.isAuthenticated) {
            this.repository.authViewModelRepository.setCurrentView('login');
        }
    }
}
