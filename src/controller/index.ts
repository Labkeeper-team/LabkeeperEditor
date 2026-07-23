import { createAsyncThunk } from '@reduxjs/toolkit';
import {
    OpenParams,
    ProgramRoundStrategy,
    ProjectType,
    SegmentType,
} from '../model/domain.ts';
import { HeaderHelpItem } from '../model/help';
import * as Sentry from '@sentry/react';
import { Events, ObserverService } from '../model/service/ObserverService.ts';
import { AuthService } from '../viewModel/operation/AuthService.ts';
import { FileManagerService } from '../viewModel/operation/FileManagerService.ts';
import { TextFileEditorService } from '../viewModel/operation/TextFileEditorService.ts';
import { ProgramEditorService } from '../viewModel/operation/ProgramEditorService.ts';
import { ProjectPageService } from '../viewModel/operation/ProjectPageService.ts';
import { ProjectsPageService } from '../viewModel/operation/ProjectsPageService.ts';
import { StartupService } from '../viewModel/operation/StartupService.ts';

export class Controller {
    authService: AuthService;
    fileManagerService: FileManagerService;
    textFileEditorService: TextFileEditorService;
    programEditorService: ProgramEditorService;
    projectPageService: ProjectPageService;
    projectsPageService: ProjectsPageService;
    startupService: StartupService;
    observerService: ObserverService;

    constructor(
        authService: AuthService,
        fileManagerService: FileManagerService,
        textFileEditorService: TextFileEditorService,
        programEditorService: ProgramEditorService,
        projectPageService: ProjectPageService,
        projectsPageService: ProjectsPageService,
        startupService: StartupService,
        observerService: ObserverService
    ) {
        this.observerService = observerService;
        this.authService = authService;
        this.fileManagerService = fileManagerService;
        this.textFileEditorService = textFileEditorService;
        this.programEditorService = programEditorService;
        this.projectPageService = projectPageService;
        this.projectsPageService = projectsPageService;
        this.startupService = startupService;
    }

    onFormLoginClickedRequest = createAsyncThunk(
        'onFormLoginClicked',
        async ({
            userName,
            password,
            captcha,
        }: {
            userName: string;
            password: string;
            captcha?: string;
        }) => {
            this.wrapper('onFormLoginClicked', () =>
                this.authService.onFormLoginClicked(userName, password, captcha)
            );
        }
    );

    onQrPageEnterRequest = createAsyncThunk(
        'onQrPageEnter',
        async ({ version }: { version: string }) => {
            this.wrapper('onQrPageEnter', () =>
                this.startupService.onQrPageEnter(version)
            );
        }
    );

    onProgramSaveTimeoutRequest = createAsyncThunk(
        'onProgramSaveTimeout',
        async () => {
            this.wrapper('onProgramSaveTimeout', () =>
                this.programEditorService.onProgramSaveTimeout()
            );
        }
    );

    onAppEnterWithOauthCodeRequest = createAsyncThunk(
        'onAppEnterWithOauthCode',
        async ({ code, state }: { code: string; state: string }) => {
            this.wrapper('onAppEnterWithOauthCode', () =>
                this.startupService.onAppEnterWithOauthCode(code, state)
            );
        }
    );

    onLogoutButtonClickedRequest = createAsyncThunk(
        'onLogoutButtonClicked',
        async () => {
            this.wrapper('onLogoutButtonClicked', () =>
                this.authService.onLogoutButtonClicked()
            );
        }
    );

    onAuthButtonClickedRequest = createAsyncThunk(
        'onAuthButtonClicked',
        async () => {
            this.wrapper('onAuthButtonClicked', () =>
                this.authService.onAuthButtonClicked()
            );
        }
    );

    onAuthClosedRequest = createAsyncThunk('onAuthClosed', async () => {
        this.wrapper('onAuthClosed', () => this.authService.onAuthClosed());
    });

    onRegistrationButtonClickedRequest = createAsyncThunk(
        'onRegistrationButtonClicked',
        async () => {
            this.wrapper('onRegistrationButtonClicked', () =>
                this.authService.onRegistrationButtonClicked()
            );
        }
    );

