import {createSlice, PayloadAction, createAsyncThunk} from "@reduxjs/toolkit";
import {LOGOUT_TYPE} from "../../actions";
import {userRPI} from "../../../rpi/user";

export type AuthView = 'login' | 'email' | 'code' | 'password'

interface RequestState {
    loading: boolean;
    error: string | null;
}

interface EmailRequestState extends RequestState {
    userNotFound: boolean;
    userExists: boolean;
}

interface CodeCheckState extends RequestState {
    isValid: boolean | null;
}

interface PasswordSetState extends RequestState {
    userNotFound: boolean;
    userExists: boolean;
}

export interface AuthState {
    currentView: AuthView;
    currentEmail: string | null;
    emailRequest: EmailRequestState;
    codeCheck: CodeCheckState;
    passwordSet: PasswordSetState;
}

const initialRequestStates = {
    emailRequest: {
        loading: false,
        error: null,
        userNotFound: false,
        userExists: false
    },
    codeCheck: {
        loading: false,
        error: null,
        isValid: null
    },
    passwordSet: {
        loading: false,
        error: null,
        userNotFound: false,
        userExists: false
    }
}

const initialState: AuthState = {
    currentView: "login",
    currentEmail: null,
    ...initialRequestStates
}

// Async thunks
export const sendEmailWithCode = createAsyncThunk(
    'auth/sendEmailWithCode',
    async ({ email, registration }: { email: string, registration: boolean }, { rejectWithValue }) => {
        const result = await userRPI.sendEmailWithCode(email, registration);
        if (!result.isOk) {
            return rejectWithValue({ code: result.code, email });
        }
        return { email };
    }
);

export const checkCode = createAsyncThunk(
    'auth/checkCode',
    async ({ email, code }: { email: string, code: string }, { rejectWithValue }) => {
        const result = await userRPI.checkCode(email, code);
        if (!result.isOk) {
            return rejectWithValue(result.code);
        }
        return result.body as { valid: boolean };
    }
);

export const setPassword = createAsyncThunk(
    'auth/setPassword',
    async ({ email, code, password, registration }: 
        { email: string, code: string, password: string, registration: boolean }, 
        { rejectWithValue }
    ) => {
        const result = await userRPI.setPassword(email, code, password, registration);
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
        resetRequestStates(state) {
            state.emailRequest = initialRequestStates.emailRequest;
            state.codeCheck = initialRequestStates.codeCheck;
            state.passwordSet = initialRequestStates.passwordSet;
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
                state.emailRequest.loading = true;
                state.emailRequest.error = null;
                state.emailRequest.userNotFound = false;
                state.emailRequest.userExists = false;
            })
            .addCase(sendEmailWithCode.fulfilled, (state, action) => {
                state.emailRequest.loading = false;
                state.currentEmail = action.payload.email;
            })
            .addCase(sendEmailWithCode.rejected, (state, action) => {
                state.emailRequest.loading = false;
                const payload = action.payload as { code: number, email: string };
                state.emailRequest.error = payload.code.toString();
                state.currentEmail = payload.email;
                state.emailRequest.userNotFound = payload.code === 404;
                state.emailRequest.userExists = payload.code === 409;
            })
            // Code check
            .addCase(checkCode.pending, (state) => {
                state.codeCheck.loading = true;
                state.codeCheck.error = null;
                state.codeCheck.isValid = null;
            })
            .addCase(checkCode.fulfilled, (state, action) => {
                state.codeCheck.loading = false;
                state.codeCheck.isValid = action.payload.valid;
            })
            .addCase(checkCode.rejected, (state, action) => {
                state.codeCheck.loading = false;
                state.codeCheck.error = action.payload as string;
                state.codeCheck.isValid = false;
            })
            // Password set
            .addCase(setPassword.pending, (state) => {
                state.passwordSet.loading = true;
                state.passwordSet.error = null;
                state.passwordSet.userNotFound = false;
                state.passwordSet.userExists = false;
            })
            .addCase(setPassword.fulfilled, (state) => {
                state.passwordSet.loading = false;
            })
            .addCase(setPassword.rejected, (state, action) => {
                state.passwordSet.loading = false;
                const code = action.payload as number;
                state.passwordSet.error = code.toString();
                state.passwordSet.userNotFound = code === 404;
                state.passwordSet.userExists = code === 409;
            });
    }
})

export const {setCurrentView, setCurrentEmail, resetRequestStates} = authSlice.actions