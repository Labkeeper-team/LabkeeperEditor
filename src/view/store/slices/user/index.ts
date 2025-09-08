import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LOGOUT_TYPE } from '../../actions';
import { userInitialState } from '../index.ts';
import { UserInfo } from '../../../../model/domain.ts';

export const userSlice = createSlice({
    name: 'userSlice',
    initialState: userInitialState,
    selectors: {
        selectAll: (state) => state,
        selectIsAuthenticated: (state) => state.isAuthenticated,
        selectEmail: (state) => state.email,
    },
    reducers: {
        setUser: (state, { payload }: PayloadAction<UserInfo>) => {
            state.email = payload.email;
            state.isAuthenticated = payload.isAuthenticated;
            state.id = payload.id;
        },
        clearUser: (state) => {
            state = userInitialState;
            return state;
        },
    },
    extraReducers: (b) => {
        b.addCase(LOGOUT_TYPE, (state) => {
            state = userInitialState;
            return state;
        });
    },
});
export const { setUser, clearUser } = userSlice.actions;
export const { selectAll, selectIsAuthenticated, selectEmail } =
    userSlice.selectors;