    onForgotPasswordButtonClickedRequest = createAsyncThunk(
        'onForgotPasswordButtonClicked',
        async () => {
            this.wrapper('onForgotPasswordButtonClicked', () =>
                this.authService.onForgotPasswordButtonClicked()
            );
        }
    );

    onEmailSendButtonClickedRequest = createAsyncThunk(
        'onEmailSendButtonClicked',
        async ({ email, captcha }: { email: string; captcha: string }) => {
            this.wrapper('onEmailSendButtonClicked', () =>
                this.authService.onEmailSendButtonClicked(email, captcha)
            );
        }
    );

    onSendPasswordButtonClickedRequest = createAsyncThunk(
        'onSendPasswordButtonClicked',
        async ({ password }: { password: string }) => {
            this.wrapper('onSendPasswordButtonClicked', () =>
                this.authService.onSendPasswordButtonClicked(password)
            );
        }
    );

    onSendCodeButtonClickedRequest = createAsyncThunk(
        'onSendCodeButtonClicked',
        async ({ code }: { code: string }) => {
            this.wrapper('onSendCodeButtonClicked', () =>
                this.authService.onSendCodeButtonClicked(code)
            );
        }
    );

    onAppEnterRequest = createAsyncThunk(
        'onAppEnter',
        async ({ captcha, open }: { captcha?: string; open?: OpenParams }) => {
            this.wrapper('onAppEnter', () =>
                this.startupService.onAppStartup(captcha, open)
            );
        }
    );

    onOpenEditorAfterSpaNavigationRequest = createAsyncThunk(
        'onOpenEditorAfterSpaNavigation',
        async () => {
            this.wrapper('onOpenEditorAfterSpaNavigation', () => {
                void this.startupService.openEditorAfterSpaNavigation();
            });
        }
    );

    onPrintButtonPressedRequest = createAsyncThunk(
        'onPrintButtonPressedRequest',
        async () => {
            this.wrapper('onPrintButtonPressedRequest', () =>
                this.projectPageService.onPrintButtonPressed()
            );
        }
    );

    onProjectPageEscButtonClickedRequest = createAsyncThunk(
        'onProjectPageEscButtonClicked',
        async () => {
            this.wrapper('onProjectPageEscButtonClicked', () =>
                this.projectPageService.onProjectPageEscButtonPressed()
            );
        }
    );

    onUndefinedError = () => {
        this.observerService.onEvent(Events.FRONTEND_ERROR);
    };

    onRunButtonPressedRequest = createAsyncThunk(
        'onRunButtonPressed',
        async () => {
            this.wrapper('onRunButtonPressed', () =>
                this.projectPageService.onRunButtonClicked()
            );
        }
    );

    onPromptSubmitRequest = createAsyncThunk(
        'onPromptSubmit',
        async ({
            prompt,
            generateImage,
        }: {
            prompt: string;
            generateImage: boolean;
        }) => {
            this.wrapper('onRunButtonPressed', () =>
                this.projectPageService.sendPromptAndReload(
                    prompt,
                    generateImage
                )
            );
        }
    );

    onPrivacyPolicyAcceptedRequest = createAsyncThunk(
        'onPrivacyPolicyAccepted',
        async () => {
            this.wrapper('onPrivacyPolicyAccepted', () =>
                this.projectPageService.onPrivacyPolicyAccepted()
            );
        }
    );

    onLlmButtonClickedRequest = createAsyncThunk(
        'onLlmButtonClicked',
        async () => {
            this.wrapper('onLlmButtonClicked', () =>
                this.projectPageService.onLlmButtonClicked()
            );
        }
    );

    onPromptModalCrossClickedRequest = createAsyncThunk(
        'onPromptModalCrossClicked',
        async () => {
            this.wrapper('onPromptModalCrossClicked', () =>
                this.projectPageService.onPromptModalCrossClicked()
            );
        }
    );

    segmentEditorChangeSegmentPositionRequest = createAsyncThunk(
        'segmentEditorChangeSegmentPositionRequest',
        async ({
            direction,
            segmentIndex,
        }: {
            direction: 'down' | 'up';
            segmentIndex: number;
        }) => {
            this.wrapper('segmentEditorChangeSegmentPositionRequest', () =>
                this.programEditorService.segmentEditorChangeSegmentPosition(
                    direction,
                    segmentIndex
                )
            );
        }
    );

