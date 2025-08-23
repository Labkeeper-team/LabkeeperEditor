import { createAsyncThunk } from '@reduxjs/toolkit';
import { ProgramRoundStrategy, SegmentType } from '../model/domain.ts';
import { HeaderHelpItem } from '../model/help';
import { observerService, systemService } from '../main.tsx';
import * as Sentry from '@sentry/react';
import { Events } from '../model/service/observer.ts';

/*
TODO
1. все оставшиеся dispatch (store_action) заменить на системные операции
2. убрать createAsyncThunk и dispatch
 */

export const onFormLoginClickedRequest = createAsyncThunk(
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
        wrapper('onFormLoginClicked', () =>
            systemService.onFormLoginClicked(userName, password, captcha)
        );
    }
);

export const onQrPageEnterRequest = createAsyncThunk(
    'onQrPageEnter',
    async ({ version }: { version: string }) => {
        wrapper('onQrPageEnter', () => systemService.onQrPageEnter(version));
    }
);

export const onProgramSaveTimeoutRequest = createAsyncThunk(
    'onProgramSaveTimeout',
    async () => {
        wrapper('onProgramSaveTimeout', () =>
            systemService.onProgramSaveTimeout()
        );
    }
);

export const onAppEnterWithOauthCodeRequest = createAsyncThunk(
    'onAppEnterWithOauthCode',
    async ({ code, state }: { code: string; state: string }) => {
        wrapper('onAppEnterWithOauthCode', () =>
            systemService.onAppEnterWithOauthCode(code, state)
        );
    }
);

export const onLogoutButtonClickedRequest = createAsyncThunk(
    'onLogoutButtonClicked',
    async () => {
        wrapper('onLogoutButtonClicked', () =>
            systemService.onLogoutButtonClicked()
        );
    }
);

export const onAuthButtonClickedRequest = createAsyncThunk(
    'onAuthButtonClicked',
    async () => {
        wrapper('onAuthButtonClicked', () =>
            systemService.onAuthButtonClicked()
        );
    }
);

export const onAuthClosedRequest = createAsyncThunk(
    'onAuthClosed',
    async () => {
        wrapper('onAuthClosed', () => systemService.onAuthClosed());
    }
);

export const onRegistrationButtonClickedRequest = createAsyncThunk(
    'onRegistrationButtonClicked',
    async () => {
        wrapper('onRegistrationButtonClicked', () =>
            systemService.onRegistrationButtonClicked()
        );
    }
);

export const onForgotPasswordButtonClickedRequest = createAsyncThunk(
    'onForgotPasswordButtonClicked',
    async () => {
        wrapper('onForgotPasswordButtonClicked', () =>
            systemService.onForgotPasswordButtonClicked()
        );
    }
);

export const onEmailSendButtonClickedRequest = createAsyncThunk(
    'onEmailSendButtonClicked',
    async ({ email, captcha }: { email: string; captcha: string }) => {
        wrapper('onEmailSendButtonClicked', () =>
            systemService.onEmailSendButtonClicked(email, captcha)
        );
    }
);

export const onSendPasswordButtonClickedRequest = createAsyncThunk(
    'onSendPasswordButtonClicked',
    async ({ password }: { password: string }) => {
        wrapper('onSendPasswordButtonClicked', () =>
            systemService.onSendPasswordButtonClicked(password)
        );
    }
);

export const onSendCodeButtonClickedRequest = createAsyncThunk(
    'onSendCodeButtonClicked',
    async ({ code }: { code: string }) => {
        wrapper('onSendCodeButtonClicked', () =>
            systemService.onSendCodeButtonClicked(code)
        );
    }
);

export const onAppEnterRequest = createAsyncThunk(
    'onAppEnter',
    async ({ from }: { from?: string }) => {
        wrapper('onAppEnter', () => systemService.onAppStartup(from));
    }
);

export const onPrintButtonPressedRequest = createAsyncThunk(
    'onPrintButtonPressedRequest',
    async () => {
        wrapper('onPrintButtonPressedRequest', () =>
            systemService.onPrintButtonPressed()
        );
    }
);

export const onProjectPageEscButtonClicked = createAsyncThunk(
    'onProjectPageEscButtonClicked',
    async () => {
        wrapper('onProjectPageEscButtonClicked', () =>
            systemService.onProjectPageEscButtonPressed()
        );
    }
);

export const onRunButtonPressed = createAsyncThunk(
    'onRunButtonPressed',
    async () => {
        wrapper('onRunButtonPressed', () => systemService.onRunButtonClicked());
    }
);

