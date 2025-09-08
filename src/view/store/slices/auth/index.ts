import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { authInitialState } from '../index.ts';
import {
    AuthView,
    CodeRequestState,
    EmailRequestState,
    LoginRequestState,
    PasswordRequestState,
} from '../../../../viewModel/viewModelState';

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
    extraReducers: (builder) => {
        builder.addCase(LOGOUT_TYPE, (state) => {
            state = authInitialState;
            return state;
        });
        /*
            // Email request
            .addCase(sendEmailWithCode.pending, (state) => {
                state.emailRequest = 'loading';
                state.currentEmail = null;
                state.authErrorMessage = '';
            })
            .addCase(sendEmailWithCode.fulfilled, (state, action) => {
                state.emailRequest = 'ok';
                state.currentEmail = action.payload.email;
            })
            .addCase(sendEmailWithCode.rejected, (state, action) => {
                const payload = action.payload as {
                    code: number;
                    email: string;
                };
                state.currentEmail = null;
                state.emailRequest = 'validationError';
                if (payload.code === 404) {
                    state.emailRequest = 'userNotFound';
                }
                if (payload.code === 409) {
                    state.emailRequest = 'userExists';
                }
            })
            // Code check
            .addCase(checkCode.pending, (state) => {
                state.codeCheckRequest = 'loading';
                state.lastVerifiedCode = null;
                state.authErrorMessage = '';
            })
            .addCase(checkCode.fulfilled, (state, action) => {
                state.codeCheckRequest = 'ok';
                if (!action.payload.valid) {
                    state.codeCheckRequest = 'invalid';
                }
                state.lastVerifiedCode = action.payload.code;
            })
            .addCase(checkCode.rejected, (state) => {
                state.codeCheckRequest = 'invalid';
                state.lastVerifiedCode = null;
            })
            // Password set
            .addCase(setPassword.pending, (state) => {
                state.passwordSetRequest = 'loading';
                state.authErrorMessage = '';
            })
            .addCase(setPassword.fulfilled, (state) => {
                state.passwordSetRequest = 'ok';
            })
            .addCase(setPassword.rejected, (state, action) => {
                const code = action.payload as number;
                state.passwordSetRequest = 'validationError';
                if (code === 404) {
                    state.passwordSetRequest = 'userNotFound';
                }
                if (code === 409) {
                    state.passwordSetRequest = 'userExists';
                }
            });

             */
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
