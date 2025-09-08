import { Routes } from './routes.ts';
import {
    Program,
    ProgramRoundStrategy,
    Project,
    SegmentType,
} from '../model/domain.ts';
import { LoaderService } from './project.ts';
import { ExampleService } from './example.ts';
import { FileService } from './file.ts';
import { HeaderHelpItem } from '../model/help';
import { Rpi } from '../model/rpi';
import { ProgramService } from '../model/service/program.ts';
import { IdeService } from './ide.ts';
import { StartupService } from './init.ts';
import { CompilationService } from './compile.ts';
import { ViewModelRepository } from './repository';
import { Events, ObserverService } from '../model/service/observer.ts';
import { AuthService } from './auth.ts';

export class SystemService {
    repository: ViewModelRepository;
    rpi: Rpi;
    programService: ProgramService;
    loaderService: LoaderService;
    ideService: IdeService;
    startupService: StartupService;
    compilationService: CompilationService;
    observerService: ObserverService;
    authService: AuthService;
    fileService: FileService;
    exampleService: ExampleService;

    constructor(
        repository: ViewModelRepository,
        rpi: Rpi,
        programService: ProgramService,
        loaderService: LoaderService,
        ideService: IdeService,
        startupService: StartupService,
        compilationService: CompilationService,
        observerService: ObserverService,
        authService: AuthService,
        fileService: FileService,
        exampleService: ExampleService
    ) {
        this.rpi = rpi;
        this.programService = programService;
        this.loaderService = loaderService;
        this.ideService = ideService;
        this.startupService = startupService;
        this.compilationService = compilationService;
        this.repository = repository;
        this.observerService = observerService;
        this.authService = authService;
        this.fileService = fileService;
        this.exampleService = exampleService;
    }

    onAppEnterWithOauthCode = async (code: string, state: string) => {
        const response = await this.rpi.oauthCodeRequest(code, state);

        if (!response.isOk) {
            this.repository.authViewModelRepository.setCurrentView('login');
            this.repository.authViewModelRepository.setLoginRequest(
                'oauth_error'
            );
        }

        await this.startupService.onAppStartup();
    };

    onFormLoginClicked = async (
        userName: string,
        password: string,
        captcha: string
    ) => {
        this.repository.authViewModelRepository.setLoginRequest('loading');
        const response = await this.rpi.formLoginRequest(
            userName,
            password,
            captcha
        );

        if (response.isOk) {
            this.repository.authViewModelRepository.setLoginRequest('ok');
            await this.startupService.onAppStartup();
            this.repository.authViewModelRepository.setCurrentView('closed');
        } else if (response.code === 401) {
            this.repository.authViewModelRepository.setLoginRequest(
                'bad_credentials'
            );
        } else {
            this.repository.authViewModelRepository.setLoginRequest(
                'unknownError'
            );
        }
    };

    onOauthLogin = async () => {
        this.repository.persistenceViewModelRepository.setLastOpenedProjectUuid(
            this.repository.projectViewModelRepository.project()?.projectId
        );
    };

    onLogoutButtonClicked = async () => {
        const response = await this.rpi.logoutRequest();

        if (response.isOk) {
            this.ideService.resetEditor();
            this.repository.navigate(Routes.ProjectDefault);
            this.repository.projectViewModelRepository.setReadOnly(false);
        }
    };

    onAuthButtonClicked = async () => {
        this.repository.authViewModelRepository.setCurrentView('login');
        this.authService.restartPasswordPipeline();
    };

    onAuthClosed = async () => {
        this.repository.authViewModelRepository.setCurrentView('closed');
        this.authService.restartPasswordPipeline();
    };

    onRegistrationButtonClicked = async () => {
        this.repository.authViewModelRepository.setCurrentView('email');
        this.repository.authViewModelRepository.setIsRegistration(true);
        this.authService.restartPasswordPipeline();
    };

    onForgotPasswordButtonClicked = async () => {
        this.repository.authViewModelRepository.setCurrentView('email');
        this.repository.authViewModelRepository.setIsRegistration(false);
        this.authService.restartPasswordPipeline();
    };

