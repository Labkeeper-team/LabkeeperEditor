import { createAsyncThunk } from '@reduxjs/toolkit';
import { ProgramRoundStrategy, Segment, SegmentType } from '../model/domain.ts';
import { HeaderHelpItem } from '../model/help';
import { systemService } from '../main.tsx';
import * as Sentry from '@sentry/react';

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
        wrapper(() =>
            systemService.onFormLoginClicked(userName, password, captcha)
        );
    }
);

export const onAppEnterWithOauthCodeRequest = createAsyncThunk(
    'onAppEnterWithOauthCode',
    async ({ code, state }: { code: string; state: string }) => {
        wrapper(() => systemService.onAppEnterWithOauthCode(code, state));
    }
);

export const onLogoutButtonClickedRequest = createAsyncThunk(
    'onLogoutButtonClicked',
    async () => {
        wrapper(() => systemService.onLogoutButtonClicked());
    }
);

export const onAuthButtonClickedRequest = createAsyncThunk(
    'onAuthButtonClicked',
    async () => {
        wrapper(() => systemService.onAuthButtonClicked());
    }
);

export const onAuthClosedRequest = createAsyncThunk(
    'onAuthClosed',
    async () => {
        wrapper(() => systemService.onAuthClosed());
    }
);

export const onRegistrationButtonClickedRequest = createAsyncThunk(
    'onRegistrationButtonClicked',
    async () => {
        wrapper(() => systemService.onRegistrationButtonClicked());
    }
);

export const onForgotPasswordButtonClickedRequest = createAsyncThunk(
    'onForgotPasswordButtonClicked',
    async () => {
        wrapper(() => systemService.onForgotPasswordButtonClicked());
    }
);

export const onEmailSendButtonClickedRequest = createAsyncThunk(
    'onEmailSendButtonClicked',
    async ({ email, captcha }: { email: string; captcha: string }) => {
        wrapper(() => systemService.onEmailSendButtonClicked(email, captcha));
    }
);

export const onSendPasswordButtonClickedRequest = createAsyncThunk(
    'onSendPasswordButtonClicked',
    async ({ password }: { password: string }) => {
        wrapper(() => systemService.onSendPasswordButtonClicked(password));
    }
);

export const onSendCodeButtonClickedRequest = createAsyncThunk(
    'onSendCodeButtonClicked',
    async ({ code }: { code: string }) => {
        wrapper(() => systemService.onSendCodeButtonClicked(code));
    }
);

export const onAppEnterRequest = createAsyncThunk('onAppEnter', async () => {
    wrapper(() => systemService.onAppStartup());
});

export const onPrintButtonPressedRequest = createAsyncThunk(
    'onPrintButtonPressedRequest',
    async () => {
        wrapper(() => systemService.onPrintButtonPressed());
    }
);

export const onProjectPageEscButtonClicked = createAsyncThunk(
    'onProjectPageEscButtonClicked',
    async () => {
        wrapper(() => systemService.onProjectPageEscButtonPressed());
    }
);