    segmentEditorChangeSegmentVisibilityRequest = createAsyncThunk(
        'segmentEditorChangeSegmentVisibilityRequest',
        async ({
            visible,
            parameterName,
            segmentIndex,
        }: {
            visible: boolean;
            parameterName: string;
            segmentIndex: number;
        }) => {
            this.wrapper('segmentEditorChangeSegmentVisibilityRequest', () =>
                this.programEditorService.segmentEditorChangeSegmentVisibility(
                    visible,
                    parameterName,
                    segmentIndex
                )
            );
        }
    );

    deleteSegmentRequest = createAsyncThunk(
        'deleteSegmentRequest',
        async ({ segmentIndex }: { segmentIndex: number }) => {
            this.wrapper('deleteSegmentRequest', () =>
                this.programEditorService.deleteSegment(segmentIndex)
            );
        }
    );

    onAddedFilesToSegmentEditorRequest = createAsyncThunk(
        'onAddedFilesToSegmentEditorRequest',
        async ({
            items,
            segmentIndex,
            cursorPosition,
        }: {
            items: DataTransferItemList;
            segmentIndex: number;
            cursorPosition: number;
        }) => {
            this.wrapper('onAddedFilesToSegmentEditorRequest', () =>
                this.programEditorService.onAddedFilesToSegmentEditor(
                    items,
                    segmentIndex,
                    cursorPosition
                )
            );
        }
    );

    onSegmentAddedViaDividerRequest = createAsyncThunk(
        'onSegmentAdded',
        async ({
            segmentType,
            after,
        }: {
            segmentType: SegmentType;
            after: number;
        }) => {
            this.wrapper('onSegmentAdded', () =>
                this.programEditorService.onSegmentAddedViaDivider(
                    segmentType,
                    after
                )
            );
        }
    );

    onAddLatexBoundarySegmentRequest = createAsyncThunk(
        'onAddLatexBoundarySegmentRequest',
        async ({
            text,
            placement,
        }: {
            text: string;
            placement: 'start' | 'end';
        }) => {
            this.wrapper('onAddLatexBoundarySegmentRequest', () =>
                this.programEditorService.addLatexBoundarySegment(
                    text,
                    placement
                )
            );
        }
    );

    onSyncEditorToPdfRequest = createAsyncThunk(
        'onSyncEditorToPdfRequest',
        async () => {
            this.wrapper('onSyncEditorToPdfRequest', () =>
                this.programEditorService.onSyncEditorToPdf()
            );
        }
    );

    onSyncPdfToEditorRequest = createAsyncThunk(
        'onSyncPdfToEditorRequest',
        async () => {
            this.wrapper('onSyncPdfToEditorRequest', () =>
                this.programEditorService.onSyncPdfToEditor()
            );
        }
    );

    onFocusSegmentRequest = createAsyncThunk(
        'onFocusSegmentRequest',
        async ({ segmentIndex }: { segmentIndex: number }) => {
            this.wrapper('onFocusSegmentRequest', () =>
                this.programEditorService.onFocusSegment(segmentIndex)
            );
        }
    );

    onBlurSegmentRequest = createAsyncThunk(
        'onBlurSegmentRequest',
        async ({ segmentIndex }: { segmentIndex: number }) => {
            this.wrapper('onBlurSegmentRequest', () =>
                this.programEditorService.onBlurSegment(segmentIndex)
            );
        }
    );

    onSegmentTextChangedRequest = createAsyncThunk(
        'onSegmentTextChanged',
        async ({
            segmentIndex,
            segmentText,
            cursorHead,
        }: {
            segmentIndex: number;
            segmentText: string;
            /** Позиция курсора в segmentText (для корректного undo после больших вставок). */
            cursorHead?: number;
        }) => {
            this.wrapper('onSegmentTextChanged', () =>
                this.programEditorService.onSegmentTextEdited(
                    segmentIndex,
                    segmentText,
                    cursorHead
                )
            );
        }
    );

    onAddSegmentButtonClickedRequest = createAsyncThunk(
        'onAddSegmentButtonClickedRequest',
        async ({ type }: { type: SegmentType }) => {
            this.wrapper('onAddSegmentButtonClickedRequest', () =>
                this.programEditorService.onAddSegmentClicked(type)
            );
        }
    );

