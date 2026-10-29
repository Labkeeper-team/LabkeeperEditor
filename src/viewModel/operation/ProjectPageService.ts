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
import {
    CompileErrorResultList,
    ProjectExportFormat,
    ProjectType,
} from '../../model/domain.ts';
import { ExportProjectResponse, RequestResult } from '../../model/rpi';
import { TextFileEditorService } from './TextFileEditorService.ts';
import { SearchService } from '../domain/SearchService.ts';
import { HunkService } from './HunkService.ts';
import { EditingLockService } from '../domain/EditingLockService.ts';
import { segmentCreateEvent, trackEvent } from '../utils/observerContext.ts';

// в имени файла не бывает этих знаков ни на одной системе
const UNSAFE_FILE_NAME = /[\\/:*?"<>|]+/g;

/** Имя архива по названию проекта: «Лабораторная 3.zip», «Лабораторная 3 (LaTeX).zip» */
export const exportFileName = (
    title: string,
    format: ProjectExportFormat
): string => {
    const base =
        title.replace(UNSAFE_FILE_NAME, ' ').replace(/\s+/g, ' ').trim() ||
        'labkeeper';
    return format === 'tex' ? `${base} (LaTeX).zip` : `${base}.zip`;
};

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

    private track(event: string, properties?: Record<string, unknown>) {
        trackEvent(this.observerService, this.repository, event, properties);
    }

    onContactUsFormSubmitted = async (subject: string, body: string) => {
        this.track(Events.EVENT_CONTACT_FORM_SUBMITTED, {
            subject_length: subject.length,
            body_length: body.length,
        });
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

        this.track(Events.EVENT_PRIVACY_POLICY_ACCEPTED);
        this.repository.settingsViewModelRepository.setShowPrivacyPolicyAcceptanceModal(
            false
        );
    };

    onBackButtonClicked = async () => {
        this.track(Events.EVENT_BACK_TO_PROJECTS);
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

    onSearchSubmit = () => this.stepSearch('next');

    /** GH-172: Shift+F3, тот же переход, что у Enter, только назад */
    onSearchPrevious = () => this.stepSearch('previous');

    private stepSearch = (direction: 'next' | 'previous') => {
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

        let index: number;
        if (isNewQuery) {
            const first = this.searchService.firstIndexAtOrAfter(
                matches,
                this.repository.ideViewModelRepository.segmentsViewportAnchor()
            );
            // назад от видимой области: последнее совпадение выше неё
            index =
                direction === 'next'
                    ? first
                    : (first - 1 + matches.length) % matches.length;
        } else {
            index =
                direction === 'next'
                    ? this.searchService.nextIndexAfter(matches, current)
                    : this.searchService.previousIndexBefore(matches, current);
        }

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

        let createdSegment = false;
        if (!activeSegment) {
            this.programService.addSegmentToLastPosition(item.segmentType);
            this.programService.changeSegmentTextByPositionIndex(
                this.programService.getCurrentProgram().segments.length - 1,
                item.text[
                    this.repository.persistenceViewModelRepository.language()
                ]
            );
            createdSegment = true;
        } else if (activeSegment.type === item.segmentType) {
            const newActiveSegment = { ...activeSegment };
            const text = `${newActiveSegment.text}\n\n${item.text[this.repository.persistenceViewModelRepository.language()]}`;
            this.programService.changeSegmentTextByPositionIndex(
                prevActiveIndex,
                text
            );
        } else {
            const place = prevActiveIndex >= 1 ? prevActiveIndex - 1 : 0;
            this.programService.addSegmentAfterIndex(item.segmentType, place);
            this.programService.changeSegmentTextByPositionIndex(
                place + 1,
                item.text[
                    this.repository.persistenceViewModelRepository.language()
                ]
            );
            createdSegment = true;
        }
        if (createdSegment) {
            this.track(segmentCreateEvent(item.segmentType), {
                segment_type: item.segmentType,
                source: 'help',
            });
        }
        this.repository.ideViewModelRepository.markProgramChanged();
        this.ideService.onProgramUpdated();
    };

    onExpandErrorsClicked = () => {
        this.repository.settingsViewModelRepository.setExpandProblemViewer(
            !this.repository.settingsViewModelRepository.expandProblemViewer()
        );
    };

    onPrintButtonPressed = (method: 'print' | 'download' = 'print'): void => {
        this.track(Events.EVENT_PRINT, {
            mode: this.repository.projectViewModelRepository.mode(),
            method,
        });
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
            this.track(Events.EVENT_PROJECT_TITLE_CHANGED);
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
            this.track(Events.EVENT_PROJECT_VISIBILITY_CHANGED, { visible });
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
            this.track(Events.EVENT_AUTH_MODAL_OPENED, { source: 'clone' });
            this.repository.authViewModelRepository.setCurrentView('login');
            return;
        }

        this.repository.ideViewModelRepository.setCloneRequestState('loading');
        const result = await this.rpi.cloneProjectRequest(project.projectId);

        if (result.isOk) {
            this.track(Events.EVENT_PROJECT_CLONED, {
                source_project_id: project.projectId,
            });
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
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors.internalError,
                    'error'
                );
            }
        }
    };

    onRunButtonClicked = async (
        trigger: 'button' | 'hotkey' = 'button'
    ): Promise<void> => {
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
            const files = this.repository.projectViewModelRepository.files();
            this.track(Events.EVENT_RUN, {
                trigger,
                segment_count: lastProgram?.segments.length ?? 0,
                has_tex_file: files.some((file) =>
                    file.fileName.toLowerCase().endsWith('.tex')
                ),
            });
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

    /**
     * GH-211: архив проекта. Набранное, но ещё не сохранённое уходит на сервер
     * до запроса, иначе в архив попала бы прошлая версия. LaTeX-архив сервер
     * собирает, выполняя программу как сборку, поэтому и ответы у него те же:
     * ошибки программы, нехватка токенов и замок агента
     */
    onExportProject = async (format: ProjectExportFormat): Promise<void> => {
        // у гостя проекта на сервере нет, экспортировать нечего, пока он не вошёл
        if (!this.repository.userViewModelRepository.isAuthenticated()) {
            this.track(Events.EVENT_AUTH_MODAL_OPENED, { source: 'export' });
            this.repository.authViewModelRepository.setCurrentView('login');
            return;
        }
        const settings = this.repository.settingsViewModelRepository;
        const project = this.repository.projectViewModelRepository.project();
        if (!project || settings.exportingProject()) {
            return;
        }
        settings.setExportingProject(format);
        try {
            await this.saveBeforeExport();
            const result =
                format === 'tex'
                    ? await this.rpi.exportProjectTexRequest(project.projectId)
                    : await this.rpi.exportProjectRequest(project.projectId);
            this.track(Events.EVENT_PROJECT_EXPORTED, {
                format,
                ok: result.code === 201,
                http_code: result.code,
            });
            await this.applyExportResult(format, project.title, result);
        } finally {
            settings.setExportingProject(null);
        }
    };

    private saveBeforeExport = async () => {
        if (this.repository.ideViewModelRepository.activeTextFile()) {
            await this.textFileEditorService.onTextFileSaveTimeout();
        }
        if (
            !this.repository.projectViewModelRepository.projectIsReadonly() &&
            this.programService.getCurrentProgram()
        ) {
            await this.loaderService.segmentEditorSaveProgram();
        }
    };

    private applyExportResult = async (
        format: ProjectExportFormat,
        title: string,
        result: RequestResult<ExportProjectResponse>
    ) => {
        const errors = this.repository.dictionary.filemanager.errors;
        switch (result.code) {
            case 201:
                await this.repository.downloadFile(
                    result.body as string,
                    exportFileName(title, format)
                );
                return;
            case 203:
                this.compilationService.applyCompileErrors(
                    result.body as CompileErrorResultList
                );
                this.repository.toast(
                    this.repository.dictionary.project_export.program_errors,
                    'error'
                );
                return;
            case 401:
                this.repository.toast(errors.sessionExpired, 'error');
                this.ideService.resetEditor();
                return;
            case 402:
                this.track(Events.EVENT_PAYMENT_REQUIRED, { source: 'export' });
                this.repository.toast(
                    this.repository.dictionary.prompt_modal.errors
                        .payment_required,
                    'error'
                );
                return;
            case 403:
                this.repository.toast(errors.notEnoughRights, 'error');
                return;
            case 404:
                this.repository.toast(errors.notFound, 'error');
                return;
            // занята сессия сборки, как у кнопки Run
            case 423:
                this.repository.toast(
                    this.repository.dictionary.synctex.errors.locked,
                    'error'
                );
                return;
            default:
                this.repository.toast(errors.internalError, 'error');
        }
    };

    setProjectType = async (type: ProjectType): Promise<void> => {
        if (this.editingLock.rejectEdit()) {
            return;
        }
        const from = this.repository.projectViewModelRepository.mode();
        this.track(Events.EVENT_PROJECT_MODE_CHANGED, { from, to: type });
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
        }
    };
}
