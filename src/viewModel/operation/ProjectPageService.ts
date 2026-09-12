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
import { ResetService } from '../domain/ResetService.ts';
import { ProjectType } from '../../model/domain.ts';
import { TextFileEditorService } from './TextFileEditorService.ts';
import { SearchService } from '../domain/SearchService.ts';
import { HunkService } from './HunkService.ts';
import { EditingLockService } from '../domain/EditingLockService.ts';

export class ProjectPageService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    observerService: ObserverService;
    compilationService: CompilationService;
    resetService: ResetService;
    textFileEditorService: TextFileEditorService;
    searchService: SearchService;
    hunkService: HunkService;
    editingLock: EditingLockService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        observerService: ObserverService,
        compilationService: CompilationService,
        resetService: ResetService,
        textFileEditorService: TextFileEditorService,
        searchService: SearchService,
        hunkService: HunkService,
        editingLock: EditingLockService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.repository = repository;
        this.observerService = observerService;
        this.compilationService = compilationService;
        this.resetService = resetService;
        this.textFileEditorService = textFileEditorService;
        this.searchService = searchService;
        this.hunkService = hunkService;
        this.editingLock = editingLock;
    }

    onContactUsFormSubmitted = async (subject: string, body: string) => {
        const response = await this.rpi.contactFormRequest(subject, body);

        if (response.isOk) {
            this.repository.toast(
                this.repository.dictionary.contact_ok,
                'success'
            );
        } else {
            this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN);
            this.repository.toast(
                this.repository.dictionary.contact_error,
                'error'
            );
        }
    };

    onPrivacyPolicyAccepted = async () => {
        const response = await this.rpi.acceptPrivacyPolicyRequest();

        if (!response.isOk) {
            this.repository.toast(
                this.repository.dictionary.privacy_policy_acceptance_modal
                    .error,
                'error'
            );
            return;
        }

        this.repository.settingsViewModelRepository.setShowPrivacyPolicyAcceptanceModal(
            false
        );
    };

    onBackButtonClicked = async () => {
        this.resetService.resetProject();
        this.repository.projectViewModelRepository.setReadOnly(false);
        if (this.repository.userViewModelRepository.isAuthenticated()) {
            this.repository.setLocation(Routes.Projects);
        } else {
            this.repository.setLocation(Routes.ProjectDefault);
        }
        await this.loaderService.loadProjects();
    };

    onSearchIconPress = () => {
        if (this.repository.settingsViewModelRepository.showSearch()) {
            this.closeSearch();
        }
    };

    /** Ввод только копит текст. Подсветку и переходы делает Enter */
    onSearchInputChanged = (text: string) => {
        this.repository.ideViewModelRepository.setSearchInput(text);
        this.repository.ideViewModelRepository.setSearchNoMatch(false);
        // сброшенное совпадение это и есть признак "текст меняли после прошлого Enter"
        this.repository.ideViewModelRepository.setSearchCurrentMatch(null);
    };

    onSearchSubmit = () => {
        const input = this.repository.ideViewModelRepository.searchInput();
        if (input.length === 0) {
            return;
        }

        const matches = this.searchService.findMatches(
            this.programService.getCurrentProgram(),
            input
        );

        if (matches.length === 0) {
            this.repository.ideViewModelRepository.setSearch(input);
            this.repository.ideViewModelRepository.setSearchCurrentMatch(null);
            this.repository.ideViewModelRepository.setSearchNoMatch(true);
            return;
        }
        this.repository.ideViewModelRepository.setSearchNoMatch(false);

        const committed = this.repository.ideViewModelRepository.search();
        const current =
            this.repository.ideViewModelRepository.searchCurrentMatch();
        const isNewQuery = input !== committed || current === null;

        const index = isNewQuery
            ? this.searchService.firstIndexAtOrAfter(
                  matches,
                  this.repository.ideViewModelRepository.segmentsViewportAnchor()
              )
            : this.searchService.nextIndexAfter(matches, current);

        const match = matches[index];
        this.repository.ideViewModelRepository.setSearch(input);
        this.repository.ideViewModelRepository.setSearchCurrentMatch({
            segmentIndex: match.segmentIndex,
            from: match.from,
            to: match.to,
        });
        // активный сегмент не трогаем: это увело бы фокус из поля и запустило smooth-скролл
        this.repository.ideViewModelRepository.setEditorNavigationTarget({
            segmentIndex: match.segmentIndex,
            line: match.line,
            focus: false,
        });
    };

    private closeSearch = () => {
        this.repository.ideViewModelRepository.setSearch('');
        this.repository.ideViewModelRepository.setSearchInput('');
        this.repository.ideViewModelRepository.setSearchNoMatch(false);
        this.repository.ideViewModelRepository.setSearchCurrentMatch(null);
        this.repository.settingsViewModelRepository.setShowSearch(false);
    };

    onHelpItemCreated = (item: HeaderHelpItem) => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
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
        this.repository.ideViewModelRepository.markProgramChanged();
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
            this.closeSearch();
            return;
        }
        if (this.repository.settingsViewModelRepository.expandProblemViewer()) {
            this.repository.settingsViewModelRepository.setExpandProblemViewer(
                false
            );
            return;
        }
        if (this.repository.ideViewModelRepository.activeTextFile()) {
            void this.textFileEditorService.onTextFileEditorClosed();
            return;
        }
        if (this.repository.ideViewModelRepository.activeImageFile()) {
            this.textFileEditorService.onImageFilePreviewClosed();
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
        if (this.editingLock.rejectEdit()) {
            return;
        }
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
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
            failCallback();
            return;
        }
        if (!result.isOk) {
            this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN);
            failCallback();
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
        if (this.editingLock.rejectEdit()) {
            return;
        }
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
        } else if (!result.isUnauth) {
            this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN);
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
            this.repository.setLocation(
                Routes.Project.replace(':id', result.body.projectId)
            );
            this.resetService.resetFileManagerProjectState();
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
                this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN);
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors.internalError,
                    'error'
                );
            }
        }
    };

    onRunButtonClicked = async (): Promise<void> => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        try {
            this.repository.settingsViewModelRepository.setIsCompiling(true);
            if (this.repository.ideViewModelRepository.activeTextFile()) {
                await this.textFileEditorService.onTextFileSaveTimeout();
            }

            const lastProgram = this.programService.getCurrentProgram();
            const project =
                this.repository.projectViewModelRepository.project();
            if (
                this.repository.userViewModelRepository.isAuthenticated() &&
                project &&
                !this.repository.projectViewModelRepository.projectIsReadonly() &&
                lastProgram
            ) {
                await this.loaderService.segmentEditorSaveProgram();
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

    setProjectType = async (type: ProjectType): Promise<void> => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        this.repository.projectViewModelRepository.setProjectType(type);

        const project = this.repository.projectViewModelRepository.project();
        if (!project) return;

        if (!this.repository.userViewModelRepository.isAuthenticated()) return;

        const result = await this.rpi.setProjectTypeRequest(
            project.projectId,
            type
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
                projectType: type,
            });
            this.repository.projectViewModelRepository.setReadOnly(false);
        } else if (!result.isUnauth) {
            this.observerService.onEvent(Events.EVENT_RPI_UNKNOWN);
        }
    };
}