export const segmentEditorChangeSegmentPositionRequest = createAsyncThunk(
    'segmentEditorChangeSegmentPositionRequest',
    async ({
        direction,
        segmentIndex,
    }: {
        direction: 'down' | 'up';
        segmentIndex: number;
    }) => {
        wrapper('segmentEditorChangeSegmentPositionRequest', () =>
            systemService.segmentEditorChangeSegmentPosition(
                direction,
                segmentIndex
            )
        );
    }
);

export const segmentEditorChangeSegmentVisibilityRequest = createAsyncThunk(
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
        wrapper('segmentEditorChangeSegmentVisibilityRequest', () =>
            systemService.segmentEditorChangeSegmentVisibility(
                visible,
                parameterName,
                segmentIndex
            )
        );
    }
);

export const deleteSegmentRequest = createAsyncThunk(
    'deleteSegmentRequest',
    async ({ segmentIndex }: { segmentIndex: number }) => {
        wrapper('deleteSegmentRequest', () =>
            systemService.deleteSegment(segmentIndex)
        );
    }
);

export const onAddedFilesToSegmentEditorRequest = createAsyncThunk(
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
        wrapper('onAddedFilesToSegmentEditorRequest', () =>
            systemService.onAddedFilesToSegmentEditor(
                items,
                segmentIndex,
                editorCallback
            )
        );
    }
);

export const onSegmentAddedViaDividerRequest = createAsyncThunk(
    'onSegmentAdded',
    async ({
        segmentType,
        after,
    }: {
        segmentType: SegmentType;
        after: number;
    }) => {
        wrapper('onSegmentAdded', () =>
            systemService.onSegmentAddedViaDivider(segmentType, after)
        );
    }
);

export const onFocusSegmentRequest = createAsyncThunk(
    'onFocusSegmentRequest',
    async ({ segmentIndex }: { segmentIndex: number }) => {
        wrapper('onFocusSegmentRequest', () =>
            systemService.onFocusSegment(segmentIndex)
        );
    }
);

export const onBlurSegmentRequest = createAsyncThunk(
    'onBlurSegmentRequest',
    async ({
        segmentIndex,
        segmentText,
    }: {
        segmentIndex: number;
        segmentText: string;
    }) => {
        wrapper('onBlurSegmentRequest', () =>
            systemService.onBlurSegment(segmentIndex, segmentText)
        );
    }
);

export const onSegmentTextChangedRequest = createAsyncThunk(
    'onSegmentTextChanged',
    async ({
        segmentIndex,
        segmentText,
    }: {
        segmentIndex: number;
        segmentText: string;
    }) => {
        wrapper('onSegmentTextChanged', () =>
            systemService.onSegmentTextEdited(segmentIndex, segmentText)
        );
    }
);

export const onAddSegmentButtonClickedRequest = createAsyncThunk(
    'onAddSegmentButtonClickedRequest',
    async ({ type }: { type: SegmentType }) => {
        wrapper('onAddSegmentButtonClickedRequest', () =>
            systemService.onAddSegmentClicked(type)
        );
    }
);

export const onFolderButtonClickedRequest = createAsyncThunk(
    'onFolderButtonClickedRequest',
    async () => {
        wrapper('onFolderButtonClickedRequest', () =>
            systemService.onFolderButtonClicked()
        );
    }
);

export const onPrevVersionButtonClickedRequest = createAsyncThunk(
    'onPrevVersionButtonClickedRequest',
    async () => {
        wrapper('onPrevVersionButtonClickedRequest', () =>
            systemService.onPrevVersionButtonClicked()
        );
    }
);

export const onNextVersionButtonClickedRequest = createAsyncThunk(
    'onNextVersionButtonClickedRequest',
    async () => {
        wrapper('onNextVersionButtonClickedRequest', () =>
            systemService.onNextVersionButtonClicked()
        );
    }
);

export const onSearchIconPressRequest = createAsyncThunk(
    'onSearchIconPressRequest',
    async () => {
        wrapper('onSearchIconPressRequest', () =>
            systemService.onSearchIconPress()
        );
    }
);

export const onSearchInputChangedRequest = createAsyncThunk(
    'onSearchInputChangedRequest',
    async ({ text }: { text: string }) => {
        wrapper('onSearchInputChangedRequest', () =>
            systemService.onSearchInputChanged(text)
        );
    }
);

export const onOauthLoginRequest = createAsyncThunk(
    'onOauthLoginRequest',
    async () => {
        wrapper('onOauthLoginRequest', () => systemService.onOauthLogin());
    }
);

