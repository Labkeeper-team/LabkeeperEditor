import { Rpi } from '../model/rpi';
import { ViewModelRepository } from './repository';
import { ObserverService } from '../model/service/ObserverService.ts';
import { ProgramService } from '../model/service/ProgramService.ts';
import { LoaderService } from './domain/LoaderService.ts';
import { StartupService } from './operation/StartupService.ts';
import { CompilationService } from './domain/CompilationService.ts';
import { IdeService } from './domain/IdeService.ts';
import { FileService } from './domain/FileService.ts';

import { AuthService } from './operation/AuthService.ts';
import { FileManagerService } from './operation/FileManagerService.ts';
import { TextFileEditorService } from './operation/TextFileEditorService.ts';
import { ProgramEditorService } from './operation/ProgramEditorService.ts';
import { ProjectPageService } from './operation/ProjectPageService.ts';
import { ProjectsPageService } from './operation/ProjectsPageService.ts';
import { TokenPageService } from './operation/TokenPageService.ts';
import {
    InMemoryProgramRepository,
    ProgramRepository,
} from '../model/repository/ProgramRepository.ts';
import { ResetService } from './domain/ResetService.ts';
import { SearchService } from './domain/SearchService.ts';
import { HunkService } from './operation/HunkService.ts';
import { Controller } from '../controller/index.ts';

export function setupContext(
    rpi: Rpi,
    repository: ViewModelRepository,
    observerService: ObserverService
) {
    /*
    DOMAIN
     */
    const programRepository: ProgramRepository =
        new InMemoryProgramRepository();
    const programService: ProgramService = new ProgramService(
        programRepository
    );
    const resetService: ResetService = new ResetService(
        repository,
        programService
    );
    const ideService: IdeService = new IdeService(
        repository,
        programService,
        resetService
    );
    const searchService: SearchService = new SearchService();
    const loaderService: LoaderService = new LoaderService(
        rpi,
        repository,
        ideService,
        programService,
        observerService
    );
    const fileService: FileService = new FileService(repository);
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
    const tokenPageService: TokenPageService = new TokenPageService(
        rpi,
        repository,
        observerService
    );
    const startupService: StartupService = new StartupService(
        rpi,
        programService,
        loaderService,
        repository,
        observerService,
        ideService,
        tokenPageService,
        resetService
    );
    const authService: AuthService = new AuthService(
        repository,
        rpi,
        ideService,
        startupService,
        observerService
    );
    const textFileEditorService: TextFileEditorService =
        new TextFileEditorService(repository, rpi, ideService, observerService);
    const hunkService = new HunkService(
        repository,
        rpi,
        ideService,
        loaderService,
        observerService,
        textFileEditorService
    );
    textFileEditorService.setHunkService(hunkService);
    const fileManagerService: FileManagerService = new FileManagerService(
        repository,
        rpi,
        programService,
        loaderService,
        ideService,
        fileService,
        observerService,
        textFileEditorService
    );
    const programEditorService: ProgramEditorService = new ProgramEditorService(
        repository,
        rpi,
        programService,
        loaderService,
        ideService,
        observerService,
        fileService,
        textFileEditorService
    );
    programEditorService.setHunkService(hunkService);
    const projectPageService: ProjectPageService = new ProjectPageService(
        repository,
        rpi,
        programService,
        loaderService,
        ideService,
        observerService,
        compilationService,
        resetService,
        textFileEditorService,
        searchService,
        hunkService
    );
    startupService.setHunkService(hunkService);
    compilationService.setHunkService(hunkService);
    const projectsPageService: ProjectsPageService = new ProjectsPageService(
        repository,
        rpi,
        loaderService,
        ideService,
        startupService,
        observerService,
        resetService
    );

    /*
    FACADE
     */
    const controller = new Controller(
        authService,
        fileManagerService,
        textFileEditorService,
        programEditorService,
        projectPageService,
        projectsPageService,
        tokenPageService,
        startupService,
        observerService,
        hunkService
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
        textFileEditorService,
        programEditorService,
        projectPageService,
        projectsPageService,
        tokenPageService,
        hunkService,
        /*
        DOMAIN
         */
        fileService,
        programService,
        searchService,
    };
}
