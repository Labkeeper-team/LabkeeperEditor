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
import { FileService } from './file.ts';
import { ExampleService } from './example.ts';
import { Controller } from '../controller';

export function setupContext(
    rpi: Rpi,
    vms: ViewModelState,
    observerService: ObserverService
) {
    const programService: ProgramService = new ProgramService();
    const ideService: IdeService = new IdeService(vms, programService);
    const loaderService: LoaderService = new LoaderService(
        rpi,
        vms,
        ideService
    );
    const fileService: FileService = new FileService(vms);
    const exampleService: ExampleService = new ExampleService(rpi);
    const startupService: StartupService = new StartupService(
        rpi,
        programService,
        loaderService,
        vms,
        observerService,
        ideService,
        exampleService
    );
    const compilationService: CompilationService = new CompilationService(
        vms,
        rpi,
        programService,
        loaderService,
        observerService,
        ideService
    );
    const authService: AuthService = new AuthService(vms);
    const systemService: SystemService = new SystemService(
        vms,
        rpi,
        programService,
        loaderService,
        ideService,
        startupService,
        compilationService,
        observerService,
        authService,
        fileService,
        exampleService
    );
    const controller = new Controller(systemService, observerService);

    return {
        observerService,
        mvs: vms,
        programService,
        rpi,
        loaderService,
        startupService,
        compilationService,
        ideService,
        systemService,
        fileService,
        exampleService,
        controller,
    };
}
