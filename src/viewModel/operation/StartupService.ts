import { ViewModelRepository } from '../repository';
import { Routes } from '../routes.ts';
import {
    OpenParams,
    Program,
    Project,
    SegmentType,
    UserInfo,
} from '../../model/domain.ts';
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
import { HunkService } from './HunkService.ts';
import type { AgentChatService } from './AgentChatService.ts';
import type { ProjectPageService } from './ProjectPageService.ts';
import { logBreadcrumb } from '../utils/logBreadcrumb.ts';
import { reportToSentry } from '../utils/reportUnexpectedError.ts';
import { trackEvent } from '../utils/observerContext.ts';
import { AGENT_MODE_SUFFIX } from '../utils/agentModePath.ts';

const qrPagePattern = /\/qr\/v\d+/i;
const projectPagePattern = /\/project\/\S+/i;

/** Текст сегментов из query: compute, затем latex, затем markdown. Пустая строка сегмент не добавляет. */
export type StartupQuery = {
    compute?: string;
    latex?: string;
    markdown?: string;
};

export class StartupService {
    rpi: Rpi;
    programService: ProgramService;
    loader: LoaderService;
    repository: ViewModelRepository;
    observerService: ObserverService;
    ideService: IdeService;
    tokenPageService: TokenPageService;
    resetService: ResetService;
    private hunkService: HunkService | null = null;
    private agentChatService: AgentChatService | null = null;
    private projectPageService: ProjectPageService | null = null;

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

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    setAgentChatService = (agentChatService: AgentChatService) => {
        this.agentChatService = agentChatService;
    };

    setHunkService = (hunkService: HunkService) => {
        this.hunkService = hunkService;
    };

    setProjectPageService = (projectPageService: ProjectPageService) => {
        this.projectPageService = projectPageService;
    };

    onAppEnterWithOauthCode = async (code: string, state: string) => {
        const response = await this.rpi.oauthCodeRequest(code, state);

        if (!response.isOk) {
            this.track(Events.EVENT_LOGIN_FAILED, {
                method: 'oauth',
                reason: 'oauth_error',
            });
            this.repository.authViewModelRepository.setCurrentView('login');
            this.repository.authViewModelRepository.setLoginRequest(
                'oauth_error'
            );
        } else {
            this.track(Events.EVENT_LOGIN_SUCCEEDED, { method: 'oauth' });
        }

        await this.onAppStartup();
    };

    onQrPageEnter = (version: string) => {
        if (version === 'v1') {
            this.track(Events.EVENT_QR_V1);
        }
    };

