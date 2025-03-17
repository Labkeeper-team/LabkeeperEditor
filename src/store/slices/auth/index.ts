import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {LOGOUT_TYPE} from "../../actions";

export type AuthView = 'login' | 'email' | 'code' | 'password'

export interface AuthState {
    currentView: AuthView
}

const initialState: AuthState = {
    currentView: "login"
}

export const authSlice = createSlice({
    name: 'authSlice',
    initialState,
    reducers: {
        setCurrentView(state, {payload}: PayloadAction<AuthView>) {
            state.currentView = payload
        }
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = initialState;
            return state;
        });
    }
})
export const {setCurrentView} = authSlice.actions