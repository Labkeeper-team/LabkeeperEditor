import { Rpi } from '../model/rpi';
import { ViewModelState } from './viewModelState';
import { ObserverService } from '../model/service/observer.ts';
import { ProgramService } from '../model/service/program.ts';
import { LoaderService } from './project.ts';
import { StartupService } from './init.ts';
import { CompilationService } from './compile.ts';
import { IdeService } from './ide.ts';
import { SystemService } from './index.ts';
import { AuthService } from './auth.ts';

export function setupContext(
    rpi: Rpi,
    mvs: ViewModelState,
    observerService: ObserverService
) {
    const programService: ProgramService = new ProgramService();
    const ideService: IdeService = new IdeService(mvs, programService);
    const loaderService: LoaderService = new LoaderService(
        rpi,
        mvs,
        ideService
    );
    const startupService: StartupService = new StartupService(
        rpi,
        programService,
        loaderService,
        mvs,
        observerService,
        ideService
    );
    const compilationService: CompilationService = new CompilationService(
        mvs,
        rpi,
        programService,
        loaderService,
        observerService,
        ideService
    );
    const authService: AuthService = new AuthService(mvs);
    const systemService: SystemService = new SystemService(
        mvs,
        rpi,
        programService,
        loaderService,
        ideService,
        startupService,
        compilationService,
        observerService,
        authService
    );

    programService.setProgramChangedCallback((currentProgram) =>
        systemService.onProgramUpdated(currentProgram)
    );

    return {
        observerService,
        mvs,
        programService,
        rpi,
        loaderService,
        startupService,
        compilationService,
        ideService,
        systemService,
    };
}