    onFolderButtonClickedRequest = createAsyncThunk(
        'onFolderButtonClickedRequest',
        async () => {
            this.wrapper('onFolderButtonClickedRequest', () =>
                this.fileManagerService.onFolderButtonClicked()
            );
        }
    );

    onPrevVersionButtonClickedRequest = createAsyncThunk(
        'onPrevVersionButtonClickedRequest',
        async () => {
            this.wrapper('onPrevVersionButtonClickedRequest', () =>
                this.programEditorService.onPrevVersionButtonClicked()
            );
        }
    );

    onNextVersionButtonClickedRequest = createAsyncThunk(
        'onNextVersionButtonClickedRequest',
        async () => {
            this.wrapper('onNextVersionButtonClickedRequest', () =>
                this.programEditorService.onNextVersionButtonClicked()
            );
        }
    );

    onDeleteFilesConfirmRequest = createAsyncThunk(
        'onDeleteFilesConfirmRequest',
        async () => {
            this.wrapper('onDeleteFilesConfirmRequest', () =>
                this.fileManagerService.onConfirmDeleteFiles()
            );
        }
    );

    onDeleteFilesCancelRequest = createAsyncThunk(
        'onDeleteFilesCancelRequest',
        async () => {
            this.wrapper('onDeleteFilesCancelRequest', () =>
                this.fileManagerService.onCancelDeleteFiles()
            );
        }
    );

    onSearchIconPressRequest = createAsyncThunk(
        'onSearchIconPressRequest',
        async () => {
            this.wrapper('onSearchIconPressRequest', () =>
                this.projectPageService.onSearchIconPress()
            );
        }
    );

    onSearchInputChangedRequest = createAsyncThunk(
        'onSearchInputChangedRequest',
        async ({ text }: { text: string }) => {
            this.wrapper('onSearchInputChangedRequest', () =>
                this.projectPageService.onSearchInputChanged(text)
            );
        }
    );

    onOauthLoginRequest = createAsyncThunk('onOauthLoginRequest', async () => {
        this.wrapper('onOauthLoginRequest', () =>
            this.authService.onOauthLogin()
        );
    });

    onRoundStrategySetRequest = createAsyncThunk(
        'onRoundStrategySetRequest',
        async ({ strategy }: { strategy: ProgramRoundStrategy }) => {
            this.wrapper('onRoundStrategySetRequest', () =>
                this.programEditorService.onRoundStrategySet(strategy)
            );
        }
    );

    onHelpItemCreatedRequest = createAsyncThunk(
        'onHelpItemCreatedRequest',
        async ({ item }: { item: HeaderHelpItem }) => {
            this.wrapper('onHelpItemCreatedRequest', () =>
                this.projectPageService.onHelpItemCreated(item)
            );
        }
    );

    onExpandErrorsClickedRequest = createAsyncThunk(
        'onExpandErrorsClickedRequest',
        async () => {
            this.wrapper('onExpandErrorsClickedRequest', () =>
                this.projectPageService.onExpandErrorsClicked()
            );
        }
    );

    onCrossButtonInFileManagerClickedRequest = createAsyncThunk(
        'onCrossButtonInFileManagerClickedRequest',
        async () => {
            this.wrapper('onCrossButtonInFileManagerClickedRequest', () =>
                this.fileManagerService.onCrossButtonInFileManagerClicked()
            );
        }
    );

    onUploadFilesRequest = createAsyncThunk(
        'onUploadFilesRequest',
        async ({
            files,
            folderPrefix,
        }: {
            files: File[];
            folderPrefix?: string;
        }) => {
            this.wrapper('onUploadFilesRequest', () =>
                this.fileManagerService.onUploadFiles(files, folderPrefix)
            );
        }
    );

    onCurrentFolderPathChangedRequest = createAsyncThunk(
        'onCurrentFolderPathChangedRequest',
        async ({ path }: { path: string }) => {
            this.wrapper('onCurrentFolderPathChangedRequest', () =>
                this.fileManagerService.onCurrentFolderPathChanged(path)
            );
        }
    );

    onCreateFolderRequest = createAsyncThunk(
        'onCreateFolderRequest',
        async ({ name, parentPath }: { name: string; parentPath: string }) => {
            this.wrapper('onCreateFolderRequest', () =>
                this.fileManagerService.onCreateFolder(name, parentPath)
            );
        }
    );

