import { createAsyncThunk } from '@reduxjs/toolkit';
import { ProgramRoundStrategy, SegmentType } from '../model/domain.ts';
import { HeaderHelpItem } from '../model/help';
import * as Sentry from '@sentry/react';
import { Events, ObserverService } from '../model/service/ObserverService.ts';
import { AuthService } from '../viewModel/operation/AuthService.ts';
import { FileManagerService } from '../viewModel/operation/FileManagerService.ts';
import { ProgramEditorService } from '../viewModel/operation/ProgramEditorService.ts';
import { ProjectPageService } from '../viewModel/operation/ProjectPageService.ts';
import { ProjectsPageService } from '../viewModel/operation/ProjectsPageService.ts';
import { StartupService } from '../viewModel/operation/StartupService.ts';

export class Controller {
    authService: AuthService;
    fileManagerService: FileManagerService;
    programEditorService: ProgramEditorService;
    projectPageService: ProjectPageService;
    projectsPageService: ProjectsPageService;
    startupService: StartupService;
    observerService: ObserverService;

    constructor(
        authService: AuthService,
        fileManagerService: FileManagerService,
        programEditorService: ProgramEditorService,
        projectPageService: ProjectPageService,
        projectsPageService: ProjectsPageService,
        startupService: StartupService,
        observerService: ObserverService
    ) {
        this.observerService = observerService;
        this.authService = authService;
        this.fileManagerService = fileManagerService;
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
            captcha: string;
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
        async ({ from }: { from?: string }) => {
            this.wrapper('onAppEnter', () =>
                this.startupService.onAppStartup(from)
            );
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
            editorCallback,
        }: {
            items: DataTransferItemList;
            segmentIndex: number;
            editorCallback: (insert: string) => void;
        }) => {
            this.wrapper('onAddedFilesToSegmentEditorRequest', () =>
                this.programEditorService.onAddedFilesToSegmentEditor(
                    items,
                    segmentIndex,
                    editorCallback
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
        async ({
            segmentIndex,
            segmentText,
        }: {
            segmentIndex: number;
            segmentText: string;
        }) => {
            this.wrapper('onBlurSegmentRequest', () =>
                this.programEditorService.onBlurSegment(
                    segmentIndex,
                    segmentText
                )
            );
        }
    );

    onSegmentTextChangedRequest = createAsyncThunk(
        'onSegmentTextChanged',
        async ({
            segmentIndex,
            segmentText,
        }: {
            segmentIndex: number;
            segmentText: string;
        }) => {
            this.wrapper('onSegmentTextChanged', () =>
                this.programEditorService.onSegmentTextEdited(
                    segmentIndex,
                    segmentText
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

    onUploadFileRequest = createAsyncThunk(
        'onUploadFileRequest',
        async ({ file }: { file: File }) => {
            this.wrapper('onUploadFileRequest', () =>
                this.fileManagerService.onUploadFile(file)
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
            errorCallback,
            okCallback,
        }: {
            projectName: string;
            okCallback: () => void;
            errorCallback: (message: string) => void;
        }) => {
            this.wrapper('onProjectCreateRequest', () =>
                this.projectsPageService.onProjectCreate(
                    projectName,
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
