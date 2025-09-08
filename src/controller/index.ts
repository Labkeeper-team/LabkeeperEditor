import { createAsyncThunk } from '@reduxjs/toolkit';
import { ProgramRoundStrategy, SegmentType } from '../model/domain.ts';
import { HeaderHelpItem } from '../model/help';
import * as Sentry from '@sentry/react';
import { Events, ObserverService } from '../model/service/observer.ts';
import { SystemService } from '../viewModel';

export class Controller {
    systemService: SystemService;
    observerService: ObserverService;

    constructor(
        systemService: SystemService,
        observerService: ObserverService
    ) {
        this.systemService = systemService;
        this.observerService = observerService;
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
                this.systemService.onFormLoginClicked(
                    userName,
                    password,
                    captcha
                )
            );
        }
    );

    onQrPageEnterRequest = createAsyncThunk(
        'onQrPageEnter',
        async ({ version }: { version: string }) => {
            this.wrapper('onQrPageEnter', () =>
                this.systemService.onQrPageEnter(version)
            );
        }
    );

    onProgramSaveTimeoutRequest = createAsyncThunk(
        'onProgramSaveTimeout',
        async () => {
            this.wrapper('onProgramSaveTimeout', () =>
                this.systemService.onProgramSaveTimeout()
            );
        }
    );

    onAppEnterWithOauthCodeRequest = createAsyncThunk(
        'onAppEnterWithOauthCode',
        async ({ code, state }: { code: string; state: string }) => {
            this.wrapper('onAppEnterWithOauthCode', () =>
                this.systemService.onAppEnterWithOauthCode(code, state)
            );
        }
    );

    onLogoutButtonClickedRequest = createAsyncThunk(
        'onLogoutButtonClicked',
        async () => {
            this.wrapper('onLogoutButtonClicked', () =>
                this.systemService.onLogoutButtonClicked()
            );
        }
    );

    onAuthButtonClickedRequest = createAsyncThunk(
        'onAuthButtonClicked',
        async () => {
            this.wrapper('onAuthButtonClicked', () =>
                this.systemService.onAuthButtonClicked()
            );
        }
    );

    onAuthClosedRequest = createAsyncThunk('onAuthClosed', async () => {
        this.wrapper('onAuthClosed', () => this.systemService.onAuthClosed());
    });

    onRegistrationButtonClickedRequest = createAsyncThunk(
        'onRegistrationButtonClicked',
        async () => {
            this.wrapper('onRegistrationButtonClicked', () =>
                this.systemService.onRegistrationButtonClicked()
            );
        }
    );

    onForgotPasswordButtonClickedRequest = createAsyncThunk(
        'onForgotPasswordButtonClicked',
        async () => {
            this.wrapper('onForgotPasswordButtonClicked', () =>
                this.systemService.onForgotPasswordButtonClicked()
            );
        }
    );

    onEmailSendButtonClickedRequest = createAsyncThunk(
        'onEmailSendButtonClicked',
        async ({ email, captcha }: { email: string; captcha: string }) => {
            this.wrapper('onEmailSendButtonClicked', () =>
                this.systemService.onEmailSendButtonClicked(email, captcha)
            );
        }
    );

    onSendPasswordButtonClickedRequest = createAsyncThunk(
        'onSendPasswordButtonClicked',
        async ({ password }: { password: string }) => {
            this.wrapper('onSendPasswordButtonClicked', () =>
                this.systemService.onSendPasswordButtonClicked(password)
            );
        }
    );

    onSendCodeButtonClickedRequest = createAsyncThunk(
        'onSendCodeButtonClicked',
        async ({ code }: { code: string }) => {
            this.wrapper('onSendCodeButtonClicked', () =>
                this.systemService.onSendCodeButtonClicked(code)
            );
        }
    );

    onAppEnterRequest = createAsyncThunk(
        'onAppEnter',
        async ({ from }: { from?: string }) => {
            this.wrapper('onAppEnter', () =>
                this.systemService.onAppStartup(from)
            );
        }
    );

    onPrintButtonPressedRequest = createAsyncThunk(
        'onPrintButtonPressedRequest',
        async () => {
            this.wrapper('onPrintButtonPressedRequest', () =>
                this.systemService.onPrintButtonPressed()
            );
        }
    );

    onProjectPageEscButtonClickedRequest = createAsyncThunk(
        'onProjectPageEscButtonClicked',
        async () => {
            this.wrapper('onProjectPageEscButtonClicked', () =>
                this.systemService.onProjectPageEscButtonPressed()
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
                this.systemService.onRunButtonClicked()
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
                this.systemService.segmentEditorChangeSegmentPosition(
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
                this.systemService.segmentEditorChangeSegmentVisibility(
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
                this.systemService.deleteSegment(segmentIndex)
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
                this.systemService.onAddedFilesToSegmentEditor(
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
                this.systemService.onSegmentAddedViaDivider(segmentType, after)
            );
        }
    );

    onFocusSegmentRequest = createAsyncThunk(
        'onFocusSegmentRequest',
        async ({ segmentIndex }: { segmentIndex: number }) => {
            this.wrapper('onFocusSegmentRequest', () =>
                this.systemService.onFocusSegment(segmentIndex)
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
                this.systemService.onBlurSegment(segmentIndex, segmentText)
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
                this.systemService.onSegmentTextEdited(
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
                this.systemService.onAddSegmentClicked(type)
            );
        }
    );

    onFolderButtonClickedRequest = createAsyncThunk(
        'onFolderButtonClickedRequest',
        async () => {
            this.wrapper('onFolderButtonClickedRequest', () =>
                this.systemService.onFolderButtonClicked()
            );
        }
    );

    onPrevVersionButtonClickedRequest = createAsyncThunk(
        'onPrevVersionButtonClickedRequest',
        async () => {
            this.wrapper('onPrevVersionButtonClickedRequest', () =>
                this.systemService.onPrevVersionButtonClicked()
            );
        }
    );

    onNextVersionButtonClickedRequest = createAsyncThunk(
        'onNextVersionButtonClickedRequest',
        async () => {
            this.wrapper('onNextVersionButtonClickedRequest', () =>
                this.systemService.onNextVersionButtonClicked()
            );
        }
    );

    onSearchIconPressRequest = createAsyncThunk(
        'onSearchIconPressRequest',
        async () => {
            this.wrapper('onSearchIconPressRequest', () =>
                this.systemService.onSearchIconPress()
            );
        }
    );

    onSearchInputChangedRequest = createAsyncThunk(
        'onSearchInputChangedRequest',
        async ({ text }: { text: string }) => {
            this.wrapper('onSearchInputChangedRequest', () =>
                this.systemService.onSearchInputChanged(text)
            );
        }
    );

    onOauthLoginRequest = createAsyncThunk('onOauthLoginRequest', async () => {
        this.wrapper('onOauthLoginRequest', () =>
            this.systemService.onOauthLogin()
        );
    });

    onRoundStrategySetRequest = createAsyncThunk(
        'onRoundStrategySetRequest',
        async ({ strategy }: { strategy: ProgramRoundStrategy }) => {
            this.wrapper('onRoundStrategySetRequest', () =>
                this.systemService.onRoundStrategySet(strategy)
            );
        }
    );

    onHelpItemCreatedRequest = createAsyncThunk(
        'onHelpItemCreatedRequest',
        async ({ item }: { item: HeaderHelpItem }) => {
            this.wrapper('onHelpItemCreatedRequest', () =>
                this.systemService.onHelpItemCreated(item)
            );
        }
    );

    onExpandErrorsClickedRequest = createAsyncThunk(
        'onExpandErrorsClickedRequest',
        async () => {
            this.wrapper('onExpandErrorsClickedRequest', () =>
                this.systemService.onExpandErrorsClicked()
            );
        }
    );

    onCrossButtonInFileManagerClickedRequest = createAsyncThunk(
        'onCrossButtonInFileManagerClickedRequest',
        async () => {
            this.wrapper('onCrossButtonInFileManagerClickedRequest', () =>
                this.systemService.onCrossButtonInFileManagerClicked()
            );
        }
    );

    onUploadFileRequest = createAsyncThunk(
        'onUploadFileRequest',
        async ({ file }: { file: File }) => {
            this.wrapper('onUploadFileRequest', () =>
                this.systemService.onUploadFile(file)
            );
        }
    );

    onDeleteFileRequest = createAsyncThunk(
        'onDeleteFileRequest',
        async ({ fileName }: { fileName: string }) => {
            this.wrapper('onDeleteFileRequest', () =>
                this.systemService.onDeleteFile(fileName)
            );
        }
    );

    onFileNameChangedRequest = createAsyncThunk(
        'onFileNameChangedRequest',
        async ({ oldName, newName }: { oldName: string; newName: string }) => {
            this.wrapper('onFileNameChangedRequest', () =>
                this.systemService.onFileNameChanged(oldName, newName)
            );
        }
    );

    onFileRenameButtonClickedRequest = createAsyncThunk(
        'onFileRenameButtonClickedRequest',
        async () => {
            this.wrapper('onFileRenameButtonClickedRequest', () =>
                this.systemService.onFileRenameButtonClicked()
            );
        }
    );

    onRowClickedInProjectsListRequest = createAsyncThunk(
        'onRowClickedInProjectsListRequest',
        async ({ projectId }: { projectId: string }) => {
            this.wrapper('onRowClickedInProjectsListRequest', () =>
                this.systemService.onRowClickedInProjectsList(projectId)
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
                this.systemService.onProjectTitleChanged(
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
                this.systemService.onProjectVisibilityChange(visible)
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
                this.systemService.onProjectCreate(
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
                this.systemService.onBackButtonClicked()
            );
        }
    );

    onContactUsFormSubmittedRequest = createAsyncThunk(
        'onContactUsFormSubmittedRequest',
        async ({ body, subject }: { body: string; subject: string }) => {
            this.wrapper('onContactUsFormSubmittedRequest', () =>
                this.systemService.onContactUsFormSubmitted(subject, body)
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
                this.systemService.onDeleteProject(projectId, okCallback)
            );
        }
    );

    onCloneProjectRequest = createAsyncThunk(
        'onCloneProjectRequest',
        async () => {
            this.wrapper('onCloneProjectRequest', () =>
                this.systemService.onCloneProject()
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
