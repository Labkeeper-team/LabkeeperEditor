import { Rpi } from '../model/rpi';
import { ViewModelRepository } from './repository';
import { ObserverService } from '../model/service/ObserverService.ts';
import { ProgramService } from '../model/service/ProgramService.ts';
import { LoaderService } from './domain/LoaderService.ts';
import { StartupService } from './operation/StartupService.ts';
import { CompilationService } from './domain/CompilationService.ts';
import { IdeService } from './domain/IdeService.ts';
import { FileService } from './domain/FileService.ts';
import { ExampleService } from './domain/ExampleService.ts';
import { Controller } from '../controller';
import { AuthService } from './operation/AuthService.ts';
import { FileManagerService } from './operation/FileManagerService.ts';
import { ProgramEditorService } from './operation/ProgramEditorService.ts';
import { ProjectPageService } from './operation/ProjectPageService.ts';
import { ProjectsPageService } from './operation/ProjectsPageService.ts';

export function setupContext(
    rpi: Rpi,
    repository: ViewModelRepository,
    observerService: ObserverService
) {
    /*
    DOMAIN
     */
    const programService: ProgramService = new ProgramService();
    const ideService: IdeService = new IdeService(repository, programService);
    const loaderService: LoaderService = new LoaderService(
        rpi,
        repository,
        ideService
    );
    const fileService: FileService = new FileService(repository);
    const exampleService: ExampleService = new ExampleService(rpi);
    const compilationService: CompilationService = new CompilationService(
        repository,
        rpi,
        programService,
        loaderService,
        observerService,
        ideService
    );

    /*
    OPERATION
     */
    const startupService: StartupService = new StartupService(
        rpi,
        programService,
        loaderService,
        repository,
        observerService,
        ideService,
        exampleService
    );
    const authService: AuthService = new AuthService(
        repository,
        rpi,
        ideService,
        startupService
    );
    const fileManagerService: FileManagerService = new FileManagerService(
        repository,
        rpi,
        programService,
        loaderService,
        ideService,
        fileService
    );
    const programEditorService: ProgramEditorService = new ProgramEditorService(
        repository,
        rpi,
        programService,
        loaderService,
        ideService,
        observerService,
        fileService
    );
    const projectPageService: ProjectPageService = new ProjectPageService(
        repository,
        rpi,
        programService,
        loaderService,
        ideService,
        observerService,
        compilationService
    );
    const projectsPageService: ProjectsPageService = new ProjectsPageService(
        repository,
        rpi,
        loaderService,
        ideService,
        startupService
    );

    /*
    FACADE
     */
    const controller = new Controller(
        authService,
        fileManagerService,
        programEditorService,
        projectPageService,
        projectsPageService,
        startupService,
        observerService
    );

    return {
        /*
        MISC
         */
        repository,
        rpi,
        controller,
        /*
        OPERATION
         */
        startupService,
        authService,
        fileManagerService,
        programEditorService,
        projectPageService,
        projectsPageService,
        /*
        DOMAIN
         */
        fileService,
        programService,
    };
}