export const onRoundStrategySetRequest = createAsyncThunk(
    'onRoundStrategySetRequest',
    async ({ strategy }: { strategy: ProgramRoundStrategy }) => {
        wrapper('onRoundStrategySetRequest', () =>
            systemService.onRoundStrategySet(strategy)
        );
    }
);

export const onHelpItemCreatedRequest = createAsyncThunk(
    'onHelpItemCreatedRequest',
    async ({ item }: { item: HeaderHelpItem }) => {
        wrapper('onHelpItemCreatedRequest', () =>
            systemService.onHelpItemCreated(item)
        );
    }
);

export const onExpandErrorsClickedRequest = createAsyncThunk(
    'onExpandErrorsClickedRequest',
    async () => {
        wrapper('onExpandErrorsClickedRequest', () =>
            systemService.onExpandErrorsClicked()
        );
    }
);

export const onCrossButtonInFileManagerClickedRequest = createAsyncThunk(
    'onCrossButtonInFileManagerClickedRequest',
    async () => {
        wrapper('onCrossButtonInFileManagerClickedRequest', () =>
            systemService.onCrossButtonInFileManagerClicked()
        );
    }
);

export const onUploadFileRequest = createAsyncThunk(
    'onUploadFileRequest',
    async ({ file }: { file: File }) => {
        wrapper('onUploadFileRequest', () => systemService.onUploadFile(file));
    }
);

export const onDeleteFileRequest = createAsyncThunk(
    'onDeleteFileRequest',
    async ({ fileName }: { fileName: string }) => {
        wrapper('onDeleteFileRequest', () =>
            systemService.onDeleteFile(fileName)
        );
    }
);

export const onFileNameChangedRequest = createAsyncThunk(
    'onFileNameChangedRequest',
    async ({ oldName, newName }: { oldName: string; newName: string }) => {
        wrapper('onFileNameChangedRequest', () =>
            systemService.onFileNameChanged(oldName, newName)
        );
    }
);

export const onFileRenameButtonClickedRequest = createAsyncThunk(
    'onFileRenameButtonClickedRequest',
    async () => {
        wrapper('onFileRenameButtonClickedRequest', () =>
            systemService.onFileRenameButtonClicked()
        );
    }
);

export const onRowClickedInProjectsListRequest = createAsyncThunk(
    'onRowClickedInProjectsListRequest',
    async ({ projectId }: { projectId: string }) => {
        wrapper('onRowClickedInProjectsListRequest', () =>
            systemService.onRowClickedInProjectsList(projectId)
        );
    }
);

export const onProjectTitleChangedRequest = createAsyncThunk(
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
        wrapper('onProjectTitleChangedRequest', () =>
            systemService.onProjectTitleChanged(
                projectId,
                title,
                okCallback,
                failCallback
            )
        );
    }
);

export const onProjectVisibilityChangeRequest = createAsyncThunk(
    'onProjectVisibilityChangeRequest',
    async ({ visible }: { visible: boolean }) => {
        wrapper('onProjectVisibilityChangeRequest', () =>
            systemService.onProjectVisibilityChange(visible)
        );
    }
);

export const onProjectCreateRequest = createAsyncThunk(
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
        wrapper('onProjectCreateRequest', () =>
            systemService.onProjectCreate(
                projectName,
                okCallback,
                errorCallback
            )
        );
    }
);

export const onBackButtonClickedRequest = createAsyncThunk(
    'onBackButtonClickedRequest',
    async () => {
        wrapper('onBackButtonClickedRequest', () =>
            systemService.onBackButtonClicked()
        );
    }
);

export const onContactUsFormSubmittedRequest = createAsyncThunk(
    'onContactUsFormSubmittedRequest',
    async ({ body, subject }: { body: string; subject: string }) => {
        wrapper('onContactUsFormSubmittedRequest', () =>
            systemService.onContactUsFormSubmitted(subject, body)
        );
    }
);

export const onDeleteProjectRequest = createAsyncThunk(
    'onDeleteProjectRequest',
    async ({
        projectId,
        okCallback,
    }: {
        projectId: string;
        okCallback: () => void;
    }) => {
        wrapper('onDeleteProjectRequest', () =>
            systemService.onDeleteProject(projectId, okCallback)
        );
    }
);

const wrapper = (name: string, method: () => void) => {
    try {
        method();
        console.info(`Invoking system operation [${name}]`);
    } catch (error) {
        observerService.onEvent(Events.FRONTEND_ERROR);
        console.error(error);
        Sentry.captureException(error);
    }
};
