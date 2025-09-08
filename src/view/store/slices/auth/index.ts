import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { authInitialState } from '../index.ts';
import {
    AuthView,
    CodeRequestState,
    EmailRequestState,
    LoginRequestState,
    PasswordRequestState,
} from '../../../../viewModel/repository';

export const authSlice = createSlice({
    name: 'authSlice',
    initialState: authInitialState,
    reducers: {
        setCurrentView(state, { payload }: PayloadAction<AuthView>) {
            state.currentView = payload;
        },
        setCurrentEmail(state, { payload }: PayloadAction<string | null>) {
            state.currentEmail = payload;
        },
        setLastVerifiedCode(state, { payload }: PayloadAction<string | null>) {
            state.lastVerifiedCode = payload;
        },
        setLoginRequest(state, { payload }: PayloadAction<LoginRequestState>) {
            state.loginRequest = payload;
        },
        setEmailRequest(state, { payload }: PayloadAction<EmailRequestState>) {
            state.emailRequest = payload;
        },
        setCodeCheckRequest(
            state,
            { payload }: PayloadAction<CodeRequestState>
        ) {
            state.codeCheckRequest = payload;
        },
        setPasswordRequest(
            state,
            { payload }: PayloadAction<PasswordRequestState>
        ) {
            state.passwordSetRequest = payload;
        },
        setRegistration(state, { payload }: PayloadAction<boolean>) {
            state.isRegistration = payload;
        },
    },
});

export const {
    setCurrentView,
    setEmailRequest,
    setCodeCheckRequest,
    setCurrentEmail,
    setLastVerifiedCode,
    setLoginRequest,
    setPasswordRequest,
    setRegistration,
} = authSlice.actions;
