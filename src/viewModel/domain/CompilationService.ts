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

export class CompilationService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    observerService: ObserverService;
    ideService: IdeService;

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

    private refreshProjectFiles = async (projectId: string) => {
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            return;
        }

        await this.loaderService.loadFiles(projectId);
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
        } else {
            this.observerService.onEvent(
                Events.EVENT_RPI_UNKNOWN_REFRESH_USER_INFO
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

        let result:
            | RequestResult<CompilationResponse>
            | RequestResult<PdfCompilationResponse>;
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

        this.repository.settingsViewModelRepository.setIsCompiling(false);

        if (result.code === 401 || result.code === 403) {
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
            }
            this.repository.projectViewModelRepository.setCompileErrorResult({
                errors: [],
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
            compileResult.errors.map((error) => {
                if (error.code === 308) {
                    this.repository.authViewModelRepository.setCurrentView(
                        'login'
                    );
                }
            });
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
            this.observerService.onEvent(Events.EVENT_PAYMENT_REQUIRED);
        } else if (mode === 'latex' && result.code === 423) {
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
            this.repository.authViewModelRepository.setCurrentView('login');
        } else {
            this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN_COMPILATION);
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.internalError,
                'error'
            );
            this.observerService.onEvent(Events.EVENT_ERROR);
            this.observerService.onEvent(Events.FRONTEND_ERROR);
        }
    };
}