export const onRunButtonPressed = createAsyncThunk(
    'onRunButtonPressed',
    async () => {
        wrapper(() => systemService.onRunButtonClicked());
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
        wrapper(() =>
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
        wrapper(() =>
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
        wrapper(() => systemService.deleteSegment(segmentIndex));
    }
);

export const onAddedFilesToSegmentEditorRequest = createAsyncThunk(
    'onAddedFilesToSegmentEditorRequest',
    async ({
        items,
        segmentId,
        editorCallback,
    }: {
        items: DataTransferItemList;
        segmentId: number;
        editorCallback: (insert: string) => void;
    }) => {
        wrapper(() =>
            systemService.onAddedFilesToSegmentEditor(
                items,
                segmentId,
                editorCallback
            )
        );
    }
);

export const onSegmentAddedViaDividerRequest = createAsyncThunk(
    'onSegmentAdded',
    async ({ segment, after }: { segment: Segment; after: number }) => {
        wrapper(() => systemService.onSegmentAddedViaDivider(segment, after));
    }
);

export const onFocusSegmentRequest = createAsyncThunk(
    'onFocusSegmentRequest',
    async ({ segmentIndex }: { segmentIndex: number }) => {
        wrapper(() => systemService.onFocusSegment(segmentIndex));
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
        wrapper(() => systemService.onBlurSegment(segmentIndex, segmentText));
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
        wrapper(() =>
            systemService.onSegmentTextEdited(segmentIndex, segmentText)
        );
    }
);

export const onAddSegmentButtonClickedRequest = createAsyncThunk(
    'onAddSegmentButtonClickedRequest',
    async ({ type }: { type: SegmentType }) => {
        wrapper(() => systemService.onAddSegmentClicked(type));
    }
);

export const onFolderButtonClickedRequest = createAsyncThunk(
    'onFolderButtonClickedRequest',
    async () => {
        wrapper(() => systemService.onFolderButtonClicked());
    }
);

export const onPrevVersionButtonClickedRequest = createAsyncThunk(
    'onPrevVersionButtonClickedRequest',
    async () => {
        wrapper(() => systemService.onPrevVersionButtonClicked());
    }
);

export const onNextVersionButtonClickedRequest = createAsyncThunk(
    'onNextVersionButtonClickedRequest',
    async () => {
        wrapper(() => systemService.onNextVersionButtonClicked());
    }
);

export const onSearchIconPressRequest = createAsyncThunk(
    'onSearchIconPressRequest',
    async () => {
        wrapper(() => systemService.onSearchIconPress());
    }
);

export const onSearchInputChangedRequest = createAsyncThunk(
    'onSearchInputChangedRequest',
    async ({ text }: { text: string }) => {
        wrapper(() => systemService.onSearchInputChanged(text));
    }
);

export const onRoundStrategySetRequest = createAsyncThunk(
    'onRoundStrategySetRequest',
    async ({ strategy }: { strategy: ProgramRoundStrategy }) => {
        wrapper(() => systemService.onRoundStrategySet(strategy));
    }
);

export const onHelpItemCreatedRequest = createAsyncThunk(
    'onHelpItemCreatedRequest',
    async ({ item }: { item: HeaderHelpItem }) => {
        wrapper(() => systemService.onHelpItemCreated(item));
    }
);

export const onExpandErrorsClickedRequest = createAsyncThunk(
    'onExpandErrorsClickedRequest',
    async () => {
        wrapper(() => systemService.onExpandErrorsClicked());
    }
);

export const onCrossButtonInFileManagerClickedRequest = createAsyncThunk(
    'onCrossButtonInFileManagerClickedRequest',
    async () => {
        wrapper(() => systemService.onCrossButtonInFileManagerClicked());
    }
);

export const onUploadFileRequest = createAsyncThunk(
    'onUploadFileRequest',
    async ({ file }: { file: File }) => {
        wrapper(() => systemService.onUploadFile(file));
    }
);

export const onDeleteFileRequest = createAsyncThunk(
    'onDeleteFileRequest',
    async ({ fileName }: { fileName: string }) => {
        wrapper(() => systemService.onDeleteFile(fileName));
    }
);

export const onFileNameChangedRequest = createAsyncThunk(
    'onFileNameChangedRequest',
    async ({ oldName, newName }: { oldName: string; newName: string }) => {
        wrapper(() => systemService.onFileNameChanged(oldName, newName));
    }
);

export const onFileRenameButtonClickedRequest = createAsyncThunk(
    'onFileRenameButtonClickedRequest',
    async () => {
        wrapper(() => systemService.onFileRenameButtonClicked());
    }
);

export const onRowClickedInProjectsListRequest = createAsyncThunk(
    'onRowClickedInProjectsListRequest',
    async ({ projectId }: { projectId: string }) => {
        wrapper(() => systemService.onRowClickedInProjectsList(projectId));
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
        wrapper(() =>
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
        wrapper(() => systemService.onProjectVisibilityChange(visible));
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
        wrapper(() =>
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
        wrapper(() => systemService.onBackButtonClicked());
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
        wrapper(() => systemService.onDeleteProject(projectId, okCallback));
    }
);

/*
Controllers without thunk
 */

export const isPrevVersionButtonDisabledRequest = (): boolean => {
    return systemService.isPrevVersionButtonDisabled();
};

export const isNextVersionButtonDisabledRequest = (): boolean => {
    return systemService.isNextVersionButtonDisabled();
};

const wrapper = (method: () => void) => {
    try {
        method();
    } catch (error) {
        console.error(error);
        Sentry.captureException(error);
    }
};