    onAppStartup = async (
        captcha?: string,
        open?: OpenParams,
        query: StartupQuery = {}
    ): Promise<void> => {
        void open;
        logBreadcrumb('startup', 'onAppStartup', {
            location: this.repository.location(),
            hasCaptcha: Boolean(captcha),
            hasCompute: Boolean(query.compute),
            hasLatex: Boolean(query.latex),
            hasMarkdown: Boolean(query.markdown),
        });
        await this.loadBillingPricing();

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
        this.repository.settingsViewModelRepository.setShowPrivacyPolicyAcceptanceModal(
            userInfo.isAuthenticated && userInfo.privacyPolicyAccepted === false
        );
        await this.syncCrossBorderConsent(userInfo);

        this.observerService.setUserState(States.USER_ID, String(userInfo.id));
        this.observerService.setUserState(
            States.STATE_ONLINE,
            String(userInfo.isAuthenticated)
        );
        // аналитику не ждём: её сеть стояла ровно между «узнали пользователя» и открытием проекта
        void Promise.resolve(
            this.observerService.init(
                userInfo.isAuthenticated ? String(userInfo.id) : undefined
            )
        ).catch((error) => reportToSentry('startup.observerInit', error));
        this.repository.settingsViewModelRepository.setCaptchaBypassToken(
            captcha
        );

        const locationWithoutLastSlash = this.cutOfLastSlash(
            this.repository.location()
        );
        let compileQuery = false;
        // HOME PAGE ENTER
        if (
            locationWithoutLastSlash === Routes.Home ||
            qrPagePattern.test(locationWithoutLastSlash)
        ) {
            await this.openDefaultProject(userInfo, open, query);
            compileQuery = this.hasQueryText(query);
        }

        // OAUTH
        else if (locationWithoutLastSlash === Routes.CodePage) {
            const lastOpenedProjectUuid =
                this.repository.persistenceViewModelRepository.lastOpenedProjectUuid();
            this.repository.persistenceViewModelRepository.setLastOpenedProjectUuid(
                undefined
            );
            if (!lastOpenedProjectUuid) {
                await this.openDefaultProject(userInfo, open, query);
                compileQuery = this.hasQueryText(query);
            } else {
                await this.openProjectById(userInfo, lastOpenedProjectUuid);
            }
        }

        // PROJECT DEFAULT PAGE ENTER, в том числе в агентском режиме:
        // /project/default/agent это тот же проект по умолчанию, а не проект с id default
        else if (
            this.withoutAgentMode(locationWithoutLastSlash) ===
            Routes.ProjectDefault
        ) {
            await this.openDefaultProject(userInfo, open, query);
            compileQuery = this.hasQueryText(query);
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
                await this.openDefaultProject(userInfo, open, query);
                compileQuery = this.hasQueryText(query);
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
        if (compileQuery) {
            await this.projectPageService?.onRunButtonClicked('button');
        }
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
        this.track(Events.EVENT_EDITOR_OPENED_FROM_MARKETING, {
            source: 'marketing_header',
        });
        const userInfo: UserInfo = {
            email: this.repository.userViewModelRepository.email(),
            id: this.repository.userViewModelRepository.id(),
            isAuthenticated:
                this.repository.userViewModelRepository.isAuthenticated(),
            privacyPolicyAccepted: false,
            crossBorderDataTransferPolicyAccepted: false,
            tokenBalance:
                this.repository.userViewModelRepository.tokenBalance(),
        };
        await this.openDefaultProject(userInfo);
    };

    /**
     * Согласие на трансграничную передачу человек мог дать ещё гостем, тогда
     * оно осталось только в браузере. Досылаем его сразу после входа, иначе
     * плашка выскочит второй раз уже под своим аккаунтом
     */
    private syncCrossBorderConsent = async (userInfo: UserInfo) => {
        const acceptedLocally =
            this.repository.persistenceViewModelRepository.crossBorderConsentAcceptedLocally();
        if (
            !userInfo.isAuthenticated ||
            userInfo.crossBorderDataTransferPolicyAccepted ||
            !acceptedLocally
        ) {
            return;
        }
        await this.agentChatService?.sendCrossBorderConsent();
    };

    // несобранный проект открываем на агенте: у latex нет pdf, у остальных нет lastProgramResult
    private showAgentIfNeverCompiled = (project?: RichProject) => {
        const projectRepository = this.repository.projectViewModelRepository;
        // у чужого проекта чата нет
        if (projectRepository.projectIsReadonly()) {
            return;
        }
        const compiled =
            projectRepository.mode() === 'latex'
                ? Boolean(projectRepository.pdfUri())
                : project?.lastProgramResult != null;
        if (compiled) {
            return;
        }
        const settings = this.repository.settingsViewModelRepository;
        settings.setViewerTab('chat');
        // на телефоне агент это отдельный экран
        settings.setMobileView('chat');
    };

    // ждать файлов стоит только latex без pdf, иначе телефон успевает показать редактор и уводит с него
    private pdfMayComeWithFiles = (userInfo: UserInfo): boolean =>
        userInfo.isAuthenticated &&
        this.repository.projectViewModelRepository.mode() === 'latex' &&
        !this.repository.projectViewModelRepository.pdfUri();

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
        const path = this.withoutAgentMode(location);
        return path === Routes.Home || path === Routes.ProjectDefault;
    }

    private setEditorLocation(url: string): void {
        this.repository.setLocation(this.keepingAgentMode(url), {
            replace: this.isEditorLandingPath(this.repository.location()),
        });
    }

    /** Адрес страницы без хвоста агентского режима: проект тот же, меняется раскладка */
    private withoutAgentMode(location: string): string {
        const path = this.cutOfLastSlash(location);
        return path.endsWith(AGENT_MODE_SUFFIX)
            ? path.slice(0, -AGENT_MODE_SUFFIX.length)
            : path;
    }

    /**
     * Адрес под открытый проект с прежним режимом: иначе ссылка на агентский
     * режим сбрасывалась бы в обычный сразу после загрузки проекта
     */
    private keepingAgentMode(url: string): string {
        return this.cutOfLastSlash(this.repository.location()).endsWith(
            AGENT_MODE_SUFFIX
        )
            ? `${url}${AGENT_MODE_SUFFIX}`
            : url;
    }

