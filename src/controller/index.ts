import { createAsyncThunk } from '@reduxjs/toolkit';
import {
    CompileErrorResult,
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
import { TokenPageService } from '../viewModel/operation/TokenPageService.ts';
import { HunkService } from '../viewModel/operation/HunkService.ts';
import { AgentChatService } from '../viewModel/operation/AgentChatService.ts';
import { logBreadcrumb } from '../viewModel/utils/logBreadcrumb.ts';

export class Controller {
    authService: AuthService;
    fileManagerService: FileManagerService;
    textFileEditorService: TextFileEditorService;
    programEditorService: ProgramEditorService;
    projectPageService: ProjectPageService;
    projectsPageService: ProjectsPageService;
    tokenPageService: TokenPageService;
    startupService: StartupService;
    observerService: ObserverService;
    hunkService: HunkService;
    agentChatService: AgentChatService;

    constructor(
        authService: AuthService,
        fileManagerService: FileManagerService,
        textFileEditorService: TextFileEditorService,
        programEditorService: ProgramEditorService,
        projectPageService: ProjectPageService,
        projectsPageService: ProjectsPageService,
        tokenPageService: TokenPageService,
        startupService: StartupService,
        observerService: ObserverService,
        hunkService: HunkService,
        agentChatService: AgentChatService
    ) {
        this.observerService = observerService;
        this.authService = authService;
        this.fileManagerService = fileManagerService;
        this.textFileEditorService = textFileEditorService;
        this.programEditorService = programEditorService;
        this.projectPageService = projectPageService;
        this.projectsPageService = projectsPageService;
        this.tokenPageService = tokenPageService;
        this.startupService = startupService;
        this.hunkService = hunkService;
        this.agentChatService = agentChatService;
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
            await this.wrapper('onFormLoginClicked', () =>
                this.authService.onFormLoginClicked(userName, password, captcha)
            );
        }
    );

    onQrPageEnterRequest = createAsyncThunk(
        'onQrPageEnter',
        async ({ version }: { version: string }) => {
            await this.wrapper('onQrPageEnter', () =>
                this.startupService.onQrPageEnter(version)
            );
        }
    );

    onProgramSaveTimeoutRequest = createAsyncThunk(
        'onProgramSaveTimeout',
        async () => {
            await this.wrapper('onProgramSaveTimeout', () =>
                this.programEditorService.onProgramSaveTimeout()
            );
        }
    );

    onAppEnterWithOauthCodeRequest = createAsyncThunk(
        'onAppEnterWithOauthCode',
        async ({ code, state }: { code: string; state: string }) => {
            await this.wrapper('onAppEnterWithOauthCode', () =>
                this.startupService.onAppEnterWithOauthCode(code, state)
            );
        }
    );

    onLogoutButtonClickedRequest = createAsyncThunk(
        'onLogoutButtonClicked',
        async () => {
            await this.wrapper('onLogoutButtonClicked', () =>
                this.authService.onLogoutButtonClicked()
            );
        }
    );

    onAuthButtonClickedRequest = createAsyncThunk(
        'onAuthButtonClicked',
        async () => {
            await this.wrapper('onAuthButtonClicked', () =>
                this.authService.onAuthButtonClicked()
            );
        }
    );

    onBillingPurchaseCreateRequest = createAsyncThunk(
        'onBillingPurchaseCreate',
        async ({ tokenPriceId }: { tokenPriceId: string }) =>
            this.tokenPageService.onBillingPurchaseCreate(tokenPriceId)
    );

    onBillingPurchaseFlowResetRequest = createAsyncThunk(
        'onBillingPurchaseFlowReset',
        async () => this.tokenPageService.resetBillingPurchaseFlow()
    );

    onPaymentStatusChangedRequest = createAsyncThunk(
        'onPaymentStatusChanged',
        async () => this.tokenPageService.onPaymentStatusChanged()
    );

    onPaymentWidgetFailedRequest = createAsyncThunk(
        'onPaymentWidgetFailed',
        async () => this.tokenPageService.onPaymentWidgetFailed()
    );

    onAuthClosedRequest = createAsyncThunk('onAuthClosed', async () => {
        await this.wrapper('onAuthClosed', () =>
            this.authService.onAuthClosed()
        );
    });

    onRegistrationButtonClickedRequest = createAsyncThunk(
        'onRegistrationButtonClicked',
        async () => {
            await this.wrapper('onRegistrationButtonClicked', () =>
                this.authService.onRegistrationButtonClicked()
            );
        }
    );

    onForgotPasswordButtonClickedRequest = createAsyncThunk(
        'onForgotPasswordButtonClicked',
        async () => {
            await this.wrapper('onForgotPasswordButtonClicked', () =>
                this.authService.onForgotPasswordButtonClicked()
            );
        }
    );

    onEmailSendButtonClickedRequest = createAsyncThunk(
        'onEmailSendButtonClicked',
        async ({ email, captcha }: { email: string; captcha: string }) => {
            await this.wrapper('onEmailSendButtonClicked', () =>
                this.authService.onEmailSendButtonClicked(email, captcha)
            );
        }
    );

    onSendPasswordButtonClickedRequest = createAsyncThunk(
        'onSendPasswordButtonClicked',
        async ({ password }: { password: string }) => {
            await this.wrapper('onSendPasswordButtonClicked', () =>
                this.authService.onSendPasswordButtonClicked(password)
            );
        }
    );

    onSendCodeButtonClickedRequest = createAsyncThunk(
        'onSendCodeButtonClicked',
        async ({ code }: { code: string }) => {
            await this.wrapper('onSendCodeButtonClicked', () =>
                this.authService.onSendCodeButtonClicked(code)
            );
        }
    );

    onAppEnterRequest = createAsyncThunk(
        'onAppEnter',
        async ({ captcha, open }: { captcha?: string; open?: OpenParams }) => {
            await this.wrapper('onAppEnter', () =>
                this.startupService.onAppStartup(captcha, open)
            );
        }
    );

    onOpenEditorAfterSpaNavigationRequest = createAsyncThunk(
        'onOpenEditorAfterSpaNavigation',
        async () => {
            await this.wrapper('onOpenEditorAfterSpaNavigation', () => {
                void this.startupService.openEditorAfterSpaNavigation();
            });
        }
    );

    onPrintButtonPressedRequest = createAsyncThunk(
        'onPrintButtonPressedRequest',
        async () => {
            await this.wrapper('onPrintButtonPressedRequest', () =>
                this.projectPageService.onPrintButtonPressed()
            );
        }
    );

    onProjectPageEscButtonClickedRequest = createAsyncThunk(
        'onProjectPageEscButtonClicked',
        async () => {
            await this.wrapper('onProjectPageEscButtonClicked', () =>
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
            await this.wrapper('onRunButtonPressed', () =>
                this.projectPageService.onRunButtonClicked()
            );
        }
    );

    onPrivacyPolicyAcceptedRequest = createAsyncThunk(
        'onPrivacyPolicyAccepted',
        async () => {
            await this.wrapper('onPrivacyPolicyAccepted', () =>
                this.projectPageService.onPrivacyPolicyAccepted()
            );
        }
    );

    onHunkAcceptRequest = createAsyncThunk(
        'onHunkAccept',
        async ({ hunkIds }: { hunkIds: string[] }) => {
            await this.hunkService.acceptGroup(hunkIds);
        }
    );

    onHunkRevertRequest = createAsyncThunk(
        'onHunkRevert',
        async ({ hunkIds }: { hunkIds: string[] }) => {
            await this.hunkService.revertGroup(hunkIds);
        }
    );

    onHunkAcceptAllRequest = createAsyncThunk('onHunkAcceptAll', async () => {
        await this.hunkService.acceptAll();
    });

    onHunkRevertAllRequest = createAsyncThunk('onHunkRevertAll', async () => {
        await this.hunkService.revertAll();
    });

    segmentEditorChangeSegmentPositionRequest = createAsyncThunk(
        'segmentEditorChangeSegmentPositionRequest',
        async ({
            direction,
            segmentIndex,
        }: {
            direction: 'down' | 'up';
            segmentIndex: number;
        }) => {
            await this.wrapper(
                'segmentEditorChangeSegmentPositionRequest',
                () =>
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
            await this.wrapper(
                'segmentEditorChangeSegmentVisibilityRequest',
                () =>
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
            await this.wrapper('deleteSegmentRequest', () =>
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
            await this.wrapper('onAddedFilesToSegmentEditorRequest', () =>
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
            await this.wrapper('onSegmentAdded', () =>
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
            await this.wrapper('onAddLatexBoundarySegmentRequest', () =>
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
            await this.wrapper('onSyncEditorToPdfRequest', () =>
                this.programEditorService.onSyncEditorToPdf()
            );
        }
    );

    onSyncPdfToEditorRequest = createAsyncThunk(
        'onSyncPdfToEditorRequest',
        async () => {
            await this.wrapper('onSyncPdfToEditorRequest', () =>
                this.programEditorService.onSyncPdfToEditor()
            );
        }
    );

    onCompileErrorClickedRequest = createAsyncThunk(
        'onCompileErrorClickedRequest',
        async (error: CompileErrorResult) => {
            await this.wrapper('onCompileErrorClickedRequest', () =>
                this.programEditorService.onCompileErrorClicked(error)
            );
        }
    );

    onFocusSegmentRequest = createAsyncThunk(
        'onFocusSegmentRequest',
        async ({ segmentIndex }: { segmentIndex: number }) => {
            await this.wrapper('onFocusSegmentRequest', () =>
                this.programEditorService.onFocusSegment(segmentIndex)
            );
        }
    );

    onBlurSegmentRequest = createAsyncThunk(
        'onBlurSegmentRequest',
        async ({ segmentIndex }: { segmentIndex: number }) => {
            await this.wrapper('onBlurSegmentRequest', () =>
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
            await this.wrapper('onSegmentTextChanged', () =>
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
            await this.wrapper('onAddSegmentButtonClickedRequest', () =>
                this.programEditorService.onAddSegmentClicked(type)
            );
        }
    );

    onFolderButtonClickedRequest = createAsyncThunk(
        'onFolderButtonClickedRequest',
        async () => {
            await this.wrapper('onFolderButtonClickedRequest', () =>
                this.fileManagerService.onFolderButtonClicked()
            );
        }
    );

    onPrevVersionButtonClickedRequest = createAsyncThunk(
        'onPrevVersionButtonClickedRequest',
        async () => {
            await this.wrapper('onPrevVersionButtonClickedRequest', () =>
                this.programEditorService.onPrevVersionButtonClicked()
            );
        }
    );

    onNextVersionButtonClickedRequest = createAsyncThunk(
        'onNextVersionButtonClickedRequest',
        async () => {
            await this.wrapper('onNextVersionButtonClickedRequest', () =>
                this.programEditorService.onNextVersionButtonClicked()
            );
        }
    );

    onDeleteFilesConfirmRequest = createAsyncThunk(
        'onDeleteFilesConfirmRequest',
        async () => {
            await this.wrapper('onDeleteFilesConfirmRequest', () =>
                this.fileManagerService.onConfirmDeleteFiles()
            );
        }
    );

    onDeleteFilesCancelRequest = createAsyncThunk(
        'onDeleteFilesCancelRequest',
        async () => {
            await this.wrapper('onDeleteFilesCancelRequest', () =>
                this.fileManagerService.onCancelDeleteFiles()
            );
        }
    );

    onSearchIconPressRequest = createAsyncThunk(
        'onSearchIconPressRequest',
        async () => {
            await this.wrapper('onSearchIconPressRequest', () =>
                this.projectPageService.onSearchIconPress()
            );
        }
    );

    onSearchInputChangedRequest = createAsyncThunk(
        'onSearchInputChangedRequest',
        async ({ text }: { text: string }) => {
            await this.wrapper('onSearchInputChangedRequest', () =>
                this.projectPageService.onSearchInputChanged(text)
            );
        }
    );

    onSearchSubmitRequest = createAsyncThunk(
        'onSearchSubmitRequest',
        async () => {
            await this.wrapper('onSearchSubmitRequest', () =>
                this.projectPageService.onSearchSubmit()
            );
        }
    );

    onOauthLoginRequest = createAsyncThunk('onOauthLoginRequest', async () => {
        await this.wrapper('onOauthLoginRequest', () =>
            this.authService.onOauthLogin()
        );
    });

    onRoundStrategySetRequest = createAsyncThunk(
        'onRoundStrategySetRequest',
        async ({ strategy }: { strategy: ProgramRoundStrategy }) => {
            await this.wrapper('onRoundStrategySetRequest', () =>
                this.programEditorService.onRoundStrategySet(strategy)
            );
        }
    );

    onHelpItemCreatedRequest = createAsyncThunk(
        'onHelpItemCreatedRequest',
        async ({ item }: { item: HeaderHelpItem }) => {
            await this.wrapper('onHelpItemCreatedRequest', () =>
                this.projectPageService.onHelpItemCreated(item)
            );
        }
    );

    onExpandErrorsClickedRequest = createAsyncThunk(
        'onExpandErrorsClickedRequest',
        async () => {
            await this.wrapper('onExpandErrorsClickedRequest', () =>
                this.projectPageService.onExpandErrorsClicked()
            );
        }
    );

    onCrossButtonInFileManagerClickedRequest = createAsyncThunk(
        'onCrossButtonInFileManagerClickedRequest',
        async () => {
            await this.wrapper('onCrossButtonInFileManagerClickedRequest', () =>
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
            await this.wrapper('onUploadFilesRequest', () =>
                this.fileManagerService.onUploadFiles(files, folderPrefix)
            );
        }
    );

    onCurrentFolderPathChangedRequest = createAsyncThunk(
        'onCurrentFolderPathChangedRequest',
        async ({ path }: { path: string }) => {
            await this.wrapper('onCurrentFolderPathChangedRequest', () =>
                this.fileManagerService.onCurrentFolderPathChanged(path)
            );
        }
    );

    onCreateFolderRequest = createAsyncThunk(
        'onCreateFolderRequest',
        async ({ name, parentPath }: { name: string; parentPath: string }) => {
            await this.wrapper('onCreateFolderRequest', () =>
                this.fileManagerService.onCreateFolder(name, parentPath)
            );
        }
    );

    onCreateFileRequest = createAsyncThunk('onCreateFileRequest', async () => {
        await this.wrapper('onCreateFileRequest', () =>
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
            await this.wrapper('onSvarCreateFileRequest', () =>
                this.fileManagerService.onSvarCreateFile(ev)
            );
        }
    );

    onSvarDeleteFilesRequest = createAsyncThunk(
        'onSvarDeleteFilesRequest',
        async ({ ids }: { ids: string[] }) => {
            await this.wrapper('onSvarDeleteFilesRequest', () =>
                this.fileManagerService.onSvarDeleteFiles(ids)
            );
        }
    );

    onSvarRenameFileRequest = createAsyncThunk(
        'onSvarRenameFileRequest',
        async ({ id, name }: { id: string; name: string }) => {
            await this.wrapper('onSvarRenameFileRequest', () =>
                this.fileManagerService.onSvarRenameFile(id, name)
            );
        }
    );

    onSvarMoveFilesRequest = createAsyncThunk(
        'onSvarMoveFilesRequest',
        async ({ ids, target }: { ids: string[]; target: string }) => {
            await this.wrapper('onSvarMoveFilesRequest', () =>
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
            await this.wrapper('onTextFileOpenedRequest', () =>
                this.textFileEditorService.onTextFileOpened(fileName)
            );
        }
    );

    onTextFileContentChangedRequest = createAsyncThunk(
        'onTextFileContentChangedRequest',
        async ({ content }: { content: string }) => {
            await this.wrapper('onTextFileContentChangedRequest', () =>
                this.textFileEditorService.onTextFileContentChanged(content)
            );
        }
    );

    onTextFileEditorClosedRequest = createAsyncThunk(
        'onTextFileEditorClosedRequest',
        async () => {
            await this.wrapper('onTextFileEditorClosedRequest', () =>
                this.textFileEditorService.onTextFileEditorClosed()
            );
        }
    );

    onTextFileSaveTimeoutRequest = createAsyncThunk(
        'onTextFileSaveTimeoutRequest',
        async () => {
            await this.wrapper('onTextFileSaveTimeoutRequest', () =>
                this.textFileEditorService.onTextFileSaveTimeout()
            );
        }
    );

    onImageFileOpenedRequest = createAsyncThunk(
        'onImageFileOpenedRequest',
        async ({ fileName }: { fileName: string }) => {
            await this.wrapper('onImageFileOpenedRequest', () =>
                this.textFileEditorService.onImageFileOpened(fileName)
            );
        }
    );

    onImageFilePreviewClosedRequest = createAsyncThunk(
        'onImageFilePreviewClosedRequest',
        async () => {
            await this.wrapper('onImageFilePreviewClosedRequest', () =>
                this.textFileEditorService.onImageFilePreviewClosed()
            );
        }
    );

    onDeleteFileRequest = createAsyncThunk(
        'onDeleteFileRequest',
        async ({ fileName }: { fileName: string }) => {
            await this.wrapper('onDeleteFileRequest', () =>
                this.fileManagerService.onDeleteFile(fileName)
            );
        }
    );

    onFileNameChangedRequest = createAsyncThunk(
        'onFileNameChangedRequest',
        async ({ oldName, newName }: { oldName: string; newName: string }) => {
            await this.wrapper('onFileNameChangedRequest', () =>
                this.fileManagerService.onFileNameChanged(oldName, newName)
            );
        }
    );

    onRenameFolderRequest = createAsyncThunk(
        'onRenameFolderRequest',
        async ({ oldPath, newPath }: { oldPath: string; newPath: string }) => {
            await this.wrapper('onRenameFolderRequest', () =>
                this.fileManagerService.onRenameFolder(oldPath, newPath)
            );
        }
    );

    onDeleteFolderRequest = createAsyncThunk(
        'onDeleteFolderRequest',
        async ({ path }: { path: string }) => {
            await this.wrapper('onDeleteFolderRequest', () =>
                this.fileManagerService.onDeleteFolder(path)
            );
        }
    );

    onFileRenameButtonClickedRequest = createAsyncThunk(
        'onFileRenameButtonClickedRequest',
        async () => {
            await this.wrapper('onFileRenameButtonClickedRequest', () =>
                this.fileManagerService.onFileRenameButtonClicked()
            );
        }
    );

    onRowClickedInProjectsListRequest = createAsyncThunk(
        'onRowClickedInProjectsListRequest',
        async ({ projectId }: { projectId: string }) => {
            await this.wrapper('onRowClickedInProjectsListRequest', () =>
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
            await this.wrapper('onProjectTitleChangedRequest', () =>
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
            await this.wrapper('onProjectVisibilityChangeRequest', () =>
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
            await this.wrapper('onProjectCreateRequest', () =>
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
            await this.wrapper('onBackButtonClickedRequest', () =>
                this.projectPageService.onBackButtonClicked()
            );
        }
    );

    onContactUsFormSubmittedRequest = createAsyncThunk(
        'onContactUsFormSubmittedRequest',
        async ({ body, subject }: { body: string; subject: string }) => {
            await this.wrapper('onContactUsFormSubmittedRequest', () =>
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
            await this.wrapper('onDeleteProjectRequest', () =>
                this.projectsPageService.onDeleteProject(projectId, okCallback)
            );
        }
    );

    onCloneProjectRequest = createAsyncThunk(
        'onCloneProjectRequest',
        async () => {
            await this.wrapper('onCloneProjectRequest', () =>
                this.projectPageService.onCloneProject()
            );
        }
    );

    onProjectModeChangeRequest = createAsyncThunk(
        'onProjectModeChangeRequest',
        async ({ type }: { type: ProjectType }) => {
            await this.wrapper('onProjectModeChangeRequest', () =>
                this.projectPageService.setProjectType(type)
            );
        }
    );

    onChatOpenedRequest = createAsyncThunk('onChatOpened', async () => {
        await this.wrapper('onChatOpened', () =>
            this.agentChatService.onChatOpened()
        );
    });

    onAgentPromptChangedRequest = createAsyncThunk(
        'onAgentPromptChanged',
        async ({ text }: { text: string }) => {
            await this.wrapper('onAgentPromptChanged', () =>
                this.agentChatService.onInputChanged(text)
            );
        }
    );

    onAgentPromptSubmitRequest = createAsyncThunk(
        'onAgentPromptSubmit',
        async () => {
            await this.wrapper('onAgentPromptSubmit', () =>
                this.agentChatService.onPromptSubmit()
            );
        }
    );

    onAgentMaxTokensChangedRequest = createAsyncThunk(
        'onAgentMaxTokensChanged',
        async ({ value }: { value: number }) => {
            await this.wrapper('onAgentMaxTokensChanged', () =>
                this.agentChatService.onMaxTokensChanged(value)
            );
        }
    );

    onAgentIterationsChangedRequest = createAsyncThunk(
        'onAgentIterationsChanged',
        async ({ value }: { value: number }) => {
            await this.wrapper('onAgentIterationsChanged', () =>
                this.agentChatService.onIterationsChanged(value)
            );
        }
    );

    onClearChatHistoryRequest = createAsyncThunk(
        'onClearChatHistory',
        async () => {
            await this.wrapper('onClearChatHistory', () =>
                this.agentChatService.onClearHistoryClicked()
            );
        }
    );

    onProjectPageLeftRequest = createAsyncThunk(
        'onProjectPageLeft',
        async () => {
            await this.wrapper('onProjectPageLeft', () =>
                this.agentChatService.closeSession()
            );
        }
    );

    onBlockedEditAttemptRequest = createAsyncThunk(
        'onBlockedEditAttempt',
        async () => {
            await this.wrapper('onBlockedEditAttempt', () =>
                this.agentChatService.onBlockedEditAttempt()
            );
        }
    );

    onAgentChangeClickedRequest = createAsyncThunk(
        'onAgentChangeClicked',
        async ({
            target,
        }: {
            target: { segmentIndex: number; line: number; file?: string };
        }) => {
            await this.wrapper('onAgentChangeClicked', () =>
                this.programEditorService.navigateToAgentChange(target)
            );
        }
    );

    private wrapper = async <T>(
        name: string,
        method: () => T | Promise<T>
    ): Promise<void> => {
        logBreadcrumb('operation', name);
        try {
            await method();
        } catch (error) {
            this.observerService.onEvent(Events.FRONTEND_ERROR);
            logBreadcrumb(
                'operation',
                `${name} failed`,
                {
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                'error'
            );
            console.error(error);
            Sentry.captureException(error);
        }
    };
}
