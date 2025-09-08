import {
    Events,
    ObserverService,
} from '../../model/service/ObserverService.ts';
import { ViewModelRepository } from '../repository';
import { Rpi } from '../../model/rpi';
import { ProgramService } from '../../model/service/ProgramService.ts';
import { LoaderService } from '../domain/LoaderService.ts';
import { IdeService } from '../domain/IdeService.ts';
import { HeaderHelpItem } from '../../model/help';
import { Routes } from '../routes.ts';
import { CompilationService } from '../domain/CompilationService.ts';

export class ProjectPageService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    observerService: ObserverService;
    compilationService: CompilationService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        observerService: ObserverService,
        compilationService: CompilationService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.repository = repository;
        this.observerService = observerService;
        this.compilationService = compilationService;
    }

    onContactUsFormSubmitted = async (subject: string, body: string) => {
        const response = await this.rpi.contactFormRequest(subject, body);

        if (response.isOk) {
            this.repository.toast(
                this.repository.dictionary.contact_ok,
                'success'
            );
        } else {
            this.repository.toast(
                this.repository.dictionary.contact_error,
                'error'
            );
        }
    };

    onBackButtonClicked = async () => {
        this.repository.projectViewModelRepository.resetToInitialState();
        this.programService.clearHistory();
        this.repository.projectViewModelRepository.setReadOnly(false);
        if (this.repository.userViewModelRepository.isAuthenticated()) {
            this.repository.navigate(Routes.Projects);
        } else {
            this.repository.navigate(Routes.ProjectDefault);
        }
    };

    onSearchIconPress = () => {
        if (this.repository.settingsViewModelRepository.showSearch()) {
            this.repository.ideViewModelRepository.setSearch('');
            this.repository.settingsViewModelRepository.setShowSearch(false);
        }
    };

    onSearchInputChanged = (text: string) => {
        this.repository.ideViewModelRepository.setSearch(text);
    };

    onHelpItemCreated = (item: HeaderHelpItem) => {
        const lastProgram = this.programService.getCurrentProgram();
        if (!lastProgram) {
            return;
        }
        const prevActiveIndex =
            this.repository.ideViewModelRepository.previousActiveSegmentIndex();
        const activeSegment = lastProgram.segments.find(
            (_s, index) => index === prevActiveIndex
        );

        if (!activeSegment) {
            this.programService.addSegmentToLastPosition(item.segmentType);
            this.programService.changeSegmentTextByPositionIndex(
                this.programService.getCurrentProgram().segments.length - 1,
                item.text[
                    this.repository.persistenceViewModelRepository.language()
                ]
            );
        } else {
            if (activeSegment.type === item.segmentType) {
                const newActiveSegment = { ...activeSegment };
                const text = `${newActiveSegment.text}\n\n${item.text[this.repository.persistenceViewModelRepository.language()]}`;
                this.programService.changeSegmentTextByPositionIndex(
                    prevActiveIndex,
                    text
                );
            } else {
                const place = prevActiveIndex >= 1 ? prevActiveIndex - 1 : 0;
                this.programService.addSegmentAfterIndex(
                    item.segmentType,
                    place
                );
                this.programService.changeSegmentTextByPositionIndex(
                    place + 1,
                    item.text[
                        this.repository.persistenceViewModelRepository.language()
                    ]
                );
            }
        }
        this.ideService.onProgramUpdated();
    };

    onExpandErrorsClicked = () => {
        this.repository.settingsViewModelRepository.setExpandProblemViewer(
            !this.repository.settingsViewModelRepository.expandProblemViewer()
        );
    };

    onPrintButtonPressed = (): void => {
        this.observerService.onEvent(Events.EVENT_PRINT);
        this.repository.ideViewModelRepository.setActiveSegmentIndex(-1);
    };

    onProjectPageEscButtonPressed = (): void => {
        if (this.repository.settingsViewModelRepository.showTour()) {
            this.repository.settingsViewModelRepository.setTourVisibility(
                false
            );
            return;
        }
        if (this.repository.settingsViewModelRepository.editModeForFilename()) {
            this.repository.settingsViewModelRepository.setEditModeForFilename(
                false
            );
            return;
        }
        if (
            this.repository.settingsViewModelRepository.editModeForProjectTitle()
        ) {
            this.repository.settingsViewModelRepository.setEditModeForProjectTitle(
                false
            );
            return;
        }
        if (this.repository.settingsViewModelRepository.showSearch()) {
            this.repository.ideViewModelRepository.setSearch('');
            this.repository.settingsViewModelRepository.setShowSearch(false);
            return;
        }
        if (this.repository.settingsViewModelRepository.expandProblemViewer()) {
            this.repository.settingsViewModelRepository.setExpandProblemViewer(
                false
            );
            return;
        }
        if (this.repository.settingsViewModelRepository.showFileManager()) {
            this.repository.settingsViewModelRepository.setShowFileManager(
                false
            );
            return;
        }
    };

    onProjectTitleChanged = async (
        projectId: string,
        title: string,
        okCallback: () => void,
        failCallback: () => void
    ) => {
        const titleToSend = title.trim();
        if (!titleToSend) {
            this.repository.toast(
                this.repository.dictionary.projects.errors.empty_name,
                'error'
            );
            failCallback();
            return;
        }

        const result = await this.rpi.setTitleRequest(projectId, title);
        if (!result.isOk) {
            failCallback();
            return;
        }
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            return;
        }
        if (result.isOk) {
            const project =
                this.repository.projectViewModelRepository.project();
            if (project) {
                this.repository.projectViewModelRepository.setProject({
                    ...project,
                    title: title,
                });
                this.repository.projectViewModelRepository.setReadOnly(false);
            }
            okCallback();
        }

        await this.loaderService.loadProjects();
    };

    onProjectVisibilityChange = async (visible: boolean) => {
        const project = this.repository.projectViewModelRepository.project();
        if (!project) return;

        const result = await this.rpi.setProjectVisibilityRequest(
            project.projectId,
            visible
        );

        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }

        if (result.isOk) {
            this.repository.projectViewModelRepository.setProject({
                ...project,
                isPublic: visible,
            });
            this.repository.projectViewModelRepository.setReadOnly(false);
        }
    };

    onCloneProject = async () => {
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            throw new Error('No project to clone');
        }

        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            this.repository.authViewModelRepository.setCurrentView('login');
            return;
        }

        this.repository.ideViewModelRepository.setCloneRequestState('loading');
        const result = await this.rpi.cloneProjectRequest(project.projectId);

        if (result.isOk) {
            this.repository.ideViewModelRepository.setCloneRequestState('ok');
            this.repository.navigate(
                Routes.Project.replace(':id', result.body.projectId)
            );
            this.repository.projectViewModelRepository.setProject(result.body);
            this.ideService.setNewProgram(result.body.program);
            await this.loaderService.loadProjects();
            this.repository.projectViewModelRepository.setReadOnly(false);
        } else {
            this.repository.ideViewModelRepository.setCloneRequestState(
                'error'
            );
            if (result.code === 417) {
                this.repository.toast(
                    this.repository.dictionary.create_modal.error
                        .too_many_projects,
                    'error'
                );
            } else {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors.internalError,
                    'error'
                );
            }
        }
    };

    onRunButtonClicked = async (): Promise<void> => {
        try {
            const lastProgram = this.programService.getCurrentProgram();
            this.repository.settingsViewModelRepository.setIsCompiling(true);
            const project =
                this.repository.projectViewModelRepository.project();
            if (
                this.repository.userViewModelRepository.isAuthenticated() &&
                project &&
                !this.repository.projectViewModelRepository.projectIsReadonly() &&
                lastProgram
            ) {
                const result = await this.rpi.saveProgramRequest(
                    project.projectId,
                    lastProgram
                );
                if (result.isUnauth || result.isForbidden) {
                    this.repository.toast(
                        this.repository.dictionary.filemanager.errors
                            .sessionExpired,
                        'error'
                    );
                    this.ideService.resetEditor();
                }
                if (!result.isOk) {
                    this.repository.toast(
                        this.repository.dictionary.filemanager.errors.noNetwork,
                        'error'
                    );
                    return;
                }
            }
            this.observerService.onEvent(Events.EVENT_RUN);
            await this.compilationService.runCompilation();
        } finally {
            setTimeout(
                () =>
                    this.repository.settingsViewModelRepository.setIsCompiling(
                        false
                    ),
                1000
            );
        }
    };
}
