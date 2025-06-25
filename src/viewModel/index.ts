import { Routes } from './../view/routing/routes.ts';
import {
    Program,
    ProgramRoundStrategy,
    Project,
    Segment,
    SegmentType,
    TextOutputSegment,
} from '../model/domain.ts';
import { LoaderService } from './project.ts';
import { checkFile } from './file.ts';
import { HeaderHelpItem } from '../model/help';
import { Rpi } from '../model/rpi';
import { ProgramService } from '../model/service/program.ts';
import { IdeService } from './ide.ts';
import { StartupService } from './init.ts';
import { CompilationService } from './compile.ts';
import { ViewModelState } from './viewModelState';
import { Events, ObserverService } from '../model/service/observer.ts';

export class SystemService {
    vms: ViewModelState;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    startupService: StartupService;
    compilationService: CompilationService;
    observerService: ObserverService;

    constructor(
        vms: ViewModelState,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        startupService: StartupService,
        compilationService: CompilationService,
        observerService: ObserverService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.startupService = startupService;
        this.compilationService = compilationService;
        this.vms = vms;
        this.observerService = observerService;
    }

    onAppStartup = async () => {
        await this.startupService.onAppStartup();
    };

    onPrintButtonPressed = (): void => {
        this.vms.ideViewModelState.setActiveSegmentIndex(-1);
    };

    onProjectPageEscButtonPressed = (): void => {
        if (this.vms.settingsViewModelState.showTour()) {
            this.vms.settingsViewModelState.setTourVisibility(false);
            return;
        }
        if (this.vms.settingsViewModelState.editModeForFilename()) {
            this.vms.settingsViewModelState.setEditModeForFilename(false);
            return;
        }
        if (this.vms.settingsViewModelState.editModeForProjectTitle()) {
            this.vms.settingsViewModelState.setEditModeForProjectTitle(false);
            return;
        }
        if (this.vms.settingsViewModelState.showSearch()) {
            this.vms.ideViewModelState.setSearch('');
            this.vms.settingsViewModelState.setShowSearch(false);
            return;
        }
        if (this.vms.settingsViewModelState.expandProblemViewer()) {
            this.vms.settingsViewModelState.setExpandProblemViewer(false);
            return;
        }
        if (this.vms.settingsViewModelState.showFileManager()) {
            this.vms.settingsViewModelState.setShowFileManager(false);
            return;
        }
    };

    onRunButtonClicked = async (): Promise<void> => {
        try {
            const lastProgram = this.programService.getCurrentProgram();
            this.vms.settingsViewModelState.setIsCompiling(true);
            const project = this.vms.projectViewModelState.project();
            if (
                this.vms.userViewModelState.isAuthenticated() &&
                project &&
                !this.vms.projectViewModelState.projectIsReadonly() &&
                lastProgram
            ) {
                const result = await this.rpi.saveProgramRequest(
                    project.projectId,
                    lastProgram
                );
                if (result.isUnauth || result.isForbidden) {
                    this.vms.toast(
                        this.vms.dictionary.filemanager.errors.sessionExpired,
                        'error'
                    );
                    this.vms.resetToInitialState();
                }
                if (!result.isOk) {
                    return;
                }
            }
            this.observerService.onEvent(Events.EVENT_RUN);
            await this.compilationService.runCompilation();
        } finally {
            setTimeout(
                () => this.vms.settingsViewModelState.setIsCompiling(false),
                1000
            );
        }
    };

    segmentEditorSaveProgram = async (): Promise<void> => {
        if (this.vms.projectViewModelState.projectIsReadonly()) {
            return;
        }
        const savedProgram = this.programService.getCurrentProgram();
        const project = this.vms.projectViewModelState.project();
        if (project) {
            const result = await this.rpi.saveProgramRequest(
                project.projectId,
                savedProgram
            );
            if (result.isUnauth) {
                this.vms.toast(
                    this.vms.dictionary.filemanager.errors.sessionExpired,
                    'error'
                );
                this.vms.resetToInitialState();
            }
            if (!result.isOk) {
                return;
            }
        }
    };

    segmentEditorChangeSegmentPosition = async (
        direction: 'up' | 'down',
        segmentIndex: number
    ): Promise<void> => {
        this.observerService.onEvent(Events.EVENT_MOVE_SEGMENT);
        this.programService.moveSegment(segmentIndex, direction);
        await this.segmentEditorSaveProgram();
    };

    segmentEditorChangeSegmentVisibility = async (
        visible: boolean,
        parameterName: string,
        segmentIndex: number
    ) => {
        this.programService.changeSegmentVisibility(
            visible,
            parameterName,
            segmentIndex
        );
    };

