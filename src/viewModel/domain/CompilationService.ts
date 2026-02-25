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

    runCompilation = async () => {
        const projectId =
            this.repository.projectViewModelRepository.project()?.projectId;
        const program = this.programService.getCurrentProgram();

        if (!program) {
            return;
        }

        this.repository.settingsViewModelRepository.setIsCompiling(true);

        const runtimeMode = this.repository.projectViewModelRepository.mode();
        const storeMode =
            this.repository.persistenceViewModelRepository.projectCompileModes()[
                projectId || 'default'
            ];

        const mode = storeMode ?? runtimeMode;

        if (
            !this.repository.userViewModelRepository.isAuthenticated() &&
            mode === 'latex'
        ) {
            this.repository.authViewModelRepository.setCurrentView('login');
            return;
        }

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
            result = await this.rpi.compilationRequest(program);
        }

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
            if (
                projectId &&
                !this.repository.projectViewModelRepository.projectIsReadonly()
            ) {
                await this.loaderService.loadFiles(projectId);
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
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.internalError,
                'error'
            );
            this.observerService.onEvent(Events.EVENT_ERROR);
            this.observerService.onEvent(Events.FRONTEND_ERROR);
        }
    };
}
