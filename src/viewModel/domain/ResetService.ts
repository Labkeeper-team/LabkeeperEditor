import { ViewModelRepository } from '../repository';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { createEmptyProgram } from '../../model/repository/ProgramRepository.ts';

export class ResetService {
    repository: ViewModelRepository;
    programService: ProgramService;

    constructor(
        repository: ViewModelRepository,
        programService: ProgramService
    ) {
        this.repository = repository;
        this.programService = programService;
    }

    resetAll(): void {
        this.resetProject();

        // Auth
        this.repository.authViewModelRepository.setCurrentView('closed');
        this.repository.authViewModelRepository.setCurrentEmail(null);
        this.repository.authViewModelRepository.setLastVerifiedCode(null);
        this.repository.authViewModelRepository.setLoginRequest('unknown');
        this.repository.authViewModelRepository.setEmailRequest('unknown');
        this.repository.authViewModelRepository.setPasswordRequest('unknown');
        this.repository.authViewModelRepository.setCodeCheckRequest('unknown');
        this.repository.authViewModelRepository.setIsRegistration(false);

        // Ide
        this.repository.ideViewModelRepository.setCloneRequestState('unknown');
        this.repository.ideViewModelRepository.setGetProjectRequestState(
            'unknown'
        );
        this.repository.ideViewModelRepository.setGetFilesRequestState(
            'unknown'
        );
        this.repository.ideViewModelRepository.setGetProjectsRequestState(
            'unknown'
        );
        this.repository.ideViewModelRepository.setActiveSegmentIndex(-1);
        this.repository.ideViewModelRepository.setPreviousActiveSegmentIndex(
            -1
        );
        this.repository.ideViewModelRepository.setUndoEnabled(false);
        this.repository.ideViewModelRepository.setRedoEnabled(false);
        this.repository.ideViewModelRepository.setSearch(undefined);

        // Projects
        this.repository.projectsViewModelRepository.setProjects([]);

        // Settings
        this.repository.settingsViewModelRepository.setIsFileDraggedToFileManager(
            false
        );
        this.repository.settingsViewModelRepository.setEditModeForProjectTitle(
            false
        );
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            false
        );
        this.repository.settingsViewModelRepository.setExpandProblemViewer(
            false
        );
        this.repository.settingsViewModelRepository.setShowFileManager(false);
        this.repository.settingsViewModelRepository.setTourVisibility(false);
        this.repository.settingsViewModelRepository.setIsCompiling(false);
        this.repository.settingsViewModelRepository.setShowSearch(false);

        // User
        this.repository.userViewModelRepository.setUserInfo({
            isAuthenticated: false,
            email: '',
            id: -1,
        });
    }

    resetProject(): void {
        this.programService.clearHistory();

        // Project
        this.repository.projectViewModelRepository.setProject(undefined);
        this.repository.projectViewModelRepository.setCurrentProgram(
            createEmptyProgram()
        );
        this.repository.projectViewModelRepository.setReadOnly(false);
        this.repository.projectViewModelRepository.setFiles([]);
        this.repository.projectViewModelRepository.setCompileResult({
            segments: [],
        });
        this.repository.projectViewModelRepository.setCompileErrorResult({
            errors: [],
        });
    }
}