    deleteSegment = async (segmentIndex: number) => {
        this.programService.deleteSegmentByIndex(segmentIndex);
        await this.segmentEditorSaveProgram();
    };

    onAddedFilesToSegmentEditor = async (
        items: DataTransferItemList,
        segmentId: number,
        editorCallback: (insert: string) => void
    ) => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const thisCopy = this;
        for (const item of items) {
            await new Promise((reslv) => {
                try {
                    if (item.kind === 'file') {
                        const project =
                            this.vms.projectViewModelState.project();
                        if (!project) {
                            this.vms.toast(
                                this.vms.dictionary.segment.errors
                                    .non_authorized_paste_image,
                                'error'
                            );
                            return reslv(null);
                        }
                        const file = item.getAsFile();
                        if (!file) {
                            return reslv(null);
                        }
                        checkFile(file, this.vms.dictionary);
                        const reader = new FileReader();
                        reader.onload = async function () {
                            const fileToUpload = file;
                            const [, ext] = file.name.split('.');
                            const name = `${segmentId}-${Date.now()}.${ext}`;
                            const formData = new FormData();
                            const filename = name ?? 'Файлнейм';
                            formData.append('file', fileToUpload);

                            if (!project.projectId) {
                                return;
                            }

                            const res = await thisCopy.rpi.uploadFileRequest(
                                formData,
                                project.projectId,
                                name
                            );

                            if (res.code === 413) {
                                thisCopy.vms.toast(
                                    thisCopy.vms.dictionary.filemanager.errors.tooBigFile.replace(
                                        '${replace1}',
                                        '10Mb'
                                    ),
                                    'error'
                                );
                                reslv(null);
                            }
                            if (res.code === 409) {
                                thisCopy.vms.toast(
                                    thisCopy.vms.dictionary.filemanager.errors
                                        .tooMuchFiles,
                                    'error'
                                );
                                reslv(null);
                            }
                            if (res.isUnauth) {
                                thisCopy.vms.toast(
                                    thisCopy.vms.dictionary.filemanager.errors
                                        .sessionExpired,
                                    'error'
                                );
                                thisCopy.vms.resetToInitialState();
                                reslv(null);
                            }
                            if (res.isForbidden) {
                                // TODO toast
                            }

                            if (res.isOk) {
                                const lastProgram =
                                    thisCopy.programService.getCurrentProgram();
                                const url = res.body;
                                const segmentType = lastProgram.segments.find(
                                    (s) => s.id === segmentId
                                )?.type;
                                let itemToInsert = '';
                                switch (segmentType) {
                                    case 'md':
                                        if (file.type.includes('image')) {
                                            itemToInsert = `![${filename}](${url})`;
                                        }
                                        break;
                                    case 'computational':
                                    default: {
                                        const prefunction = file.type.includes(
                                            'image'
                                        )
                                            ? 'image'
                                            : 'csv';
                                        itemToInsert = `${prefunction}("${url}")`;
                                        break;
                                    }
                                }
                                await thisCopy.loaderService.loadFiles(
                                    project.projectId
                                );
                                editorCallback(itemToInsert);
                                reslv(null);
                            }
                        };
                        reader.readAsDataURL(file);
                    } else {
                        reslv(null);
                    }
                } catch {
                    reslv(null);
                }
            });
        }
    };

    onSegmentAddedViaDivider = async (segment: Segment, after: number) => {
        this.programService.addSegmentAfterIndex(segment, after);
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(after + 1);
        await this.segmentEditorSaveProgram();
    };

    onFocusSegment = async (segmentIndex: number) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
    };

    onBlurSegment = async (segmentIndex: number, segmentText: string) => {
        if (this.vms.ideViewModelState.activeSegmentIndex() === segmentIndex) {
            this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
        }
        this.programService.changeSegmentTextByPositionIndex(
            segmentIndex,
            segmentText
        );
        await this.segmentEditorSaveProgram();
    };

    onSegmentTextEdited = async (segmentIndex: number, segmentText: string) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
        this.programService.changeSegmentTextByPositionIndex(
            segmentIndex,
            segmentText
        );
    };

    onAddSegmentClicked = (type: SegmentType) => {
        switch (type) {
            case 'md':
                this.observerService.onEvent(Events.EVENT_CREATE_MD_SEGMENT);
                break;
            case 'asciimath':
                this.observerService.onEvent(
                    Events.EVENT_CREATE_ASCIIMATH_SEGMENT
                );
                break;
            case 'latex':
                this.observerService.onEvent(Events.EVENT_CREATE_LATEX_SEGMENT);
                break;
            case 'computational':
                this.observerService.onEvent(Events.EVENT_CREATE_COMP_SEGMENT);
                break;
        }
        const newSegment: Segment = {
            id: 1,
            type,
            parameters: {
                visible: true,
            },
            text: '',
        };
        this.programService.addSegmentToLastPosition(newSegment);
        this.vms.ideViewModelState.setActiveSegmentIndex(
            this.programService.getCurrentProgram().segments.length
        );
        this.vms.scrollEditorToBottom();
    };

    onFolderButtonClicked = async () => {
        this.vms.settingsViewModelState.setShowFileManager(true);
        const project = this.vms.projectViewModelState.project();
        if (project) {
            await this.loaderService.loadFiles(project.projectId);
        }
    };

    onPrevVersionButtonClicked = () => {
        this.programService.undo();
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
    };

    onNextVersionButtonClicked = () => {
        this.programService.redo();
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
    };

    isPrevVersionButtonDisabled = (): boolean => {
        return !this.programService.canUndo();
    };

    isNextVersionButtonDisabled = (): boolean => {
        return !this.programService.canRedo();
    };

    onSearchIconPress = () => {
        if (this.vms.settingsViewModelState.showSearch()) {
            this.vms.ideViewModelState.setSearch('');
            this.vms.settingsViewModelState.setShowSearch(false);
        }
    };

    onSearchInputChanged = (text: string) => {
        this.vms.ideViewModelState.setSearch(text);
    };

    onRoundStrategySet = (strategy: ProgramRoundStrategy) => {
        this.programService.changeRoundStrategy(strategy);
    };

    onHelpItemCreated = (item: HeaderHelpItem) => {
        if (
            this.vms.ideViewModelState.previousActiveSegmentIndex() === -1 ||
            this.vms.ideViewModelState.previousActiveSegmentIndex() ===
                undefined ||
            this.vms.ideViewModelState.activeSegmentIndex() === undefined
        ) {
            this.programService.addSegmentToLastPosition({
                id: 0,
                parameters: {
                    visible: true,
                    hideArray: false,
                    hideAssignmentWithValues: false,
                    hideGeneralFormula: false,
                    hideInflAssignment: false,
                    hideInflAssignmentWithValues: false,
                },
                text: item.text[this.vms.persistenceViewModelState.language()],
                type: item.segmentType,
            });
        } else {
            const lastProgram = this.programService.getCurrentProgram();
            if (!lastProgram) {
                return;
            }
            const prevActiveIndex =
                this.vms.ideViewModelState.previousActiveSegmentIndex() >= 0
                    ? this.vms.ideViewModelState.previousActiveSegmentIndex()
                    : 0;
            const activeSegment = lastProgram.segments.find(
                (_s, index) => index === prevActiveIndex
            );
            if (!activeSegment) {
                return;
            }

            if (activeSegment.type === item.segmentType) {
                const newActiveSegment = { ...activeSegment };
                const text = `${newActiveSegment.text}\n\n${item.text[this.vms.persistenceViewModelState.language()]}`;
                this.programService.changeSegmentTextByPositionIndex(
                    prevActiveIndex,
                    text
                );
            } else {
                const place = prevActiveIndex >= 1 ? prevActiveIndex - 1 : 0;
                this.programService.addSegmentAfterIndex(
                    {
                        id: 0,
                        parameters: {
                            visible: true,
                            hideArray: false,
                            hideAssignmentWithValues: false,
                            hideGeneralFormula: false,
                            hideInflAssignment: false,
                            hideInflAssignmentWithValues: false,
                        },
                        text: item.text[
                            this.vms.persistenceViewModelState.language()
                        ],
                        type: item.segmentType,
                    },
                    place
                );
            }
        }
    };

    onExpandErrorsClicked = () => {
        this.vms.settingsViewModelState.setExpandProblemViewer(
            !this.vms.settingsViewModelState.expandProblemViewer()
        );
    };

    onCrossButtonInFileManagerClicked = () => {
        this.vms.settingsViewModelState.setShowFileManager(false);
    };

    onUploadFile = async (file: File) => {
        this.vms.settingsViewModelState.setIsFileDraggedToFileManager(false);
        const project = this.vms.projectViewModelState.project();
        if (!project) {
            return;
        }

        checkFile(file, this.vms.dictionary);
        const name = file.name;
        const formData = new FormData();
        formData.append('file', file);

        const result = await this.rpi.uploadFileRequest(
            formData,
            project.projectId,
            name
        );
        if (result.code === 413) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.tooBigFile.replace(
                    '${replace1}',
                    '10Mb'
                ),
                'error'
            );
        }
        if (result.code === 409) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.tooMuchFiles,
                'error'
            );
        }
        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
        }
    };

    onDeleteFile = async (fileName: string) => {
        const project = this.vms.projectViewModelState.project();
        if (!project) {
            return;
        }
        const result = await this.rpi.deleteFileRequest(
            fileName,
            project.projectId
        );
        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
        }
    };

    onFileNameChanged = async (oldName: string, newName: string) => {
        this.vms.settingsViewModelState.setEditModeForFilename(false);
        const project = this.vms.projectViewModelState.project();
        if (!project || oldName === newName) {
            return;
        }

        const result = await this.rpi.renameFileRequest(
            oldName,
            newName,
            project.projectId
        );
        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
        }
    };

    onFileRenameButtonClicked = () => {
        this.vms.settingsViewModelState.setEditModeForFilename(true);
    };

    onRowClickedInProjectsList = async (projectId: string) => {
        this.vms.navigate(Routes.Project.replace(':id', projectId));
        await this.startupService.openProjectById(
            {
                isAuthenticated: this.vms.userViewModelState.isAuthenticated(),
                id: this.vms.userViewModelState.id(),
                email: this.vms.userViewModelState.email(),
            },
            projectId
        );
    };

    onProjectTitleChanged = async (
        projectId: string,
        title: string,
        okCallback: () => void,
        failCallback: () => void
    ) => {
        const titleToSend = title.trim();
        if (!titleToSend) {
            this.vms.toast(
                this.vms.dictionary.projects.errors.empty_name,
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
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
            return;
        }
        if (result.isOk) {
            const project = this.vms.projectViewModelState.project();
            if (project) {
                this.vms.projectViewModelState.setProject({
                    ...project,
                    title: title,
                });
                this.vms.projectViewModelState.setReadOnly(false);
            }
            okCallback();
        }

        await this.loaderService.loadProjects();
    };

    onProjectCreate = async (
        projectName: string,
        okCallback: () => void,
        errorCallback: (message: string) => void
    ) => {
        const projectNameToSend = projectName.trim();
        if (!projectNameToSend) {
            errorCallback(this.vms.dictionary.create_modal.error.empty_name);
            return;
        }

        const emptyProject: Program = {
            segments: [],
            parameters: {
                roundStrategy: 'noRound',
            },
        };

        const result = await this.rpi.createProjectRequest(
            projectName,
            emptyProject
        );
        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
        }
        if (result.isOk) {
            this.vms.navigate(
                Routes.Project.replace(
                    ':id',
                    (result.body as Project).projectId + ''
                )
            );
            okCallback();
        } else {
            const message =
                result.code === 417
                    ? this.vms.dictionary.create_modal.error.too_many_projects
                    : result.code.toString();
            errorCallback(message);
        }
    };

    onBackButtonClicked = async () => {
        this.vms.projectViewModelState.resetToInitialState();
        this.vms.navigate(Routes.Projects);
    };

    onProjectVisibilityChange = async (visible: boolean) => {
        const project = this.vms.projectViewModelState.project();
        if (!project) return;

        const result = await this.rpi.setProjectVisibilityRequest(
            project.projectId,
            visible
        );

        if (result.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
        }

        if (result.isOk) {
            this.vms.projectViewModelState.setProject({
                ...project,
                isPublic: visible,
            });
            this.vms.projectViewModelState.setReadOnly(false);
        }
    };

    onDeleteProject = async (projectId: string, okCallback: () => void) => {
        const result1 = await this.rpi.deleteProjectRequest(projectId);
        if (result1.isOk) {
            okCallback();
            const result2 = await this.rpi.getAllProjectsRequest();
            if (result2.isOk) {
                this.vms.projectsViewModelState.setProjects(
                    (result2.body as { projects: Array<Project> }).projects
                );
            }
            if (result2.isUnauth) {
                this.vms.toast(
                    this.vms.dictionary.filemanager.errors.sessionExpired,
                    'error'
                );
                this.vms.resetToInitialState();
            }
        }
        if (result1.isUnauth) {
            this.vms.toast(
                this.vms.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.vms.resetToInitialState();
        }
    };

    onProgramUpdated = (program: Program) => {
        this.vms.projectViewModelState.setCurrentProgram(program);
        if (
            !this.vms.userViewModelState.isAuthenticated() &&
            !this.vms.projectViewModelState.projectIsReadonly()
        ) {
            this.vms.persistenceViewModelState.setLastProgram(program);
        } else {
            this.vms.persistenceViewModelState.clearLastProgram();
        }

        if (!program.segments.find((s) => s.type === 'computational')) {
            this.vms.projectViewModelState.setCompileResult({
                segments: program.segments.map(
                    (inputSegment): TextOutputSegment => ({
                        text: inputSegment.text,
                        type: inputSegment.type,
                        id: inputSegment.id,
                    })
                ),
            });
        }
    };
}
