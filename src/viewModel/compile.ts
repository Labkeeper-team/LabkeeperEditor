import { ViewModelState } from './viewModelState';
import { CompilationResponse, RequestResult, Rpi } from '../model/rpi';
import {
    CompileError,
    CompileErrorResultList,
    CompileSuccessResult,
} from '../model/domain.ts';
import { Events, ObserverService } from '../model/service/observer.ts';
import { ProgramService } from '../model/service/program.ts';
import { LoaderService } from './project.ts';

export class CompilationService {
    vms: ViewModelState;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    observerService: ObserverService;

    constructor(
        vms: ViewModelState,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        observerService: ObserverService
    ) {
        this.vms = vms;
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.observerService = observerService;
    }

    runCompilation = async () => {
        const projectId = this.vms.projectViewModelState.project()?.projectId;
        const program = this.programService.getCurrentProgram();

        if (!program) {
            return;
        }

        this.vms.settingsViewModelState.setIsCompiling(true);

        let result: RequestResult<CompilationResponse>;
        if (projectId) {
            result = await this.rpi.compileProjectRequest(projectId);
        } else {
            result = await this.rpi.compilationRequest(program);
        }

        this.vms.settingsViewModelState.setIsCompiling(false);

        if (result.code >= 500) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.internalError,
                'error'
            );
            this.vms.resetToInitialState();
        }
        if (result.code === 401 || result.code === 403) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
        }
        if (result.code === 200) {
            this.vms.projectViewModelState.setCompileResult(
                result.body as CompileSuccessResult
            );
            this.vms.projectViewModelState.setCompileErrorResult({
                errors: [],
            });
            if (
                projectId &&
                !this.vms.projectViewModelState.projectIsReadonly()
            ) {
                await this.loaderService.loadFiles(projectId);
            }
        }
        if (result.code === 203) {
            const compileResult = result.body as CompileErrorResultList;
            this.vms.projectViewModelState.setCompileErrorResult(compileResult);
            this.vms.settingsViewModelState.setExpandProblemViewer(true);
            compileResult.errors.map((error) => {
                if (error.code === 308) {
                    this.vms.authViewModelState.setShowAuthModal(true);
                }
            });
        }
        if (result.code === 425) {
            this.vms.projectViewModelState.setCompileErrorResult({
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
            this.vms.settingsViewModelState.setExpandProblemViewer(true);
            this.vms.authViewModelState.setShowAuthModal(true);
        }
        if (!result.isOk) {
            this.observerService.onEvent(Events.EVENT_ERROR);
        }
    };
}
