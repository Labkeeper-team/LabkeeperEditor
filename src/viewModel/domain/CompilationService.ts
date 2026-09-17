import { ViewModelRepository } from '../repository';
import {
    CompilationResponse,
    RequestResult,
    Rpi,
    CompileSuccessPdfResponse,
    PdfCompilationResponse,
} from '../../model/rpi';
import {
    CompileError,
    CompileErrorResultList,
    CompileSuccessResult,
} from '../../model/domain.ts';
import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { LoaderService } from './LoaderService.ts';
import { IdeService } from './IdeService.ts';
import { HunkService } from '../operation/HunkService.ts';
import { logBreadcrumb } from '../utils/logBreadcrumb.ts';
import { trackEvent } from '../utils/observerContext.ts';

export class CompilationService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    observerService: ObserverService;
    ideService: IdeService;
    private hunkService: HunkService | null = null;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        observerService: ObserverService,
        ideService: IdeService
    ) {
        this.repository = repository;
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.observerService = observerService;
        this.ideService = ideService;
    }

    setHunkService = (hunkService: HunkService) => {
        this.hunkService = hunkService;
    };

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    private refreshProjectFiles = async (projectId: string) => {
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }

        await this.loaderService.loadFiles(projectId);
        if (!this.repository.projectViewModelRepository.projectIsReadonly()) {
            await this.hunkService?.loadHunks();
        }
    };

    private refreshUserInfo = async () => {
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }

        const result = await this.rpi.getUserInfoRequest();
        if (result.isOk) {
            this.repository.userViewModelRepository.setUserInfo(result.body);
            this.repository.settingsViewModelRepository.setShowPrivacyPolicyAcceptanceModal(
                result.body.isAuthenticated &&
                    result.body.privacyPolicyAccepted === false
            );
        }
    };

    runCompilation = async () => {
        const projectId =
            this.repository.projectViewModelRepository.project()?.projectId;
        const program = this.programService.getCurrentProgram();

        if (!program) {
            return;
        }

        this.repository.settingsViewModelRepository.setIsCompiling(true);

        const mode = this.repository.projectViewModelRepository.mode();
        logBreadcrumb('compile', `start ${mode}`, {
            mode,
            hasProject: Boolean(projectId),
        });

        let result:
            | RequestResult<CompilationResponse>
            | RequestResult<PdfCompilationResponse>;
        try {
            if (projectId) {
                if (mode === 'latex') {
                    result = await this.rpi.compileProjectPdfRequest(projectId);
                } else {
                    result = await this.rpi.compileProjectRequest(projectId);
                }
            } else {
                if (mode === 'latex') {
                    result = await this.rpi.pdfCompilationRequest(program);
                } else {
                    result = await this.rpi.compilationRequest(program);
                }
            }
            await this.refreshUserInfo();
        } catch (error) {
            this.repository.settingsViewModelRepository.setIsCompiling(false);
            this.repository.settingsViewModelRepository.setIsPdfRendering(
                false
            );
            throw error;
        }

        const unfinishedPdfUri =
            result.code === 203
                ? (result.body as CompileErrorResultList).unfinishedPdfUri
                : undefined;
        if (mode === 'latex' && (result.code === 200 || unfinishedPdfUri)) {
            this.repository.settingsViewModelRepository.setIsPdfRendering(true);
        } else if (mode === 'latex') {
            this.repository.settingsViewModelRepository.setIsPdfRendering(
                false
            );
        }
        this.repository.settingsViewModelRepository.setIsCompiling(false);
        logBreadcrumb('compile', `${mode} ${result.code}`, {
            mode,
            code: result.code,
            isOk: result.isOk,
        });

        if (result.code === 401 || result.code === 403) {
            this.track(Events.EVENT_COMPILE_FAILED, {
                mode,
                http_code: result.code,
                error_count: 0,
            });
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        } else if (result.code === 200) {
            if (mode === 'latex') {
                const body = result.body as CompileSuccessPdfResponse;
                this.repository.projectViewModelRepository.setPdfUri(
                    body.pdfUri
                );
                this.repository.ideViewModelRepository.setPdfUpdated(
                    this.repository.ideViewModelRepository.pdfUpdated() + 1
                );
            } else {
                this.repository.projectViewModelRepository.setCompileResult(
                    result.body as CompileSuccessResult
                );
                // Как и для PDF: сигнал UI переключить мобильный вид на результат
                this.repository.ideViewModelRepository.setPdfUpdated(
                    this.repository.ideViewModelRepository.pdfUpdated() + 1
                );
            }
            this.repository.projectViewModelRepository.setCompileErrorResult({
                errors: [],
            });
            this.track(Events.EVENT_COMPILE_SUCCEEDED, {
                mode,
                http_code: 200,
                error_count: 0,
            });
            if (projectId) {
                await this.refreshProjectFiles(projectId);
            }
        } else if (result.code === 203) {
            const compileResult = result.body as CompileErrorResultList;
            this.repository.projectViewModelRepository.setCompileErrorResult(
                compileResult
            );
            this.repository.settingsViewModelRepository.setExpandProblemViewer(
                true
            );
            this.track(Events.EVENT_COMPILE_FAILED, {
                mode,
                http_code: 203,
                error_count: compileResult.errors.length,
            });
            if (
                compileResult.errors.some(
                    (error) =>
                        error.code === CompileError.FILE_USAGE_NOT_ALLOWED
                )
            ) {
                this.track(Events.EVENT_AUTH_MODAL_OPENED, {
                    source: 'compile',
                });
                this.repository.authViewModelRepository.setCurrentView('login');
            }
            if (compileResult.unfinishedPdfUri) {
                this.repository.projectViewModelRepository.setPdfUri(
                    compileResult.unfinishedPdfUri
                );
                this.repository.ideViewModelRepository.setPdfUpdated(
                    this.repository.ideViewModelRepository.pdfUpdated() + 1
                );
            }
            if (projectId) {
                await this.refreshProjectFiles(projectId);
            }
        } else if (result.code === 402) {
            this.repository.toast(
                this.repository.dictionary.prompt_modal.errors.payment_required,
                'error'
            );
            this.track(Events.EVENT_PAYMENT_REQUIRED, { source: 'compile' });
        } else if (mode === 'latex' && result.code === 423) {
            this.track(Events.EVENT_COMPILE_FAILED, {
                mode,
                http_code: 423,
                error_count: 0,
            });
            this.repository.toast(
                this.repository.dictionary.synctex.errors.locked,
                'error'
            );
        } else if (result.code === 425) {
            this.repository.projectViewModelRepository.setCompileErrorResult({
                errors: [
                    {
                        payload: {
                            line: NaN,
                            position: NaN,
                            segmentId: 1,
                        },
                        code: CompileError.LOGIN_REQUIRED,
                    },
                ],
            });
            this.repository.settingsViewModelRepository.setExpandProblemViewer(
                true
            );
            this.track(Events.EVENT_COMPILE_FAILED, {
                mode,
                http_code: 425,
                error_count: 1,
            });
            this.track(Events.EVENT_AUTH_MODAL_OPENED, { source: 'compile' });
            this.repository.authViewModelRepository.setCurrentView('login');
        } else {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.internalError,
                'error'
            );
            this.track(Events.EVENT_COMPILE_FAILED, {
                mode,
                http_code: result.code,
                error_count: 0,
            });
            this.track(Events.EVENT_ERROR);
            this.track(Events.FRONTEND_ERROR, { source: 'compile' });
        }
    };
}