    onEmailSendButtonClicked = async (email: string, captcha: string) => {
        this.repository.authViewModelRepository.setCurrentEmail(null);
        this.repository.authViewModelRepository.setEmailRequest('loading');
        const result = await this.rpi.sendEmailWithCodeRequest(
            email,
            this.repository.authViewModelRepository.isRegistration(),
            this.repository.persistenceViewModelRepository.language(),
            captcha
        );

        if (result.isOk) {
            this.repository.authViewModelRepository.setEmailRequest('ok');
            this.repository.authViewModelRepository.setCurrentEmail(email);
            this.repository.authViewModelRepository.setCurrentView('code');
        } else if (result.code === 404) {
            this.repository.authViewModelRepository.setEmailRequest(
                'userNotFound'
            );
        } else if (result.code === 409) {
            this.repository.authViewModelRepository.setEmailRequest(
                'userExists'
            );
        } else if (result.code === 400) {
            this.repository.authViewModelRepository.setEmailRequest(
                'validationError'
            );
        } else {
            this.repository.authViewModelRepository.setEmailRequest(
                'unknownError'
            );
        }
    };

    onSendPasswordButtonClicked = async (password: string) => {
        this.repository.authViewModelRepository.setPasswordRequest('loading');
        const result = await this.rpi.setPasswordRequest(
            this.repository.authViewModelRepository.currentEmail() || '',
            this.repository.authViewModelRepository.lastVerifiedCode() || '',
            password,
            this.repository.authViewModelRepository.isRegistration()
        );

        if (result.isOk) {
            this.repository.authViewModelRepository.setPasswordRequest('ok');
            this.repository.authViewModelRepository.setCurrentView('success');
        } else if (result.code === 404) {
            this.repository.authViewModelRepository.setPasswordRequest(
                'userNotFound'
            );
        } else if (result.code === 409) {
            this.repository.authViewModelRepository.setPasswordRequest(
                'userExists'
            );
        } else if (result.code === 400) {
            this.repository.authViewModelRepository.setPasswordRequest(
                'validationError'
            );
        } else {
            this.repository.authViewModelRepository.setPasswordRequest(
                'unknownError'
            );
        }
    };

    onSendCodeButtonClicked = async (code: string) => {
        this.repository.authViewModelRepository.setLastVerifiedCode(null);
        this.repository.authViewModelRepository.setCodeCheckRequest('loading');
        const result = await this.rpi.checkCodeRequest(
            this.repository.authViewModelRepository.currentEmail() || '',
            code
        );

        if (result.isOk) {
            this.repository.authViewModelRepository.setCodeCheckRequest('ok');
            this.repository.authViewModelRepository.setLastVerifiedCode(code);
            this.repository.authViewModelRepository.setCurrentView('password');
        } else {
            this.repository.authViewModelRepository.setCodeCheckRequest(
                'invalid'
            );
        }
    };