    onCreateFileRequest = createAsyncThunk('onCreateFileRequest', async () => {
        this.wrapper('onCreateFileRequest', () =>
            this.fileManagerService.onCreateFile()
        );
    });

    onSvarCreateFileRequest = createAsyncThunk(
        'onSvarCreateFileRequest',
        async (ev: {
            file: { name: string; type?: string; file?: File };
            parent: string;
            newId?: string;
        }) => {
            this.wrapper('onSvarCreateFileRequest', () =>
                this.fileManagerService.onSvarCreateFile(ev)
            );
        }
    );

    onSvarDeleteFilesRequest = createAsyncThunk(
        'onSvarDeleteFilesRequest',
        async ({ ids }: { ids: string[] }) => {
            this.wrapper('onSvarDeleteFilesRequest', () =>
                this.fileManagerService.onSvarDeleteFiles(ids)
            );
        }
    );

    onSvarRenameFileRequest = createAsyncThunk(
        'onSvarRenameFileRequest',
        async ({ id, name }: { id: string; name: string }) => {
            this.wrapper('onSvarRenameFileRequest', () =>
                this.fileManagerService.onSvarRenameFile(id, name)
            );
        }
    );

    onSvarMoveFilesRequest = createAsyncThunk(
        'onSvarMoveFilesRequest',
        async ({ ids, target }: { ids: string[]; target: string }) => {
            this.wrapper('onSvarMoveFilesRequest', () =>
                this.fileManagerService.onSvarMoveFiles(ids, target)
            );
        }
    );

    // TODO(3) onMoveFileRequest — thunk для internal tree drag.
    //   A) → onSvarMoveFiles (renameFileRequest × N).
    //   B) → onMoveFile → rpi.moveFileRequest (один запрос).

    onTextFileOpenedRequest = createAsyncThunk(
        'onTextFileOpenedRequest',
        async ({ fileName }: { fileName: string }) => {
            this.wrapper('onTextFileOpenedRequest', () =>
                this.textFileEditorService.onTextFileOpened(fileName)
            );
        }
    );

    onTextFileContentChangedRequest = createAsyncThunk(
        'onTextFileContentChangedRequest',
        async ({ content }: { content: string }) => {
            this.wrapper('onTextFileContentChangedRequest', () =>
                this.textFileEditorService.onTextFileContentChanged(content)
            );
        }
    );

    onTextFileEditorClosedRequest = createAsyncThunk(
        'onTextFileEditorClosedRequest',
        async () => {
            this.wrapper('onTextFileEditorClosedRequest', () =>
                this.textFileEditorService.onTextFileEditorClosed()
            );
        }
    );

    onTextFileSaveTimeoutRequest = createAsyncThunk(
        'onTextFileSaveTimeoutRequest',
        async () => {
            this.wrapper('onTextFileSaveTimeoutRequest', () =>
                this.textFileEditorService.onTextFileSaveTimeout()
            );
        }
    );

    onImageFileOpenedRequest = createAsyncThunk(
        'onImageFileOpenedRequest',
        async ({ fileName }: { fileName: string }) => {
            this.wrapper('onImageFileOpenedRequest', () =>
                this.textFileEditorService.onImageFileOpened(fileName)
            );
        }
    );

    onImageFilePreviewClosedRequest = createAsyncThunk(
        'onImageFilePreviewClosedRequest',
        async () => {
            this.wrapper('onImageFilePreviewClosedRequest', () =>
                this.textFileEditorService.onImageFilePreviewClosed()
            );
        }
    );

    onDeleteFileRequest = createAsyncThunk(
        'onDeleteFileRequest',
        async ({ fileName }: { fileName: string }) => {
            this.wrapper('onDeleteFileRequest', () =>
                this.fileManagerService.onDeleteFile(fileName)
            );
        }
    );

    onFileNameChangedRequest = createAsyncThunk(
        'onFileNameChangedRequest',
        async ({ oldName, newName }: { oldName: string; newName: string }) => {
            this.wrapper('onFileNameChangedRequest', () =>
                this.fileManagerService.onFileNameChanged(oldName, newName)
            );
        }
    );