    private extractProjectIdFromUrl(location: string): string {
        // Агентский режим живёт по /project/{id}/agent: без отбрасывания
        // суффикса за id принимается слово agent и проект не открывается
        const withoutMode = this.withoutAgentMode(location);
        return withoutMode.substring(
            withoutMode.lastIndexOf('/') + 1,
            withoutMode.length
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
                this.resetService.resetFileManagerProjectState();
                this.agentChatService?.onProjectChanged();
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
            // адрес нормализуем под открытый проект, но режим сохраняем
            this.repository.setLocation(
                this.keepingAgentMode(
                    Routes.Project.replace(':id', project.projectId)
                )
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
            const agentWaitsForFiles = this.pdfMayComeWithFiles(userInfo);
            if (!agentWaitsForFiles) {
                this.showAgentIfNeverCompiled(project);
            }
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
                if (
                    !this.repository.projectViewModelRepository.projectIsReadonly()
                ) {
                    await this.hunkService?.loadHunks();
                } else {
                    this.hunkService?.clearHunks();
                }
            } else {
                this.hunkService?.clearHunks();
            }
            if (agentWaitsForFiles) {
                this.showAgentIfNeverCompiled(project);
            }
            return;
        }
        if (!result.isOk) {
            this.repository.ideViewModelRepository.setGetProjectRequestState(
                'error'
            );
        }
    }

    private hasQueryText(query: StartupQuery): boolean {
        return Boolean(query.compute || query.latex || query.markdown);
    }

    /**
     * Дописывает сегменты из query в конец локальной программы.
     * Порядок: compute, latex, markdown. Пустой параметр сегмент не добавляет.
     * У вошедшего программа целиком уходит в запрос проекта по умолчанию,
     * у гостя сразу показывается в редакторе.
     */
    private programWithQuerySegments(query: StartupQuery): Program {
        const program = structuredClone(
            this.repository.persistenceViewModelRepository.lastProgram()
        );
        const additions: { type: SegmentType; text: string | undefined }[] = [
            { type: 'computational', text: query.compute },
            { type: 'latex', text: query.latex },
            { type: 'md', text: query.markdown },
        ];
        for (const addition of additions) {
            if (!addition.text) {
                continue;
            }
            program.segments.push({
                type: addition.type,
                text: addition.text,
                parameters: { visible: true },
            });
        }
        return program;
    }

    private focusLastSegment(): void {
        const count = this.programService.getCurrentProgram().segments.length;
        if (count > 0) {
            this.repository.ideViewModelRepository.setActiveSegmentIndex(
                count - 1
            );
        }
    }

    private async openDefaultProject(
        userInfo: UserInfo,
        open?: OpenParams,
        query: StartupQuery = {}
    ): Promise<void> {
        this.repository.projectViewModelRepository.setReadOnly(false);
        const program = this.hasQueryText(query)
            ? this.programWithQuerySegments(query)
            : this.repository.persistenceViewModelRepository.lastProgram();
        if (userInfo.isAuthenticated) {
            const result = await this.rpi.getDefaultProjectRequest(
                this.repository.persistenceViewModelRepository.language(),
                program,
                this.repository.projectViewModelRepository.mode()
            );
            if (result.isOk) {
                const project = result.body as RichProject;
                if (
                    this.repository.projectViewModelRepository.project()
                        ?.projectId !== project.projectId
                ) {
                    this.resetService.resetFileManagerProjectState();
                    this.agentChatService?.onProjectChanged();
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
                this.setEditorLocation(
                    Routes.Project.replace(':id', project.projectId)
                );
                // сегмент из ссылки должен быть на экране, а не под чатом агента
                if (this.hasQueryText(query)) {
                    this.focusLastSegment();
                } else {
                    // у проекта по умолчанию pdf из файлов не берётся, поэтому решаем до их загрузки
                    this.showAgentIfNeverCompiled(project);
                }
                if (userInfo.isAuthenticated) {
                    await this.loader.loadFiles(project.projectId);
                }
                if (
                    !this.repository.projectViewModelRepository.projectIsReadonly()
                ) {
                    await this.hunkService?.loadHunks();
                } else {
                    this.hunkService?.clearHunks();
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
            this.programService.setNewProgram(program);
            if (this.hasQueryText(query)) {
                this.focusLastSegment();
            } else {
                this.showAgentIfNeverCompiled();
            }
        }
        if (open === 'login' && !userInfo.isAuthenticated) {
            this.repository.authViewModelRepository.setCurrentView('login');
        }
    }
}