    onAppStartup = async (from?: string) => {
        await this.startupService.onAppStartup(from);
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

    segmentEditorSaveProgram = async (): Promise<void> => {
        if (this.repository.projectViewModelRepository.projectIsReadonly()) {
            return;
        }
        const savedProgram = this.programService.getCurrentProgram();
        const project = this.repository.projectViewModelRepository.project();
        if (project) {
            const result = await this.rpi.saveProgramRequest(
                project.projectId,
                savedProgram
            );
            if (result.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
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
        this.ideService.onProgramUpdated();
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
        this.ideService.onProgramUpdated();
    };

    deleteSegment = async (segmentIndex: number) => {
        this.programService.deleteSegmentByIndex(segmentIndex);
        await this.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
    };

    onAddedFilesToSegmentEditor = async (
        items: DataTransferItemList,
        segmentIndex: number,
        editorCallback: (insert: string) => void
    ) => {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        const thisCopy = this;
        for (const item of items) {
            await new Promise((reslv) => {
                try {
                    if (item.kind === 'file') {
                        const project =
                            this.repository.projectViewModelRepository.project();
                        if (!project) {
                            this.repository.toast(
                                this.repository.dictionary.segment.errors
                                    .non_authorized_paste_image,
                                'error'
                            );
                            return reslv(null);
                        }
                        const file = item.getAsFile();
                        if (!file) {
                            return reslv(null);
                        }
                        this.fileService.checkFile(
                            file,
                            this.repository.dictionary
                        );
                        const reader = new FileReader();
                        reader.onload = async function () {
                            const fileToUpload = file;
                            const name =
                                thisCopy.fileService.calculateNumberFile(
                                    segmentIndex + 1,
                                    file.name
                                );
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
                                thisCopy.repository.toast(
                                    thisCopy.repository.dictionary.filemanager.errors.tooBigFile.replace(
                                        '${replace1}',
                                        '10Mb'
                                    ),
                                    'error'
                                );
                                reslv(null);
                            }
                            if (res.code === 409) {
                                thisCopy.repository.toast(
                                    thisCopy.repository.dictionary.filemanager
                                        .errors.tooMuchFiles,
                                    'error'
                                );
                                reslv(null);
                            }
                            if (res.isUnauth) {
                                thisCopy.repository.toast(
                                    thisCopy.repository.dictionary.filemanager
                                        .errors.sessionExpired,
                                    'error'
                                );
                                thisCopy.ideService.resetEditor();
                                reslv(null);
                            }
                            if (res.isForbidden) {
                                thisCopy.repository.toast(
                                    thisCopy.repository.dictionary.filemanager
                                        .errors.notEnoughRights,
                                    'error'
                                );
                                thisCopy.ideService.resetEditor();
                                reslv(null);
                            }

                            if (res.isOk) {
                                const lastProgram =
                                    thisCopy.programService.getCurrentProgram();
                                const url = res.body;
                                const segmentType =
                                    lastProgram.segments[segmentIndex]?.type;
                                let itemToInsert = '';
                                switch (segmentType) {
                                    case 'md':
                                        if (file.type.includes('image')) {
                                            itemToInsert = `!['image.png'](${url})`;
                                        }
                                        break;
                                    case 'computational':
                                    default: {
                                        if (file.type.includes('image')) {
                                            itemToInsert = `image("${url}")`;
                                        } else {
                                            itemToInsert = `load_csv("${filename}")`;
                                        }
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

    onSegmentAddedViaDivider = async (
        segmentType: SegmentType,
        after: number
    ) => {
        // TODO observer service call
        this.programService.addSegmentAfterIndex(segmentType, after);
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(after + 1);
        await this.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
    };

    onFocusSegment = async (segmentIndex: number) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
    };

    onBlurSegment = async (segmentIndex: number, segmentText: string) => {
        if (
            this.repository.ideViewModelRepository.activeSegmentIndex() ===
            segmentIndex
        ) {
            this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
        }
        this.programService.changeSegmentTextByPositionIndex(
            segmentIndex,
            segmentText
        );
        await this.segmentEditorSaveProgram();
        this.ideService.onProgramUpdated();
    };

    onSegmentTextEdited = async (segmentIndex: number, segmentText: string) => {
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(
            segmentIndex
        );
        this.programService.changeSegmentTextByPositionIndex(
            segmentIndex,
            segmentText
        );

        this.ideService.onSegmentUpdate(segmentIndex, segmentText);
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
        this.programService.addSegmentToLastPosition(type);
        this.repository.ideViewModelRepository.setActiveSegmentIndex(
            this.programService.getCurrentProgram().segments.length
        );
        this.ideService.onProgramUpdated();
        this.repository.scrollEditorToBottom();
    };

    onFolderButtonClicked = async () => {
        const project = this.repository.projectViewModelRepository.project();
        if (
            project &&
            this.repository.userViewModelRepository.isAuthenticated()
        ) {
            this.repository.settingsViewModelRepository.setShowFileManager(
                true
            );
            await this.loaderService.loadFiles(project.projectId);
        } else {
            this.repository.authViewModelRepository.setCurrentView('login');
        }
    };

    onPrevVersionButtonClicked = () => {
        this.programService.undo();
        this.ideService.onProgramUpdated();
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
    };

    onNextVersionButtonClicked = () => {
        this.programService.redo();
        this.ideService.onProgramUpdated();
        this.ideService.setActiveSegmentIndexAndPreviousSegmentIndex(-1);
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

    onRoundStrategySet = (strategy: ProgramRoundStrategy) => {
        this.programService.changeRoundStrategy(strategy);
        this.ideService.onProgramUpdated();
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

    onCrossButtonInFileManagerClicked = () => {
        this.repository.settingsViewModelRepository.setShowFileManager(false);
    };

    onUploadFile = async (file: File) => {
        this.repository.settingsViewModelRepository.setIsFileDraggedToFileManager(
            false
        );
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }

        this.fileService.checkFile(file, this.repository.dictionary);
        const name = file.name;
        const formData = new FormData();
        formData.append('file', file);

        const result = await this.rpi.uploadFileRequest(
            formData,
            project.projectId,
            name
        );
        if (result.code === 413) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.tooBigFile.replace(
                    '${replace1}',
                    '10Mb'
                ),
                'error'
            );
        }
        if (result.code === 409) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.tooMuchFiles,
                'error'
            );
        }
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
        }
    };

    onDeleteFile = async (fileName: string) => {
        const project = this.repository.projectViewModelRepository.project();
        if (!project) {
            return;
        }
        const result = await this.rpi.deleteFileRequest(
            fileName,
            project.projectId
        );
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
        }
    };

    onFileNameChanged = async (oldName: string, newName: string) => {
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            false
        );
        const project = this.repository.projectViewModelRepository.project();
        if (!project || oldName === newName) {
            return;
        }

        const result = await this.rpi.renameFileRequest(
            oldName,
            newName,
            project.projectId
        );
        if (result.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
        if (result.isOk) {
            await this.loaderService.loadFiles(project.projectId);
        }
    };

    onFileRenameButtonClicked = () => {
        this.repository.settingsViewModelRepository.setEditModeForFilename(
            true
        );
    };

    onRowClickedInProjectsList = async (projectId: string) => {
        this.repository.navigate(Routes.Project.replace(':id', projectId));
        await this.startupService.openProjectById(
            {
                isAuthenticated:
                    this.repository.userViewModelRepository.isAuthenticated(),
                id: this.repository.userViewModelRepository.id(),
                email: this.repository.userViewModelRepository.email(),
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

    onProjectCreate = async (
        projectName: string,
        okCallback: () => void,
        errorCallback: (message: string) => void
    ) => {
        const projectNameToSend = projectName.trim();
        if (!projectNameToSend) {
            errorCallback(
                this.repository.dictionary.create_modal.error.empty_name
            );
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
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
        }
        if (result.isOk) {
            this.repository.navigate(
                Routes.Project.replace(':id', result.body.projectId + '')
            );
            this.repository.projectViewModelRepository.setProject(result.body);
            await this.loaderService.loadProjects();
            this.repository.projectViewModelRepository.setReadOnly(false);
            okCallback();
        } else {
            const message =
                result.code === 417
                    ? this.repository.dictionary.create_modal.error
                          .too_many_projects
                    : result.code.toString();
            errorCallback(message);
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

    onDeleteProject = async (projectId: string, okCallback: () => void) => {
        const result1 = await this.rpi.deleteProjectRequest(projectId);
        if (result1.isOk) {
            okCallback();
            const result2 = await this.rpi.getAllProjectsRequest();
            if (result2.isOk) {
                this.repository.projectsViewModelRepository.setProjects(
                    (result2.body as { projects: Array<Project> }).projects
                );
            }
            if (result2.isUnauth) {
                this.repository.toast(
                    this.repository.dictionary.filemanager.errors
                        .sessionExpired,
                    'error'
                );
                this.ideService.resetEditor();
            }
        }
        if (result1.isUnauth) {
            this.repository.toast(
                this.repository.dictionary.filemanager.errors.sessionExpired,
                'error'
            );
            this.ideService.resetEditor();
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

    onProgramSaveTimeout = async () => {
        await this.segmentEditorSaveProgram();
    };

    onQrPageEnter = (version: string) => {
        if (version === 'v1') {
            this.observerService.onEvent(Events.EVENT_QR_V1);
        }
    };

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
}