    onRenameFolderRequest = createAsyncThunk(
        'onRenameFolderRequest',
        async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
            this.wrapper('onRenameFolderRequest', () =>
                this.fileManagerService.onRenameFolder(oldPath, newPath)
            );
        }
    );

    onDeleteFolderRequest = createAsyncThunk(
        'onDeleteFolderRequest',
        async ({ path }: { path: string }) => {
            this.wrapper('onDeleteFolderRequest', () =>
                this.fileManagerService.onDeleteFolder(path)
            );
        }
    );

    onFileRenameButtonClickedRequest = createAsyncThunk(
        'onFileRenameButtonClickedRequest',
        async () => {
            this.wrapper('onFileRenameButtonClickedRequest', () =>
                this.fileManagerService.onFileRenameButtonClicked()
            );
        }
    );

    onRowClickedInProjectsListRequest = createAsyncThunk(
        'onRowClickedInProjectsListRequest',
        async ({ projectId }: { projectId: string }) => {
            this.wrapper('onRowClickedInProjectsListRequest', () =>
                this.projectsPageService.onRowClickedInProjectsList(projectId)
            );
        }
    );

    onProjectTitleChangedRequest = createAsyncThunk(
        'onProjectTitleChangedRequest',
        async ({
            projectId,
            title,
            failCallback,
            okCallback,
        }: {
            projectId: string;
            title: string;
            okCallback: () => void;
            failCallback: () => void;
        }) => {
            this.wrapper('onProjectTitleChangedRequest', () =>
                this.projectPageService.onProjectTitleChanged(
                    projectId,
                    title,
                    okCallback,
                    failCallback
                )
            );
        }
    );

    onProjectVisibilityChangeRequest = createAsyncThunk(
        'onProjectVisibilityChangeRequest',
        async ({ visible }: { visible: boolean }) => {
            this.wrapper('onProjectVisibilityChangeRequest', () =>
                this.projectPageService.onProjectVisibilityChange(visible)
            );
        }
    );

    onProjectCreateRequest = createAsyncThunk(
        'onProjectCreateRequest',
        async ({
            projectName,
            projectType,
            errorCallback,
            okCallback,
        }: {
            projectName: string;
            projectType: ProjectType;
            okCallback: () => void;
            errorCallback: (message: string) => void;
        }) => {
            this.wrapper('onProjectCreateRequest', () =>
                this.projectsPageService.onProjectCreate(
                    projectName,
                    projectType,
                    okCallback,
                    errorCallback
                )
            );
        }
    );

    onBackButtonClickedRequest = createAsyncThunk(
        'onBackButtonClickedRequest',
        async () => {
            this.wrapper('onBackButtonClickedRequest', () =>
                this.projectPageService.onBackButtonClicked()
            );
        }
    );

    onContactUsFormSubmittedRequest = createAsyncThunk(
        'onContactUsFormSubmittedRequest',
        async ({ body, subject }: { body: string; subject: string }) => {
            this.wrapper('onContactUsFormSubmittedRequest', () =>
                this.projectPageService.onContactUsFormSubmitted(subject, body)
            );
        }
    );

    onDeleteProjectRequest = createAsyncThunk(
        'onDeleteProjectRequest',
        async ({
            projectId,
            okCallback,
        }: {
            projectId: string;
            okCallback: () => void;
        }) => {
            this.wrapper('onDeleteProjectRequest', () =>
                this.projectsPageService.onDeleteProject(projectId, okCallback)
            );
        }
    );

    onCloneProjectRequest = createAsyncThunk(
        'onCloneProjectRequest',
        async () => {
            this.wrapper('onCloneProjectRequest', () =>
                this.projectPageService.onCloneProject()
            );
        }
    );

    onProjectModeChangeRequest = createAsyncThunk(
        'onProjectModeChangeRequest',
        async ({ type }: { type: ProjectType }) => {
            this.wrapper('onProjectModeChangeRequest', () =>
                this.projectPageService.setProjectType(type)
            );
        }
    );

    private wrapper = (name: string, method: () => void) => {
        try {
            method();
            console.info(`Invoking system operation [${name}]`);
        } catch (error) {
            this.observerService.onEvent(Events.FRONTEND_ERROR);
            console.error(error);
            Sentry.captureException(error);
        }
    };
}
