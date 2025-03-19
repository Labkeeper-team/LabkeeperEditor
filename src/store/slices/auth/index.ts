import {createSlice, PayloadAction, createAsyncThunk} from "@reduxjs/toolkit";
import {LOGOUT_TYPE} from "../../actions";
import {userRPI} from "../../../rpi/user";
import {StorageState} from "../../index";

export type AuthView = 'login' | 'email' | 'code' | 'password' | 'success'
export type EmailRequestState = 'unknown' | 'loading' | 'ok' | 'userNotFound' | 'userExists' | 'validationError'
export type CodeRequestState = 'unknown' | 'loading' | 'ok' | 'invalid'
export type PasswordRequestState = 'unknown' | 'loading' | 'ok' | 'userNotFound' | 'userExists' | 'validationError'

export interface AuthState {
    currentView: AuthView;
    currentEmail: string | null;
    lastVerifiedCode: string | null;
    isRegistration: boolean;
    emailRequest: EmailRequestState;
    codeCheckRequest: CodeRequestState;
    passwordSetRequest: PasswordRequestState;
    authErrorMessage: string | null;
    showAuthModal: boolean;
}

const initialState: AuthState = {
    isRegistration: true,
    currentView: 'login',
    currentEmail: null,
    lastVerifiedCode: null,
    emailRequest: 'unknown',
    codeCheckRequest: 'unknown',
    passwordSetRequest: 'unknown',
    authErrorMessage: null,
    showAuthModal: false
}

// Async thunks
export const sendEmailWithCode = createAsyncThunk(
    'auth/sendEmailWithCode',
    async ({ email, captcha }: { email: string, captcha: string }, { rejectWithValue, getState }) => {
        const state = getState() as StorageState;
        const result = await userRPI.sendEmailWithCode(email, state.auth.isRegistration, state.settings.language, captcha);
        if (!result.isOk) {
            return rejectWithValue({ code: result.code, email });
        }
        return { email };
    }
);

export const checkCode = createAsyncThunk(
    'auth/checkCode',
    async ({ code }: { code: string }, { rejectWithValue, getState }) => {
        const state = getState() as StorageState;
        const result = await userRPI.checkCode(state.auth.currentEmail || '', code);
        if (!result.isOk) {
            return rejectWithValue(result.code);
        }
        return { valid: result.body.valid, code };
    }
);

export const setPassword = createAsyncThunk(
    'auth/setPassword',
    async ({ password }: { email: string, code: string, password: string }, { rejectWithValue, getState }) => {
        const state = getState() as StorageState;
        const result = await userRPI.setPassword(state.auth.currentEmail || '', state.auth.lastVerifiedCode || '', password, state.auth.isRegistration);
        if (!result.isOk) {
            return rejectWithValue(result.code);
        }
    }
);

export const authSlice = createSlice({
    name: 'authSlice',
    initialState,
    reducers: {
        setCurrentView(state, {payload}: PayloadAction<AuthView>) {
            state.currentView = payload
        },
        setCurrentEmail(state, {payload}: PayloadAction<string | null>) {
            state.currentEmail = payload
        },
        setRegistration(state, {payload}: PayloadAction<boolean>) {
            state.isRegistration = payload
        },
        resetRequestStates(state) {
            state.emailRequest = 'unknown'
            state.codeCheckRequest = 'unknown';
            state.passwordSetRequest = 'unknown';
        },
        setErrorMessage(state, {payload}: PayloadAction<string>) {
            state.showAuthModal = true
            state.authErrorMessage = payload
        },
        setShowAuthModal(state, {payload}: PayloadAction<boolean>) {
            state.showAuthModal = payload
            if (!payload) {
                state.authErrorMessage = ''
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(LOGOUT_TYPE, (state) => {
                state = initialState;
                return state;
            })
            // Email request
            .addCase(sendEmailWithCode.pending, (state) => {
                state.emailRequest = 'loading'
                state.currentEmail = null
                state.authErrorMessage = ''
            })
            .addCase(sendEmailWithCode.fulfilled, (state, action) => {
                state.emailRequest = 'ok'
                state.currentEmail = action.payload.email;
            })
            .addCase(sendEmailWithCode.rejected, (state, action) => {
                const payload = action.payload as { code: number, email: string };
                state.currentEmail = null;
                state.emailRequest = 'validationError'
                if (payload.code === 404) {
                    state.emailRequest = 'userNotFound'
                }
                if (payload.code === 409) {
                    state.emailRequest = 'userExists'
                }
            })
            // Code check
            .addCase(checkCode.pending, (state) => {
                state.codeCheckRequest = 'loading'
                state.lastVerifiedCode = null
                state.authErrorMessage = ''
            })
            .addCase(checkCode.fulfilled, (state, action) => {
                state.codeCheckRequest = 'ok'
                if (!action.payload.valid) {
                    state.codeCheckRequest = 'invalid'
                }
                state.lastVerifiedCode = action.payload.code
            })
            .addCase(checkCode.rejected, (state, _) => {
                state.codeCheckRequest = 'invalid'
                state.lastVerifiedCode = null
            })
            // Password set
            .addCase(setPassword.pending, (state) => {
                state.passwordSetRequest = 'loading'
                state.authErrorMessage = ''
            })
            .addCase(setPassword.fulfilled, (state) => {
                state.passwordSetRequest = 'ok'
            })
            .addCase(setPassword.rejected, (state, action) => {
                const code = action.payload as number;
                state.passwordSetRequest = 'validationError'
                if (code === 404) {
                    state.passwordSetRequest = 'userNotFound'
                }
                if (code === 409) {
                    state.passwordSetRequest = 'userExists'
                }
            });
    }
})

export const {setCurrentView, setShowAuthModal, setErrorMessage, setCurrentEmail, resetRequestStates, setRegistration} = authSlice.actions